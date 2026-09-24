// The finalize guards. This is the only route in the application that can create
// an invoice, so each refusal is tested explicitly. None of these cases reach
// Stripe: every one of them returns before any network call is made.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

let server;
let baseUrl;
let dir;
let createDraft;
let getDraft;
let appendJob;

before(async () => {
  // Point the store at a temp directory before config is imported, so the suite
  // never touches real job or draft data.
  dir = await mkdtemp(join(tmpdir(), 'v2i-drafts-'));
  process.env.JOBS_FILE = join(dir, 'jobs.jsonl');

  const { createApiRouter } = await import('../src/api.js');
  ({ createDraft, getDraft } = await import('../src/drafts.js'));
  ({ appendJob } = await import('../src/store.js'));

  const app = express();
  app.use('/api', createApiRouter());
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

const readyDraft = (overrides = {}) => createDraft({
  status: 'ready',
  stage: 'ready',
  transcript_raw: 'Replaced the water heater for Bob Vance. Charge 250 dollars.',
  validation: { blocking: [], warnings: [] },
  suggested_parts: [],
  stated_total: 250,
  invoice: {
    customer: { name: 'Bob Vance', email: '', address: '' },
    issue_date: '2026-09-23',
    due_date: '2026-09-30',
    line_items: [{ id: 'line_1', description: 'Replaced water heater', quantity: 1, unit_price: 250 }],
    tax_rate: 0,
    discount: { type: 'amount', value: 0 },
    notes: '',
  },
  ...overrides,
});

const post = (path, body) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('totals are recomputed server-side from the line items', async () => {
  const draft = await readyDraft();
  const res = await fetch(`${baseUrl}/api/drafts/${draft.draft_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice: {
        ...draft.invoice,
        line_items: [
          { id: 'l1', description: 'Labour', quantity: 2, unit_price: 80 },
          { id: 'l2', description: 'Parts', quantity: 1, unit_price: 90 },
        ],
        tax_rate: 8.5,
        discount: { type: 'percent', value: 10 },
      },
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  // 250 subtotal, 25 discount, 8.5% of 225 = 19.13
  assert.equal(body.totals.subtotal, 250);
  assert.equal(body.totals.discount, 25);
  assert.equal(body.totals.tax, 19.13);
  assert.equal(body.totals.total, 244.13);
});

test('a client-supplied total is ignored entirely', async () => {
  const draft = await readyDraft();
  const res = await fetch(`${baseUrl}/api/drafts/${draft.draft_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice: { ...draft.invoice, total: 5, totals: { total: 5 }, total_cents: 500 },
    }),
  });
  const body = await res.json();
  assert.equal(body.totals.total, 250);
});

test('finalize without an explicit confirmation is refused', async () => {
  const draft = await readyDraft();
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { expected_total: 250 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /confirmation/i);
  assert.equal((await getDraft(draft.draft_id)).finalized_job_id, null);
});

test('finalize is refused when the reviewer saw a different total', async () => {
  const draft = await readyDraft();
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { confirm: true, expected_total: 100 });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.actual_total, 250);
  assert.equal((await getDraft(draft.draft_id)).finalized_job_id, null);
});

test('finalize is refused when the document itself is invalid', async () => {
  const draft = await readyDraft({
    invoice: {
      customer: { name: '', email: '', address: '' },
      issue_date: '2026-09-23',
      due_date: '2026-09-30',
      line_items: [{ id: 'line_1', description: 'Work', quantity: 1, unit_price: 250 }],
      tax_rate: 0,
      discount: { type: 'amount', value: 0 },
      notes: '',
    },
  });
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { confirm: true, expected_total: 250 });
  const body = await res.json();
  assert.equal(res.status, 422);
  assert.ok(body.blocking.some((b) => /customer name/i.test(b)));
});

test('a zero-total invoice cannot be finalized', async () => {
  const draft = await readyDraft({
    invoice: {
      customer: { name: 'Bob Vance', email: '', address: '' },
      issue_date: '2026-09-23',
      due_date: '2026-09-30',
      line_items: [{ id: 'line_1', description: 'Freebie', quantity: 1, unit_price: 0 }],
      tax_rate: 0,
      discount: { type: 'amount', value: 0 },
      notes: '',
    },
  });
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { confirm: true, expected_total: 0 });
  assert.equal(res.status, 422);
});

