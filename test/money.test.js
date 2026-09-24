// The invoice arithmetic and the human-review gate. Everything here runs
// server-side; the browser never supplies a total.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, validateInvoiceDocument } from '../src/money.js';

const limits = { maxAmount: 10000, maxHours: 24 };

const doc = (overrides = {}) => ({
  customer: { name: 'Bob Vance', email: '', address: '' },
  issue_date: '2026-09-23',
  due_date: '2026-09-30',
  line_items: [{ id: 'line_1', description: 'Replaced water heater', quantity: 1, unit_price: 250 }],
  tax_rate: 0,
  discount: { type: 'amount', value: 0 },
  notes: '',
  ...overrides,
});

test('a single line totals to its unit price', () => {
  const totals = computeTotals(doc());
  assert.equal(totals.subtotal, 250);
  assert.equal(totals.total, 250);
  assert.equal(totals.total_cents, 25000);
});

test('quantities multiply and several lines sum', () => {
  const totals = computeTotals(doc({
    line_items: [
      { description: 'Labour', quantity: 2, unit_price: 90 },
      { description: 'Fittings', quantity: 3, unit_price: 12.5 },
    ],
  }));
  assert.equal(totals.subtotal, 217.5);
});

test('fractional quantities round to whole cents', () => {
  const totals = computeTotals(doc({
    line_items: [{ description: 'Labour', quantity: 2.5, unit_price: 90 }],
  }));
  assert.equal(totals.total_cents, 22500);
});

test('tax applies after the discount, not before', () => {
  const totals = computeTotals(doc({
    line_items: [{ description: 'Work', quantity: 1, unit_price: 100 }],
    discount: { type: 'amount', value: 20 },
    tax_rate: 10,
  }));
  assert.equal(totals.discount, 20);
  assert.equal(totals.taxable_cents, 8000);
  assert.equal(totals.tax, 8);
  assert.equal(totals.total, 88);
});

test('a percentage discount is taken off the subtotal', () => {
  const totals = computeTotals(doc({ discount: { type: 'percent', value: 10 } }));
  assert.equal(totals.discount, 25);
  assert.equal(totals.total, 225);
});

test('a discount can never exceed the subtotal or go negative', () => {
  assert.equal(computeTotals(doc({ discount: { type: 'amount', value: 9999 } })).total, 0);
  assert.equal(computeTotals(doc({ discount: { type: 'amount', value: -50 } })).total, 250);
});

test('a complete document passes review', () => {
  const result = validateInvoiceDocument(doc(), limits, 250);
  assert.equal(result.ok, true);
  assert.deepEqual(result.blocking, []);
  assert.deepEqual(result.warnings, []);
});

test('a missing customer name blocks sending', () => {
  const result = validateInvoiceDocument(doc({ customer: { name: '  ', email: '', address: '' } }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('Customer name')));
});

test('an invoice with no line items blocks sending', () => {
  const result = validateInvoiceDocument(doc({ line_items: [] }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('at least one line item')));
});

test('a zero or negative quantity blocks sending', () => {
  const result = validateInvoiceDocument(doc({
    line_items: [{ description: 'Work', quantity: 0, unit_price: 100 }],
  }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('quantity must be greater than 0')));
});

test('sub-cent unit prices block sending', () => {
  const result = validateInvoiceDocument(doc({
    line_items: [{ description: 'Work', quantity: 1, unit_price: 10.005 }],
  }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('decimal places')));
});

test('a total of zero cannot be sent', () => {
  const result = validateInvoiceDocument(doc({
    line_items: [{ description: 'Freebie', quantity: 1, unit_price: 0 }],
  }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('greater than 0')));
});

test('a total above the configured ceiling cannot be sent', () => {
  const result = validateInvoiceDocument(doc({
    line_items: [{ description: 'Work', quantity: 1, unit_price: 50000 }],
  }), limits);
  assert.equal(result.ok, false);
  assert.ok(result.blocking.some((b) => b.includes('exceeds the limit')));
});

test('an out-of-range tax rate blocks sending', () => {
  assert.equal(validateInvoiceDocument(doc({ tax_rate: 140 }), limits).ok, false);
  assert.equal(validateInvoiceDocument(doc({ tax_rate: -5 }), limits).ok, false);
});

test('a malformed email blocks sending', () => {
  const result = validateInvoiceDocument(doc({
    customer: { name: 'Bob Vance', email: 'not-an-email', address: '' },
  }), limits);
  assert.equal(result.ok, false);
});

test('editing away from the spoken total warns but does not block', () => {
  const result = validateInvoiceDocument(doc({
    line_items: [{ description: 'Work', quantity: 1, unit_price: 400 }],
  }), limits, 250);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes('differs from the 250.00 stated')));
});
