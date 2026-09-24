import type { InvoiceDoc } from '../lib/types';
import type { Totals } from '../lib/money';
import { lineAmount } from '../lib/money';

interface Props {
  invoice: InvoiceDoc;
  totals: Totals | { subtotal: number; discount: number; tax: number; total: number };
  currency: string;
  businessName: string;
  invoiceNumber?: string | null;
  stamp?: { label: string; tone: 'draft' | 'issued' | 'paid' | 'void' } | null;
  /** Exactly one h1 per page: the document owns it only when it is the page. */
  headingLevel?: 'h1' | 'h2';
  density?: 'default' | 'compact';
  /** Shown under the totals — real terms, never invented payment status. */
  paymentNote?: string | null;
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2,
  }).format(value);

const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STAMP: Record<string, string> = {
  draft: 'border-line bg-elevated text-muted',
  issued: 'border-accent-line bg-accent-soft text-accent',
  paid: 'border-success-line bg-success-soft text-success',
  void: 'border-danger-line bg-danger-soft text-danger',
};

/**
 * The invoice as the customer receives it.
 *
 * It sits one surface layer above the page and never glows — the document is
 * the calm end of the workflow. The same component renders the live preview and
 * the stored record, so what you approve cannot drift from what is kept.
 */
export function InvoiceDocument({
  invoice, totals, currency, businessName, invoiceNumber = null, stamp = null,
  headingLevel: Heading = 'h2', density = 'default', paymentNote = null,
}: Props) {
  const compact = density === 'compact';
  const pad = compact ? 'px-6 py-7' : 'px-7 py-8 sm:px-10 sm:py-11';

  return (
    <article className={`print-sheet rounded-xl border border-line bg-raised ${pad}`}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <Heading className={`display text-ink ${compact ? 'text-[22px]' : 'text-[28px]'}`}>
            Invoice
          </Heading>
          {invoiceNumber && (
            <p className="tabular mt-2 font-mono text-[11.5px] tracking-wide text-muted">{invoiceNumber}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold tracking-tight text-ink">{businessName}</p>
          {stamp && (
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold
              uppercase tracking-[0.08em] ${STAMP[stamp.tone]}`}>
              {stamp.label}
            </span>
          )}
        </div>
      </header>

      <div className={`grid gap-6 ${compact ? 'mt-7' : 'mt-9 sm:grid-cols-[1.5fr_1fr]'}`}>
        <div className="min-w-0">
          <p className="eyebrow">Billed to</p>
          <p className="mt-2 truncate text-[15px] font-semibold tracking-tight text-ink">
            {invoice.customer.name || <span className="font-normal text-muted">Not set</span>}
          </p>
          {invoice.customer.email && (
            <p className="mt-1 truncate text-[12.5px] text-muted">{invoice.customer.email}</p>
          )}
          {invoice.customer.address && (
            <p className="mt-1 whitespace-pre-line text-[12.5px] text-muted">{invoice.customer.address}</p>
          )}
        </div>
        <dl className={compact
          ? 'flex flex-wrap gap-x-8 gap-y-2 border-t border-line-soft pt-4'
          : 'grid grid-cols-2 gap-x-6 gap-y-3 sm:justify-self-end sm:text-right'}>
          <div>
            <dt className="eyebrow">Issued</dt>
            <dd className="tabular mt-1.5 whitespace-nowrap text-[12.5px] text-ink">
              {longDate(invoice.issue_date)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Due</dt>
            <dd className="tabular mt-1.5 whitespace-nowrap text-[12.5px] text-ink">
              {longDate(invoice.due_date)}
            </dd>
          </div>
        </dl>
      </div>

      <table className={`w-full ${compact ? 'mt-7' : 'mt-9'}`}>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="eyebrow pb-2.5 text-left">Description</th>
            <th scope="col" className="eyebrow pb-2.5 pl-4 text-right">Qty</th>
            {!compact && <th scope="col" className="eyebrow pb-2.5 pl-4 text-right">Rate</th>}
            <th scope="col" className="eyebrow pb-2.5 pl-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.length === 0 && (
            <tr>
              <td colSpan={compact ? 3 : 4} className="py-7 text-center text-[12.5px] text-muted">
                No line items yet
              </td>
            </tr>
          )}
          {invoice.line_items.map((line, i) => (
            <tr key={line.id ?? i} className="border-b border-line-soft align-top">
              <td className="py-3.5 pr-4 text-[13px] text-ink">
                {line.description || <span className="text-muted">Untitled item</span>}
              </td>
              <td className="tabular py-3.5 pl-4 text-right text-[13px] text-dim">{line.quantity}</td>
              {!compact && (
                <td className="tabular py-3.5 pl-4 text-right text-[13px] text-dim">
                  {money(Number(line.unit_price) || 0, currency)}
                </td>
              )}
              <td className="tabular py-3.5 pl-4 text-right text-[13px] font-medium text-ink">
                {money(lineAmount(line.quantity, line.unit_price), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <dl className="w-full max-w-[300px] text-[12.5px]">
          <div className="flex items-baseline justify-between py-1.5">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular text-dim">{money(totals.subtotal, currency)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex items-baseline justify-between py-1.5">
              <dt className="text-muted">
                Discount{invoice.discount.type === 'percent' ? ` (${invoice.discount.value}%)` : ''}
              </dt>
              <dd className="tabular text-dim">−{money(totals.discount, currency)}</dd>
            </div>
          )}
          {totals.tax > 0 && (
            <div className="flex items-baseline justify-between py-1.5">
              <dt className="text-muted">Tax ({invoice.tax_rate}%)</dt>
              <dd className="tabular text-dim">{money(totals.tax, currency)}</dd>
            </div>
          )}
          <div className="mt-2.5 flex items-baseline justify-between border-t border-line-strong pt-3.5">
            <dt className="text-[12.5px] font-semibold text-ink">Total due</dt>
            <dd className={`tabular display text-ink ${compact ? 'text-[22px]' : 'text-[26px]'}`}>
              {money(totals.total, currency)}
            </dd>
          </div>
        </dl>
      </div>

      {(paymentNote || invoice.notes?.trim()) && (
        <footer className="mt-8 grid gap-5 border-t border-line-soft pt-5 sm:grid-cols-2">
          {paymentNote && (
            <div>
              <p className="eyebrow">Payment</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{paymentNote}</p>
            </div>
          )}
          {invoice.notes?.trim() && (
            <div>
              <p className="eyebrow">Notes</p>
              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">
                {invoice.notes}
              </p>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