test('an already finalized draft cannot be billed twice', async () => {
  const draft = await readyDraft({ finalized_job_id: 'job_web_existing' });
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { confirm: true, expected_total: 250 });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.job_id, 'job_web_existing');
});

test('a draft that is still processing cannot be finalized', async () => {
  const draft = await createDraft({ status: 'processing', stage: 'transcribing' });
  const res = await post(`/api/drafts/${draft.draft_id}/finalize`, { confirm: true, expected_total: 250 });
  assert.equal(res.status, 409);
});

test('uploading a non-audio body is rejected before any processing', async () => {
  const res = await fetch(`${baseUrl}/api/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: 'not audio',
  });
  assert.equal(res.status, 415);
});

// ---------------------------------------------------------------------------
// Rebuilding a blocked voice note as a draft. This is how a job the automatic
// gate refused reaches an invoice without being re-recorded.
// ---------------------------------------------------------------------------

const blockedJob = (overrides = {}) => ({
  job_id: `job_blocked_${Math.random().toString(36).slice(2)}`,
  status: 'needs_review',
  failed_stage: null,
  customer_name: 'Maria Lopez',
  work_performed: 'Panel upgrade',
  parts_used: [{ item: '200 amp breaker panel', quantity: 1 }],
  hours_logged: 3,
  amount_to_charge: null,
  transcript_raw: "Finished the panel upgrade at Maria Lopez's place. Didn't get to pricing yet.",
  validation: { blocking: ['amount not stated'], warnings: [] },
  llm_output_raw: '{}',
  stripe: null,
  timestamp: new Date().toISOString(),
  ...overrides,
});

test('a blocked job can be rebuilt as a reviewable draft', async () => {
  const job = blockedJob();
  await appendJob(job);

  const res = await fetch(`${baseUrl}/api/jobs/${job.job_id}/draft`, { method: 'POST' });
  const body = await res.json();
  assert.equal(res.status, 201);

  const draft = await getDraft(body.draft_id);
  assert.equal(draft.from_job_id, job.job_id);
  assert.equal(draft.invoice.customer.name, 'Maria Lopez');
  assert.equal(draft.transcript_raw, job.transcript_raw);
  // The model stated no price, so the line carries none. A human types it.
  assert.equal(draft.invoice.line_items[0].unit_price, 0);
  assert.equal(draft.stated_total, null);
  // The original blocking reason survives as an advisory flag to resolve.
  assert.deepEqual(draft.validation.blocking, ['amount not stated']);
  // Parts stay unpriced suggestions.
  assert.equal(draft.suggested_parts[0].item, '200 amp breaker panel');
});

test('rebuilding the same job twice reuses the draft in progress', async () => {
  const job = blockedJob();
  await appendJob(job);

  const first = await (await fetch(`${baseUrl}/api/jobs/${job.job_id}/draft`, { method: 'POST' })).json();
  const second = await fetch(`${baseUrl}/api/jobs/${job.job_id}/draft`, { method: 'POST' });
  const body = await second.json();
  assert.equal(body.reused, true);
  assert.equal(body.draft_id, first.draft_id);
});

test('a job that already has an invoice cannot be rebuilt', async () => {
  const job = blockedJob({ status: 'invoiced', stripe: { invoice_id: 'in_123' } });
  await appendJob(job);

  const res = await fetch(`${baseUrl}/api/jobs/${job.job_id}/draft`, { method: 'POST' });
  assert.equal(res.status, 409);
});

test('rebuilding an unknown job is a 404', async () => {
  const res = await fetch(`${baseUrl}/api/jobs/job_does_not_exist/draft`, { method: 'POST' });
  assert.equal(res.status, 404);
});

test('a blank draft starts empty and still has to pass the send gate', async () => {
  const res = await fetch(`${baseUrl}/api/drafts/blank`, { method: 'POST' });
  const body = await res.json();
  assert.equal(res.status, 201);

  const draft = await getDraft(body.draft_id);
  assert.equal(draft.status, 'ready');
  assert.equal(draft.source, 'manual');
  assert.equal(draft.transcript_raw, null);
  assert.equal(draft.stated_total, null);
  assert.equal(draft.invoice.customer.name, '');
  assert.equal(draft.invoice.line_items[0].unit_price, 0);

  // Empty means unsendable: no customer and a zero total both block it.
  const finalize = await post(`/api/drafts/${body.draft_id}/finalize`, {
    confirm: true, expected_total: 0,
  });
  assert.equal(finalize.status, 422);
});
