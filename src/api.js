// JSON API for the Voice2Invoice dashboard.
//
// SAFETY: the job routes are read-only — the dashboard can never create, edit,
// or re-run a WhatsApp job, so there is no path from the browser to Stripe that
// skips the validation gate in src/validate.js.
//
// The /drafts routes are the one exception, and they are deliberately narrow:
// recording and editing a draft never touch Stripe, and POST /drafts/:id/finalize
// is the single route that can create an invoice. It requires an explicit human
// confirmation, re-validates the document server-side, and refuses to send if the
// total it computes differs from the total the reviewer actually saw.
// SECURITY: no secret (auth token, API key, Stripe key) is ever returned.

import { randomUUID } from 'node:crypto';
import express from 'express';
import { config } from './config.js';
import { appendJob, readJobs } from './store.js';
import { listActive } from './jobstate.js';
import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from './drafts.js';
import { processDraftAudio, buildInvoiceDocument } from './draftflow.js';
import { computeTotals, validateInvoiceDocument, toCents } from './money.js';
import { createInvoiceFromDocument } from './invoice.js';

/**
 * A cheap, offline sanity check on a credential. It cannot prove a key works —
 * only a live call does that — but it reliably catches the placeholders shipped
 * in .env.example, which is the case that actually misleads people.
 */
function looksReal(value, prefix) {
  const v = (value ?? '').trim();
  if (!v) return false;
  if (/placeholder|your_|_here|xxx|changeme|example/i.test(v)) return false;
  if (prefix && !v.startsWith(prefix)) return false;
  return v.length >= 20;
}

const STEPS = [
  ['received', 'Voice note received'],
  ['downloaded', 'Audio downloaded'],
  ['transcribed', 'Transcript created'],
  ['extracted', 'Job details extracted'],
  ['validated', 'Validation'],
  ['invoiced', 'Invoice created'],
];

// Derive the pipeline timeline from what the finished record actually records.
// Nothing here is guessed: status + failed_stage say exactly how far the job got.
// Exported for unit tests — these rules are what keep the dashboard honest.
export function buildTimeline(record) {
  const state = Object.fromEntries(STEPS.map(([id]) => [id, 'pending']));
  state.received = 'done';

  // Typed and script-run jobs have no audio at all. Web recordings have audio but
  // nothing to fetch from Twilio, so only the download step is not applicable.
  const noAudio = record.source === 'text' || record.source === 'local';
  const noDownload = noAudio || record.source === 'web';
  if (noDownload) state.downloaded = 'skipped';
  if (noAudio) state.transcribed = 'skipped';
  // Completing a step never overwrites "not applicable".
  const advance = (id) => { if (state[id] !== 'skipped') state[id] = 'done'; };

  const stage = record.failed_stage;
  if (stage === 'download') {
    state.downloaded = 'failed';
  } else if (stage === 'transcription') {
    advance('downloaded');
    state.transcribed = 'failed';
  } else if (stage === 'extraction') {
    advance('downloaded');
    advance('transcribed');
    state.extracted = 'failed';
  } else {
    advance('downloaded');
    advance('transcribed');
    if (record.transcript_raw) state.extracted = 'done';
    if (record.status === 'needs_review') {
      state.validated = 'blocked';
    } else if (record.status === 'invoice_failed') {
      state.validated = 'done';
      state.invoiced = 'failed';
    } else if (record.status === 'invoiced') {
      state.validated = 'done';
      state.invoiced = 'done';
    }
  }

  return STEPS.map(([id, label]) => ({ id, label, state: state[id] }));
}

