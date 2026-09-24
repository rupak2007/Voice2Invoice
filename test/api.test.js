// Tests for the dashboard derivations. These rules are what stop the UI from
// ever implying an invoice exists when validation blocked the job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, buildChecks } from '../src/api.js';

const stateOf = (timeline, id) => timeline.find((s) => s.id === id)?.state;

const invoicedJob = () => ({
  status: 'invoiced', failed_stage: null, source: 'voice',
  customer_name: 'Bob Vance', work_performed: 'Replaced water heater',
  parts_used: [{ item: '50 gallon unit', quantity: 1 }, { item: 'fittings', quantity: 2 }],
  hours_logged: 2, amount_to_charge: 250,
  transcript_raw: 'Finished the water heater job for Bob Vance. Charge 250 dollars.',
  validation: { blocking: [], warnings: [] },
});

test('invoiced job shows every pipeline step completed', () => {
  const timeline = buildTimeline(invoicedJob());
  assert.ok(timeline.every((step) => step.state === 'done'));
});

test('needs_review blocks validation and never marks the invoice step done', () => {
  const timeline = buildTimeline({
    ...invoicedJob(),
    status: 'needs_review',
    amount_to_charge: null,
    validation: { blocking: ['amount not stated'], warnings: [] },
  });
  assert.equal(stateOf(timeline, 'extracted'), 'done');
  assert.equal(stateOf(timeline, 'validated'), 'blocked');
  assert.equal(stateOf(timeline, 'invoiced'), 'pending');
});

test('download failure stops the timeline at the download step', () => {
  const timeline = buildTimeline({
    ...invoicedJob(), status: 'failed', failed_stage: 'download', transcript_raw: null,
  });
  assert.equal(stateOf(timeline, 'downloaded'), 'failed');
  assert.equal(stateOf(timeline, 'transcribed'), 'pending');
  assert.equal(stateOf(timeline, 'invoiced'), 'pending');
});

test('transcription failure keeps the download step done', () => {
  const timeline = buildTimeline({
    ...invoicedJob(), status: 'failed', failed_stage: 'transcription', transcript_raw: null,
  });
  assert.equal(stateOf(timeline, 'downloaded'), 'done');
  assert.equal(stateOf(timeline, 'transcribed'), 'failed');
});

test('stripe failure shows validation passed but invoicing failed', () => {
  const timeline = buildTimeline({
    ...invoicedJob(), status: 'invoice_failed', failed_stage: 'invoice',
  });
  assert.equal(stateOf(timeline, 'validated'), 'done');
  assert.equal(stateOf(timeline, 'invoiced'), 'failed');
});

test('text and local jobs mark the audio steps skipped, not done', () => {
  const timeline = buildTimeline({ ...invoicedJob(), source: 'local' });
  assert.equal(stateOf(timeline, 'downloaded'), 'skipped');
  assert.equal(stateOf(timeline, 'transcribed'), 'skipped');
  assert.equal(stateOf(timeline, 'invoiced'), 'done');
});

test('no checks are reported when the job failed before validation ran', () => {
  assert.deepEqual(
    buildChecks({ ...invoicedJob(), status: 'failed', failed_stage: 'extraction' }),
    [],
  );
});

test('happy path reports every check as passing', () => {
  const checks = buildChecks(invoicedJob());
  assert.ok(checks.every((c) => c.state === 'pass'));
  assert.ok(checks.some((c) => c.id === 'amount'));
});

test('a missing amount fails the amount check', () => {
  const checks = buildChecks({
    ...invoicedJob(), status: 'needs_review', amount_to_charge: null,
    validation: { blocking: ['amount not stated'], warnings: [] },
  });
  assert.equal(checks.find((c) => c.id === 'amount')?.state, 'fail');
});

test('an ambiguous amount fails the amount check even though the reason is an ambiguity', () => {
  const checks = buildChecks({
    ...invoicedJob(), status: 'needs_review', amount_to_charge: null,
    validation: { blocking: ["ambiguous: amount unclear: 'fifteen or fifty'"], warnings: [] },
  });
  assert.equal(checks.find((c) => c.id === 'amount')?.state, 'fail');
  assert.equal(checks.find((c) => c.id === 'ambiguity')?.state, 'fail');
});

test('a spoken amount passes with a verify warning rather than failing', () => {
  const checks = buildChecks({
    ...invoicedJob(),
    validation: { blocking: [], warnings: ['amount not stated as digits in transcript — verify'] },
  });
  assert.equal(checks.find((c) => c.id === 'amount')?.state, 'warn');
});

test('a dropped hallucinated part is surfaced as a warning', () => {
  const checks = buildChecks({
    ...invoicedJob(),
    validation: { blocking: [], warnings: ['dropped part not found in transcript: "copper pipe"'] },
  });
  const parts = checks.find((c) => c.id === 'parts');
  assert.equal(parts?.state, 'warn');
  assert.match(parts?.detail ?? '', /copper pipe/);
});

test('ambiguity and structure rows stay hidden when nothing is wrong', () => {
  const ids = buildChecks(invoicedJob()).map((c) => c.id);
  assert.ok(!ids.includes('ambiguity'));
  assert.ok(!ids.includes('structure'));
});
