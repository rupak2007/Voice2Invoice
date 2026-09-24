import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExtraction } from '../src/validate.js';

const limits = { maxAmount: 10000, maxHours: 24 };
const T = 'Just replaced the water heater for Bob Vance, used one 50-gallon unit and two fittings, took about two hours, charge $250.';
const base = () => ({
  customer_name: 'Bob Vance', work_performed: 'Replaced water heater',
  parts_used: [{ item: '50-gallon water heater unit', quantity: 1 }, { item: 'fittings', quantity: 2 }],
  hours_logged: 2, amount_to_charge: 250, follow_up_required: false,
  missing_fields: [], ambiguities: [],
});
const has = (arr, s) => arr.some((x) => x.includes(s));

test('happy path passes cleanly', () => {
  const v = validateExtraction(base(), T, limits);
  assert.equal(v.ok, true);
  assert.equal(v.job.amount_to_charge, 250);
  assert.equal(v.job.parts_used.length, 2);
  assert.deepEqual(v.warnings, []);
});

test('missing amount blocks invoice', () => {
  const v = validateExtraction({ ...base(), amount_to_charge: null, missing_fields: ['amount_to_charge'] }, T, limits);
  assert.equal(v.ok, false);
  assert.ok(has(v.blocking, 'amount not stated'));
});

test('ambiguity blocks invoice', () => {
  const v = validateExtraction({ ...base(), amount_to_charge: null, ambiguities: ["amount unclear: 'fifteen or fifty'"] }, T, limits);
  assert.equal(v.ok, false);
  assert.ok(has(v.blocking, 'ambiguous'));
});

test('hallucinated part is dropped, invoice still allowed', () => {
  const raw = base();
  raw.parts_used.push({ item: 'copper pipe', quantity: 3 });
  const v = validateExtraction(raw, T, limits);
  assert.equal(v.ok, true);
  assert.equal(v.job.parts_used.length, 2);
  assert.ok(has(v.warnings, 'copper pipe'));
});

test('customer name not in transcript blocks', () => {
  const v = validateExtraction({ ...base(), customer_name: 'Robert Vance' }, T, limits);
  assert.equal(v.ok, false);
});

test('amount out of range blocks', () => {
  assert.equal(validateExtraction({ ...base(), amount_to_charge: -5 }, T, limits).ok, false);
  assert.equal(validateExtraction({ ...base(), amount_to_charge: 50000 }, T, limits).ok, false);
  assert.equal(validateExtraction({ ...base(), amount_to_charge: '$250' }, T, limits).ok, false);
});

test('numeric string amount is converted with a warning', () => {
  const v = validateExtraction({ ...base(), amount_to_charge: '250' }, T, limits);
  assert.equal(v.ok, true);
  assert.equal(v.job.amount_to_charge, 250);
  assert.ok(has(v.warnings, 'converted'));
});

test('spoken amount passes with verify warning', () => {
  const spoken = T.replace('$250', 'two-fifty');
  const v = validateExtraction(base(), spoken, limits);
  assert.equal(v.ok, true);
  assert.ok(has(v.warnings, 'not stated as digits'));
});

test('contradictory extraction blocks', () => {
  const v = validateExtraction({ ...base(), missing_fields: ['amount_to_charge'] }, T, limits);
  assert.equal(v.ok, false);
});

test('non-object output blocks', () => {
  assert.equal(validateExtraction(null, T, limits).ok, false);
  assert.equal(validateExtraction([], T, limits).ok, false);
});