// Turn the validator's blocking/warning strings into structured, displayable checks.
// Returns [] when the job died before validation ran — there is nothing to report.
export function buildChecks(record) {
  if (['download', 'transcription', 'extraction'].includes(record.failed_stage)) return [];
  const blocking = record.validation?.blocking ?? [];
  const warnings = record.validation?.warnings ?? [];
  const lower = (arr) => arr.map((x) => String(x).toLowerCase());
  const bl = lower(blocking);
  const wl = lower(warnings);
  const hit = (arr, ...needles) => arr.some((x) => needles.some((n) => x.includes(n)));

  const checks = [];

  const customerFailed = hit(bl, 'customer name');
  checks.push({
    id: 'customer',
    label: 'Customer identified',
    state: customerFailed ? 'fail' : 'pass',
    detail: customerFailed
      ? blocking.find((b) => String(b).toLowerCase().includes('customer name'))
      : `Grounded in transcript: ${record.customer_name}`,
  });

  const workFailed = hit(bl, 'work performed');
  checks.push({
    id: 'work',
    label: 'Work described',
    state: workFailed ? 'fail' : 'pass',
    detail: workFailed ? 'No work description was stated' : record.work_performed,
  });

  const amountBlock = blocking.find((b) => String(b).toLowerCase().startsWith('amount'));
  const amountWarn = warnings.find((w) => /not stated as digits|converted/i.test(String(w)));
  // No confirmed amount always fails, even when the blocking reason was an ambiguity
  // rather than an amount-shaped message.
  const amountMissing = record.amount_to_charge === null || record.amount_to_charge === undefined;
  checks.push({
    id: 'amount',
    label: 'Amount explicitly stated',
    state: amountBlock || amountMissing ? 'fail' : amountWarn ? 'warn' : 'pass',
    detail: amountBlock
      || (amountMissing ? 'No amount could be confirmed — invoice blocked' : (amountWarn || 'Stated as digits in the transcript')),
  });

  const hoursBlock = blocking.find((b) => String(b).toLowerCase().includes('hours_logged invalid'));
  const hoursWarn = hit(wl, 'hours not stated');
  checks.push({
    id: 'hours',
    label: 'Hours identified',
    state: hoursBlock ? 'fail' : hoursWarn ? 'warn' : 'pass',
    detail: hoursBlock
      || (hoursWarn ? 'Hours were not stated in the voice note'
        : `${record.hours_logged} ${record.hours_logged === 1 ? 'hour' : 'hours'}`),
  });

  const partsDropped = warnings.filter((w) => /dropped part/i.test(String(w)));
  const partsBlock = hit(bl, 'parts_used is not a list');
  const partCount = record.parts_used?.length ?? 0;
  checks.push({
    id: 'parts',
    label: 'Parts grounded in transcript',
    state: partsBlock ? 'fail' : partsDropped.length ? 'warn' : partCount ? 'pass' : 'skip',
    detail: partsBlock
      ? 'parts_used was not a list'
      : partsDropped.length
        ? partsDropped.join('; ')
        : partCount === 1
          ? '1 part, mentioned in the transcript'
          : partCount
            ? `${partCount} parts, each mentioned in the transcript`
            : 'No parts were mentioned',
  });

  // Only surfaced when they actually fail — they are exception rows, not routine checks.
  const ambiguous = blocking.filter((b) => String(b).toLowerCase().startsWith('ambiguous'));
  if (ambiguous.length) {
    checks.push({
      id: 'ambiguity',
      label: 'No ambiguous values',
      state: 'fail',
      detail: ambiguous.join('; '),
    });
  }
  const structural = blocking.filter((b) =>
    /missing key|not a json object|contradictory|is not a list/i.test(String(b)));
  if (structural.length) {
    checks.push({
      id: 'structure',
      label: 'Extraction is well-formed',
      state: 'fail',
      detail: structural.join('; '),
    });
  }

  return checks;
}

function summarize(record) {
  return {
    job_id: record.job_id,
    status: record.status,
    failed_stage: record.failed_stage ?? null,
    customer_name: record.customer_name ?? null,
    work_performed: record.work_performed ?? null,
    amount_to_charge: record.amount_to_charge ?? null,
    hours_logged: record.hours_logged ?? null,
    parts_count: record.parts_used?.length ?? 0,
    // The parts themselves, so the dashboard can roll them up without
    // fetching every job detail one at a time.
    parts_used: (record.parts_used ?? []).filter((p) => p && typeof p.item === 'string'),
    follow_up_required: !!record.follow_up_required,
    technician_number: record.technician_number ?? null,
    timestamp: record.timestamp,
    processing_ms: record.processing_ms ?? null,
    invoice_number: record.stripe?.invoice_number ?? null,
    invoice_id: record.stripe?.invoice_id ?? null,
    hosted_invoice_url: record.stripe?.hosted_invoice_url ?? null,
    blocking_count: record.validation?.blocking?.length ?? 0,
    warning_count: record.validation?.warnings?.length ?? 0,
    source: record.source ?? null,
    demo: !!record.demo,
  };
}

