// In-app voice → draft invoice flow.
//
// Reuses the exact same speech and extraction stages as the WhatsApp pipeline,
// including src/validate.js. The difference is what happens at the end:
// WhatsApp auto-invoices only when validation passes, whereas this flow always
// stops at a human review step. Validation findings become advisory flags the
// reviewer must resolve; nothing is billed until a person confirms.
//
// CRITICAL: the model still never prices anything. The only price it can supply
// is the total the technician said out loud, carried onto a single line item.
// Every other price on the invoice is typed by a human.

import { config } from './config.js';
import { transcribe } from './transcribe.js';
import { extract } from './extract.js';
import { validateExtraction } from './validate.js';
import { updateDraft } from './drafts.js';
import { setStage } from './jobstate.js';

const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function buildInvoiceDocument(job, extraction) {
  const statedTotal = job?.amount_to_charge ?? null;
  const description = job?.work_performed || extraction?.work_performed || 'Work performed';

  return {
    customer: {
      name: job?.customer_name ?? '',
      email: '',
      address: '',
    },
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: addDays(config.daysUntilDue),
    // One line carrying the spoken total. A human can split this into several
    // lines, but the model never invented any of these numbers.
    line_items: [
      {
        id: 'line_1',
        description,
        quantity: 1,
        unit_price: statedTotal ?? 0,
      },
    ],
    tax_rate: 0,
    discount: { type: 'amount', value: 0 },
    notes: '',
  };
}

/**
 * Runs transcription → extraction → validation for an uploaded recording and
 * stores the result as a reviewable draft. Never throws: failures are recorded
 * on the draft so the UI can show exactly which stage broke.
 */
export async function processDraftAudio(draftId, buffer, contentType) {
  const mark = async (stage, patch = {}) => {
    setStage(draftId, stage, { source: 'web' });
    await updateDraft(draftId, { stage, ...patch });
  };

  try {
    await mark('transcribing');
    const transcript = await transcribe(buffer, contentType);
    if (!transcript) throw Object.assign(new Error('No speech detected in the recording'), { stage: 'transcribing' });
    await mark('extracting', { transcript_raw: transcript });

    let json;
    let raw = null;
    try {
      ({ json, raw } = await extract(transcript));
    } catch (err) {
      throw Object.assign(err, { stage: 'extracting', llmOutputRaw: err.llmOutputRaw ?? null });
    }

    await mark('validating', { llm_output_raw: raw });
    const result = validateExtraction(json, transcript, config.limits);

    // Parts the technician mentioned. Offered to the reviewer as unpriced
    // suggestions — adding one requires typing a price.
    const suggestedParts = (result.job?.parts_used ?? []).map((part, index) => ({
      id: `part_${index + 1}`,
      item: part.item,
      quantity: part.quantity ?? 1,
    }));

    const updated = await updateDraft(draftId, {
      status: 'ready',
      stage: 'ready',
      extraction: json,
      validation: { blocking: result.blocking, warnings: result.warnings },
      suggested_parts: suggestedParts,
      stated_total: result.job?.amount_to_charge ?? null,
      stated_hours: result.job?.hours_logged ?? null,
      invoice: buildInvoiceDocument(result.job, json),
      error: null,
    });
    setStage(draftId, 'ready', { source: 'web' });
    return updated;
  } catch (err) {
    const stage = err.stage ?? 'processing';
    setStage(draftId, 'failed', { source: 'web' });
    return updateDraft(draftId, {
      status: 'failed',
      stage,
      error: err.message,
      llm_output_raw: err.llmOutputRaw ?? null,
    });
  }
}
