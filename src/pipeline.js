import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { downloadMedia, sendWhatsApp } from './twilio.js';
import { transcribe } from './transcribe.js';
import { extract } from './extract.js';
import { validateExtraction } from './validate.js';
import { createInvoice } from './invoice.js';
import { appendJob } from './store.js';
import { setStage } from './jobstate.js';

async function withRetry(fn) {
  try { return await fn(); }
  catch { await new Promise((r) => setTimeout(r, 1000)); return fn(); }
}

export function newRecord({ from, messageSid, source }) {
  return {
    job_id: messageSid ? `job_${messageSid}` : `job_local_${randomUUID()}`,
    status: 'failed', failed_stage: null,
    source: source ?? (String(from ?? '').startsWith('whatsapp:') ? 'voice' : 'local'),
    customer_name: null, work_performed: null, parts_used: [],
    hours_logged: null, amount_to_charge: null, follow_up_required: false,
    technician_number: from || 'local-test',
    timestamp: new Date().toISOString(),
    transcript_raw: null,
    message_sid: messageSid || null,
    validation: { blocking: [], warnings: [] },
    llm_output_raw: null,
    stripe: null,
    error: null,
    processing_ms: null,
  };
}

// Stage tracker: a console line for ops visibility plus an in-memory entry so the
// dashboard can show real in-flight progress. Never affects the persisted record's
// `status` (final outcome) or `failed_stage` (fixed vocabulary below).
const TERMINAL_STAGES = new Set(['completed', 'needs_review', 'failed']);
function logStage(record, stage) {
  console.log(`[stage] ${record.job_id} ${stage}`);
  setStage(record.job_id, stage, {
    technician_number: record.technician_number,
    source: record.source ?? null,
    customer_name: record.customer_name ?? null,
    amount_to_charge: record.amount_to_charge ?? null,
    ...(TERMINAL_STAGES.has(stage) ? { status: record.status } : {}),
  });
}

// Mutates and returns record. Never throws for expected failures.
export async function processTranscript(record) {
  try {
    logStage(record, 'extracting');
    const { json, raw } = await extract(record.transcript_raw);
    record.llm_output_raw = raw;
    logStage(record, 'validating');
    const v = validateExtraction(json, record.transcript_raw, config.limits);
    Object.assign(record, v.job ?? {});
    record.validation = { blocking: v.blocking, warnings: v.warnings };
    if (!v.ok) { record.status = 'needs_review'; logStage(record, 'needs_review'); return record; }
    try {
      logStage(record, 'invoicing');
      record.stripe = await createInvoice(record);
      record.status = 'invoiced';
      logStage(record, 'completed');
    } catch (err) {
      record.status = 'invoice_failed';
      record.failed_stage = 'invoice';
      record.error = err.message;
      record.stripe = err.stripePartial ?? null;
      logStage(record, 'failed');
    }
  } catch (err) {
    record.status = 'failed';
    record.failed_stage = 'extraction';
    record.error = err.message;
    record.llm_output_raw = err.llmOutputRaw ?? record.llm_output_raw;
    logStage(record, 'failed');
  }
  return record;
}

export async function processVoiceNote({ from, messageSid, mediaUrl, mediaType }) {
  const record = newRecord({ from, messageSid });
  logStage(record, 'received');
  const started = Date.now();
  let stage = 'download';
  try {
    logStage(record, 'downloading');
    const audio = await withRetry(() => downloadMedia(mediaUrl));
    stage = 'transcription';
    logStage(record, 'transcribing');
    const transcript = await withRetry(() => transcribe(audio, mediaType));
    if (!transcript) throw new Error('no speech detected');
    record.transcript_raw = transcript;
    await processTranscript(record);
  } catch (err) {
    record.status = 'failed';
    record.failed_stage = stage;
    record.error = err.message;
    logStage(record, 'failed');
  } finally {
    record.processing_ms = Date.now() - started;
    await appendJob(record);
    await notify(record);
  }
  return record;
}

// Demo fallback, used only when ALLOW_TEXT_INPUT=true
export async function processTextNote({ from, messageSid, text }) {
  const record = newRecord({ from, messageSid, source: 'text' });
  logStage(record, 'received');
  const started = Date.now();
  record.transcript_raw = String(text).trim();
  try {
    await processTranscript(record);
  } finally {
    record.processing_ms = Date.now() - started;
    await appendJob(record);
    await notify(record);
  }
  return record;
}

const fmt = (n) => (config.currency === 'usd' ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${config.currency.toUpperCase()}`);

export function buildConfirmation(r) {
  const heard = r.transcript_raw ? `\nHeard: "${r.transcript_raw.slice(0, 200)}"` : '';
  switch (r.status) {
    case 'invoiced': {
      const lines = [`✅ Invoice for ${r.customer_name} (${fmt(r.amount_to_charge)}) created.`];
      if (r.stripe?.hosted_invoice_url) lines.push(r.stripe.hosted_invoice_url);
      if (r.follow_up_required) lines.push('🔁 Follow-up visit flagged.');
      for (const w of r.validation.warnings) lines.push(`⚠️ ${w}`);
      lines.push(`Job: ${r.job_id}`);
      return lines.join('\n');
    }
    case 'needs_review':
      return `⚠️ Not invoiced — needs review:\n- ${r.validation.blocking.join('\n- ')}\n`
        + `Please resend a voice note with the customer name, work done and total amount.${heard}`;
    case 'invoice_failed':
      return `⚠️ Job for ${r.customer_name} recorded, but the invoice was NOT created. The office will follow up.\nJob: ${r.job_id}`;
    default: {
      const what = {
        download: 'fetch your voice note',
        transcription: 'transcribe your voice note',
        extraction: 'read the job details',
      }[r.failed_stage] || 'process your message';
      return `❌ Sorry, couldn't ${what}. Please send the voice note again.${heard}`;
    }
  }
}

async function notify(record) {
  const text = buildConfirmation(record);
  if (!String(record.technician_number).startsWith('whatsapp:')) { console.log(text); return; }
  try { await sendWhatsApp(record.technician_number, text); }
  catch (err) { console.error('[confirm] send failed:', err.message); console.log(text); }
}
