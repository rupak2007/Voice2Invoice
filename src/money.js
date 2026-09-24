// Single source of truth for invoice arithmetic.
//
// Everything is computed in integer cents, server-side, from the line items.
// The browser never supplies a total: it sends line items and echoes the total it
// displayed, and the server rejects the finalize if its own arithmetic disagrees.
// That is what stops "the user saw $250 but we billed $2,500".

const round = (n) => Math.round(n + Number.EPSILON);

export const toCents = (value) => round(Number(value) * 100);
export const fromCents = (cents) => cents / 100;

/**
 * @param {object} invoice - { line_items, tax_rate, discount }
 * @returns {{ subtotal_cents, discount_cents, taxable_cents, tax_cents, total_cents,
 *             subtotal, discount, tax, total }}
 */
export function computeTotals(invoice) {
  const lines = Array.isArray(invoice?.line_items) ? invoice.line_items : [];

  let subtotalCents = 0;
  for (const line of lines) {
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unit_price);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) continue;
    subtotalCents += round(quantity * unitPrice * 100);
  }

  const discount = invoice?.discount ?? { type: 'amount', value: 0 };
  const discountValue = Number(discount?.value) || 0;
  let discountCents = discount?.type === 'percent'
    ? round(subtotalCents * (discountValue / 100))
    : toCents(discountValue);
  discountCents = Math.min(Math.max(discountCents, 0), Math.max(subtotalCents, 0));

  const taxableCents = subtotalCents - discountCents;
  const taxRate = Number(invoice?.tax_rate) || 0;
  const taxCents = round(taxableCents * (taxRate / 100));
  const totalCents = taxableCents + taxCents;

  return {
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    taxable_cents: taxableCents,
    tax_cents: taxCents,
    total_cents: totalCents,
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    tax: fromCents(taxCents),
    total: fromCents(totalCents),
  };
}

const MAX_LINES = 40;

/**
 * Validates the human-edited invoice document before it may reach Stripe.
 * Mirrors the spirit of src/validate.js: nothing uncertain gets billed.
 * @returns {{ ok: boolean, blocking: string[], warnings: string[], totals: object }}
 */
export function validateInvoiceDocument(invoice, limits, statedTotal = null) {
  const blocking = [];
  const warnings = [];

  const name = typeof invoice?.customer?.name === 'string' ? invoice.customer.name.trim() : '';
  if (!name) blocking.push('Customer name is required');
  else if (name.length > 100) blocking.push('Customer name is too long');

  const email = typeof invoice?.customer?.email === 'string' ? invoice.customer.email.trim() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) blocking.push('Customer email is not a valid address');

  const lines = Array.isArray(invoice?.line_items) ? invoice.line_items : null;
  if (!lines) blocking.push('Line items must be a list');
  else if (lines.length === 0) blocking.push('Add at least one line item');
  else if (lines.length > MAX_LINES) blocking.push(`Too many line items (max ${MAX_LINES})`);
  else {
    lines.forEach((line, index) => {
      const label = `Line ${index + 1}`;
      const description = typeof line?.description === 'string' ? line.description.trim() : '';
      if (!description) blocking.push(`${label}: description is required`);

      const quantity = Number(line?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) blocking.push(`${label}: quantity must be greater than 0`);
      else if (quantity > 10000) blocking.push(`${label}: quantity is unrealistically large`);

      const unitPrice = Number(line?.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) blocking.push(`${label}: unit price must be 0 or more`);
      else if (Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) > 1e-6) {
        blocking.push(`${label}: unit price has more than 2 decimal places`);
      }
    });
  }

  const taxRate = Number(invoice?.tax_rate) || 0;
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) blocking.push('Tax rate must be between 0 and 100');

  const discountValue = Number(invoice?.discount?.value) || 0;
  if (!Number.isFinite(discountValue) || discountValue < 0) blocking.push('Discount cannot be negative');
  if (invoice?.discount?.type === 'percent' && discountValue > 100) blocking.push('Percentage discount cannot exceed 100');

  const totals = computeTotals(invoice);

  if (totals.total_cents <= 0) blocking.push('Invoice total must be greater than 0');
  if (totals.total > limits.maxAmount) {
    blocking.push(`Invoice total ${totals.total} exceeds the limit of ${limits.maxAmount}`);
  }

  // The amount the technician actually said out loud stays visible as a cross-check.
  // A human may legitimately change it, but we never let that happen silently.
  if (statedTotal !== null && statedTotal !== undefined) {
    const statedCents = toCents(statedTotal);
    if (statedCents !== totals.total_cents) {
      warnings.push(
        `Total ${totals.total.toFixed(2)} differs from the ${Number(statedTotal).toFixed(2)} stated in the voice note`,
      );
    }
  }

  return { ok: blocking.length === 0, blocking, warnings, totals };
}
