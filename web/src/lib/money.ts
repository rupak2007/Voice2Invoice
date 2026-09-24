import type { InvoiceDoc } from './types';

/**
 * Mirrors src/money.js exactly so the editor can show totals while typing.
 *
 * The server never trusts this: on send we pass the total shown here as
 * `expected_total`, and the server rejects the request if its own arithmetic
 * disagrees. This is a display convenience, not the source of truth.
 */
const round = (n: number) => Math.round(n + Number.EPSILON);

export const toCents = (value: number) => round(Number(value) * 100);
export const fromCents = (cents: number) => cents / 100;

export interface Totals {
  subtotal_cents: number;
  discount_cents: number;
  taxable_cents: number;
  tax_cents: number;
  total_cents: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function computeTotals(invoice: InvoiceDoc): Totals {
  const lines = Array.isArray(invoice?.line_items) ? invoice.line_items : [];

  let subtotalCents = 0;
  for (const line of lines) {
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unit_price);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) continue;
    subtotalCents += round(quantity * unitPrice * 100);
  }

  const discountValue = Number(invoice?.discount?.value) || 0;
  let discountCents = invoice?.discount?.type === 'percent'
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

export function lineAmount(quantity: number, unitPrice: number) {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return fromCents(round(q * p * 100));
}