export function createApiRouter() {
  const router = express.Router();

  router.get('/stats', async (_req, res, next) => {
    try {
      const jobs = await readJobs();
      const by = (s) => jobs.filter((j) => j.status === s);
      const invoiced = by('invoiced');
      res.json({
        jobs_total: jobs.length,
        invoiced: invoiced.length,
        needs_review: by('needs_review').length,
        failed: by('failed').length + by('invoice_failed').length,
        invoiced_value: invoiced.reduce((sum, j) => sum + (Number(j.amount_to_charge) || 0), 0),
        currency: config.currency,
        last_job_at: jobs[0]?.timestamp ?? null,
        demo_count: jobs.filter((j) => j.demo).length,
      });
    } catch (err) { next(err); }
  });

  router.get('/jobs', async (req, res, next) => {
    try {
      const { q = '', status = '' } = req.query;
      let jobs = await readJobs();
      if (status && status !== 'all') jobs = jobs.filter((j) => j.status === status);
      const needle = String(q).trim().toLowerCase();
      if (needle) {
        jobs = jobs.filter((j) =>
          [j.customer_name, j.work_performed, j.transcript_raw, j.technician_number, j.job_id]
            .some((v) => String(v ?? '').toLowerCase().includes(needle)));
      }
      res.json({ jobs: jobs.map(summarize), total: jobs.length, currency: config.currency });
    } catch (err) { next(err); }
  });

  router.get('/jobs/:id', async (req, res, next) => {
    try {
      const jobs = await readJobs();
      const record = jobs.find((j) => j.job_id === req.params.id);
      if (!record) return res.status(404).json({ error: 'job not found' });
      res.json({
        ...record,
        timeline: buildTimeline(record),
        checks: buildChecks(record),
        currency: config.currency,
      });
    } catch (err) { next(err); }
  });

  router.get('/invoices', async (_req, res, next) => {
    try {
      const jobs = await readJobs();
      const invoices = jobs
        .filter((j) => j.stripe?.invoice_id)
        .map((j) => ({
          ...summarize(j),
          send_status: j.stripe?.send_status ?? null,
          customer_id: j.stripe?.customer_id ?? null,
        }));
      res.json({ invoices, total: invoices.length, currency: config.currency });
    } catch (err) { next(err); }
  });

  // Jobs currently moving through the pipeline (in-memory, live).
  router.get('/active', (_req, res) => {
    res.json({ active: listActive(), steps: STEPS.map(([id, label]) => ({ id, label })) });
  });

  // Non-secret configuration only. Credentials are reported as booleans.
  router.get('/settings', (_req, res) => {
    const number = process.env.TWILIO_WHATSAPP_NUMBER?.trim() || '';
    res.json({
      currency: config.currency,
      business_name: config.businessName,
      operator_name: config.operatorName || null,
      transcription_model: config.transcriptionModel,
      extraction_model: config.extractionModel,
      ai_base_url: config.aiBaseUrl,
      max_invoice_amount: config.limits.maxAmount,
      max_hours_logged: config.limits.maxHours,
      days_until_due: config.daysUntilDue,
      allow_text_input: config.allowTextInput,
      validate_signature: config.validateSignature,
      jobs_file: config.jobsFile,
      webhook_base_url: config.webhookBaseUrl || null,
      webhook_path: '/webhook/whatsapp',
      stripe_mode: 'test',
      configured: {
        twilio: !!(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()),
        whatsapp_number: !!number,
        whatsapp_number_hint: number ? `••••${number.slice(-4)}` : null,
        ai: !!process.env.AI_API_KEY?.trim(),
        stripe: !!process.env.STRIPE_SECRET_KEY?.trim(),
      },
      // "Present" is not the same as "usable". A key left at its .env.example
      // placeholder is present, so reporting it as configured told the operator
      // the app was ready when the first recording would fail. This reports the
      // two states separately instead of flattening them into one green badge.
      verified: {
        twilio: looksReal(process.env.TWILIO_ACCOUNT_SID, 'AC'),
        ai: looksReal(process.env.AI_API_KEY),
        stripe: looksReal(process.env.STRIPE_SECRET_KEY, 'sk_'),
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Drafts — the in-app voice → invoice flow.
  //
  // These are the only non-GET routes in the application. None of them can bill
  // anyone: creating and editing a draft never touches Stripe, and finalize runs
  // the server-side document validation plus an explicit human confirmation
  // before a single Stripe call is made.
  // ---------------------------------------------------------------------------

  const AUDIO_TYPES = new Set([
    'audio/webm', 'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp3',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav',
  ]);

  router.post(
    '/drafts',
    express.raw({ type: () => true, limit: '25mb' }),
    async (req, res, next) => {
      try {
        const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!AUDIO_TYPES.has(contentType)) {
          return res.status(415).json({ error: `Unsupported audio type: ${contentType || 'none'}` });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: 'Recording was empty' });
        }

        const draft = await createDraft({ audio_type: contentType, audio_bytes: req.body.length });
        // Respond immediately; the UI polls the draft for real stage progress.
        res.status(202).json({ draft_id: draft.draft_id, status: draft.status, stage: draft.stage });

        processDraftAudio(draft.draft_id, req.body, contentType)
          .catch((err) => console.error('[draft] processing crashed:', err.message));
      } catch (err) { next(err); }
    },
  );

  // Rescue path for a voice note the automatic gate refused to bill.
  //
  // The transcript and the extraction already exist; what was missing was a
  // human. This turns that stored job into a reviewable draft so the work does
  // not have to be re-recorded. It creates nothing in Stripe — the draft still
  // has to go through the same finalize gate as any other.
  router.post('/jobs/:id/draft', async (req, res, next) => {
    try {
      const jobs = await readJobs();
      const job = jobs.find((record) => record.job_id === req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.stripe?.invoice_id) {
        return res.status(409).json({ error: 'This job already has an invoice' });
      }
      if (!job.transcript_raw) {
        return res.status(409).json({ error: 'This job has no transcript to work from' });
      }

      // Re-opening the same job returns the draft already in progress rather
      // than quietly creating a second one.
      const existing = (await listDrafts())
        .find((draft) => draft.from_job_id === job.job_id && !draft.finalized_job_id);
      if (existing) return res.json({ draft_id: existing.draft_id, reused: true });

      const parts = (job.parts_used ?? []).filter((p) => p && typeof p.item === 'string');
      const draft = await createDraft({
        status: 'ready',
        stage: 'ready',
        from_job_id: job.job_id,
        transcript_raw: job.transcript_raw,
        llm_output_raw: job.llm_output_raw ?? null,
        extraction: null,
        // The original blocking reasons stay visible as advisory flags — they are
        // exactly what the reviewer needs to resolve.
        validation: {
          blocking: job.validation?.blocking ?? [],
          warnings: job.validation?.warnings ?? [],
        },
        suggested_parts: parts.map((part, index) => ({
          id: `part_${index + 1}`,
          item: part.item,
          quantity: part.quantity ?? 1,
        })),
        stated_total: job.amount_to_charge ?? null,
        stated_hours: job.hours_logged ?? null,
        invoice: buildInvoiceDocument(job, null),
      });

      res.status(201).json({ draft_id: draft.draft_id, reused: false });
    } catch (err) { next(err); }
  });

  // A draft with nothing in it, for the times there is no recording to work from.
  // It joins the same review flow and passes the same finalize gate as any other.
  router.post('/drafts/blank', async (_req, res, next) => {
    try {
      const today = new Date();
      const due = new Date();
      due.setDate(due.getDate() + config.daysUntilDue);

      const draft = await createDraft({
        status: 'ready',
        stage: 'ready',
        source: 'manual',
        transcript_raw: null,
        validation: { blocking: [], warnings: [] },
        suggested_parts: [],
        stated_total: null,
        invoice: {
          customer: { name: '', email: '', address: '' },
          issue_date: today.toISOString().slice(0, 10),
          due_date: due.toISOString().slice(0, 10),
          line_items: [{ id: 'line_1', description: '', quantity: 1, unit_price: 0 }],
          tax_rate: 0,
          discount: { type: 'amount', value: 0 },
          notes: '',
        },
      });
      res.status(201).json({ draft_id: draft.draft_id });
    } catch (err) { next(err); }
  });

  router.get('/drafts', async (_req, res, next) => {
    try {
      const drafts = await listDrafts();
      res.json({
        drafts: drafts.map((draft) => ({
          draft_id: draft.draft_id,
          status: draft.status,
          stage: draft.stage,
          created_at: draft.created_at,
          customer_name: draft.invoice?.customer?.name || null,
          total: draft.invoice ? computeTotals(draft.invoice).total : null,
          finalized_job_id: draft.finalized_job_id,
          from_job_id: draft.from_job_id ?? null,
        })),
        currency: config.currency,
      });
    } catch (err) { next(err); }
  });

  const withTotals = (draft) => ({
    ...draft,
    totals: draft.invoice ? computeTotals(draft.invoice) : null,
    currency: config.currency,
    business_name: config.businessName,
    limits: { max_amount: config.limits.maxAmount },
  });

  router.get('/drafts/:id', async (req, res, next) => {
    try {
      const draft = await getDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      res.json(withTotals(draft));
    } catch (err) { next(err); }
  });

  // Whitelists every field. Client input is never spread into storage, and the
  // client can never send a total — totals are always recomputed from line items.
  function sanitizeInvoice(input, previous) {
    const str = (value, max, fallback = '') =>
      (typeof value === 'string' ? value.slice(0, max) : fallback);
    const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

    const lines = Array.isArray(input?.line_items) ? input.line_items.slice(0, 40) : previous.line_items;

    return {
      customer: {
        name: str(input?.customer?.name, 100, previous.customer.name),
        email: str(input?.customer?.email, 200, previous.customer.email),
        address: str(input?.customer?.address, 300, previous.customer.address),
      },
      issue_date: str(input?.issue_date, 10, previous.issue_date),
      due_date: str(input?.due_date, 10, previous.due_date),
      line_items: lines.map((line, index) => ({
        id: str(line?.id, 40, `line_${index + 1}`) || `line_${index + 1}`,
        description: str(line?.description, 200),
        quantity: num(line?.quantity, 1),
        unit_price: num(line?.unit_price, 0),
      })),
      tax_rate: num(input?.tax_rate, previous.tax_rate),
      discount: {
        type: input?.discount?.type === 'percent' ? 'percent' : 'amount',
        value: num(input?.discount?.value, 0),
      },
      notes: str(input?.notes, 1000, previous.notes),
    };
  }

  router.patch('/drafts/:id', express.json({ limit: '256kb' }), async (req, res, next) => {
    try {
      const draft = await getDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      if (draft.finalized_job_id) return res.status(409).json({ error: 'This draft has already been invoiced' });
      if (!draft.invoice) return res.status(409).json({ error: 'Draft is still processing' });

      const invoice = sanitizeInvoice(req.body?.invoice, draft.invoice);
      const updated = await updateDraft(req.params.id, { invoice });
      res.json(withTotals(updated));
    } catch (err) { next(err); }
  });

  router.delete('/drafts/:id', async (req, res, next) => {
    try {
      const removed = await deleteDraft(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Draft not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // The only route in the application that can create an invoice.
  router.post('/drafts/:id/finalize', express.json({ limit: '64kb' }), async (req, res, next) => {
    try {
      const draft = await getDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      if (draft.finalized_job_id) {
        return res.status(409).json({ error: 'This draft has already been invoiced', job_id: draft.finalized_job_id });
      }
      if (!draft.invoice) return res.status(409).json({ error: 'Draft is still processing' });

      // 1. A human must explicitly confirm.
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: 'Explicit confirmation is required to create an invoice' });
      }

      // 2. The document must pass server-side validation.
      const check = validateInvoiceDocument(draft.invoice, config.limits, draft.stated_total);
      if (!check.ok) {
        return res.status(422).json({ error: 'Invoice is not ready to send', blocking: check.blocking });
      }

      // 3. The total the reviewer saw must equal the total the server computed.
      const expected = toCents(req.body?.expected_total);
      if (expected !== check.totals.total_cents) {
        return res.status(409).json({
          error: 'The invoice changed since you reviewed it. Refresh and check the total before sending.',
          shown_total: req.body?.expected_total ?? null,
          actual_total: check.totals.total,
        });
      }

      const jobId = `job_web_${randomUUID()}`;
      const started = Date.now();
      let stripe = null;
      let status = 'invoiced';
      let error = null;

      try {
        stripe = await createInvoiceFromDocument({ jobId, invoice: draft.invoice, totals: check.totals });
      } catch (err) {
        status = 'invoice_failed';
        error = err.message;
        stripe = err.stripePartial ?? null;
      }

      // Web invoices land in the same append-only audit log as WhatsApp jobs.
      const record = {
        job_id: jobId,
        status,
        failed_stage: status === 'invoice_failed' ? 'invoice' : null,
        customer_name: draft.invoice.customer.name,
        work_performed: draft.invoice.line_items[0]?.description ?? null,
        parts_used: (draft.extraction?.parts_used ?? []).filter((p) => p && typeof p.item === 'string'),
        hours_logged: draft.stated_hours ?? null,
        amount_to_charge: check.totals.total,
        follow_up_required: Boolean(draft.extraction?.follow_up_required),
        technician_number: 'web-app',
        timestamp: new Date().toISOString(),
        transcript_raw: draft.transcript_raw,
        message_sid: null,
        source: 'web',
        validation: {
          blocking: [],
          warnings: [...(draft.validation?.warnings ?? []), ...check.warnings],
        },
        llm_output_raw: draft.llm_output_raw,
        stripe,
        error,
        processing_ms: Date.now() - started,
        invoice_document: { ...draft.invoice, totals: check.totals },
        draft_id: draft.draft_id,
      };
      await appendJob(record);
      await updateDraft(req.params.id, { finalized_job_id: jobId, status: 'finalized', stage: 'finalized' });

      res.status(status === 'invoiced' ? 201 : 502).json({ job_id: jobId, status, stripe, error, totals: check.totals });
    } catch (err) { next(err); }
  });

  return router;
}
