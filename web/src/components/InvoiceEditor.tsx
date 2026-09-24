import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import type { InvoiceDoc, LineItem, SuggestedPart } from '../lib/types';
import { lineAmount } from '../lib/money';
import { INPUT, LABEL } from './ui';

interface Props {
  invoice: InvoiceDoc;
  onChange: (invoice: InvoiceDoc) => void;
  suggestedParts: SuggestedPart[];
  currency: string;
}

const SYMBOLS: Record<string, string> = { usd: '$', eur: '€', gbp: '£' };
const symbol = (c: string) => SYMBOLS[c.toLowerCase()] ?? c.toUpperCase();

let counter = 0;
const nextId = () => `line_new_${Date.now()}_${(counter += 1)}`;

/** A labelled group. Hairlines and space separate them — not nested boxes. */
function Group({
  title, children, extra,
}: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="border-t border-line-soft pt-6 first:border-0 first:pt-0">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function InvoiceEditor({ invoice, onChange, suggestedParts, currency }: Props) {
  // Numeric fields hold their raw text while being typed so "12." or an empty
  // field is never rewritten under the cursor.
  const [raw, setRaw] = useState<Record<string, string>>({});

  const patch = (changes: Partial<InvoiceDoc>) => onChange({ ...invoice, ...changes });
  const setLine = (i: number, changes: Partial<LineItem>) =>
    patch({ line_items: invoice.line_items.map((l, n) => (n === i ? { ...l, ...changes } : l)) });

  // Zero renders as an empty field: showing a literal "0" means typing "90" into
  // a fresh price lands as "900", which is exactly the error this must not invite.
  const num = (key: string, value: number, apply: (n: number) => void) => ({
    value: raw[key] ?? (Number.isFinite(value) && value !== 0 ? String(value) : ''),
    placeholder: '0',
    inputMode: 'decimal' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setRaw((p) => ({ ...p, [key]: text }));
      const parsed = Number.parseFloat(text);
      apply(Number.isFinite(parsed) ? parsed : 0);
    },
    onBlur: () => setRaw((p) => { const n = { ...p }; delete n[key]; return n; }),
  });

  const addLine = (description = '', quantity = 1) =>
    patch({ line_items: [...invoice.line_items, { id: nextId(), description, quantity, unit_price: 0 }] });
  const removeLine = (i: number) =>
    patch({ line_items: invoice.line_items.filter((_, n) => n !== i) });

  const used = new Set(invoice.line_items.map((l) => l.description.toLowerCase().trim()));
  const unused = suggestedParts.filter((p) => !used.has(p.item.toLowerCase().trim()));

  return (
    <div className="space-y-6">
      <Group title="Customer">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="cust-name">Name</label>
            <input
              id="cust-name"
              className={`${INPUT} mt-1.5`}
              value={invoice.customer.name}
              placeholder="Who is being billed"
              onChange={(e) => patch({ customer: { ...invoice.customer, name: e.target.value } })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="cust-email">
              Email <span className="font-normal text-muted">&mdash; to email it</span>
            </label>
            <input
              id="cust-email"
              type="email"
              className={`${INPUT} mt-1.5`}
              value={invoice.customer.email}
              placeholder="name@example.com"
              onChange={(e) => patch({ customer: { ...invoice.customer, email: e.target.value } })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="cust-address">
              Address <span className="font-normal text-muted">&mdash; optional</span>
            </label>
            <input
              id="cust-address"
              className={`${INPUT} mt-1.5`}
              value={invoice.customer.address}
              placeholder="Street, city"
              onChange={(e) => patch({ customer: { ...invoice.customer, address: e.target.value } })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="issue-date">Issue date</label>
            <input
              id="issue-date" type="date" className={`${INPUT} mt-1.5`}
              value={invoice.issue_date}
              onChange={(e) => patch({ issue_date: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="due-date">Due date</label>
            <input
              id="due-date" type="date" className={`${INPUT} mt-1.5`}
              value={invoice.due_date}
              onChange={(e) => patch({ due_date: e.target.value })}
            />
          </div>
        </div>
      </Group>

      <Group
        title="Line items"
        extra={(
          <span className="text-[12px] text-muted">
            {invoice.line_items.length} {invoice.line_items.length === 1 ? 'line' : 'lines'}
          </span>
        )}
      >
        {/* Wide: a real table, so columns line up and headers are announced. */}
        <div className="hidden sm:block">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className="eyebrow pb-2 text-left">Description</th>
                <th scope="col" className="eyebrow w-16 pb-2 pl-2.5 text-right">Qty</th>
                <th scope="col" className="eyebrow w-24 pb-2 pl-2.5 text-right">Rate</th>
                <th scope="col" className="eyebrow w-20 pb-2 pl-2.5 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((line, i) => (
                <tr key={line.id} className="border-t border-line-soft">
                  <td className="py-2 pr-2.5">
                    <input
                      className={INPUT}
                      value={line.description}
                      placeholder="What was done"
                      aria-label={`Line ${i + 1} description`}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pl-2.5">
                    <input
                      className={`${INPUT} tabular px-2 text-right`}
                      aria-label={`Line ${i + 1} quantity`}
                      {...num(`${line.id}.q`, line.quantity, (n) => setLine(i, { quantity: n }))}
                    />
                  </td>
                  <td className="py-2 pl-2.5">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                        {symbol(currency)}
                      </span>
                      <input
                        className={`${INPUT} tabular pl-5 pr-2 text-right`}
                        aria-label={`Line ${i + 1} rate`}
                        {...num(`${line.id}.p`, line.unit_price, (n) => setLine(i, { unit_price: n }))}
                      />
                    </div>
                  </td>
                  <td className="tabular py-2 pl-2.5 text-right text-[13px] font-medium text-ink">
                    {lineAmount(line.quantity, line.unit_price).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="rounded-md p-1.5 text-muted transition-colors duration-150
                        hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={14} aria-hidden />
                      <span className="sr-only">Remove line {i + 1}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: stacked, so the rate field is never behind a sideways scroll. */}
        <ul className="space-y-3 sm:hidden">
          {invoice.line_items.map((line, i) => (
            <li key={line.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <input
                  className={INPUT}
                  value={line.description}
                  placeholder="What was done"
                  aria-label={`Line ${i + 1} description`}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="shrink-0 rounded-md p-2 text-muted transition-colors duration-150
                    hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden />
                  <span className="sr-only">Remove line {i + 1}</span>
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11.5px] font-medium text-muted" htmlFor={`mq-${line.id}`}>Qty</label>
                  <input
                    id={`mq-${line.id}`}
                    className={`${INPUT} tabular mt-1`}
                    aria-label={`Line ${i + 1} quantity`}
                    {...num(`${line.id}.q`, line.quantity, (n) => setLine(i, { quantity: n }))}
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-medium text-muted" htmlFor={`mp-${line.id}`}>Rate</label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                      {symbol(currency)}
                    </span>
                    <input
                      id={`mp-${line.id}`}
                      className={`${INPUT} tabular pl-6`}
                      aria-label={`Line ${i + 1} rate`}
                      {...num(`${line.id}.p`, line.unit_price, (n) => setLine(i, { unit_price: n }))}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2.5 flex items-baseline justify-between border-t border-line-soft pt-2 text-[12px]">
                <span className="text-muted">Amount</span>
                <span className="tabular text-[13px] font-medium text-ink">
                  {symbol(currency)}{lineAmount(line.quantity, line.unit_price).toFixed(2)}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => addLine()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px]
            font-medium text-accent transition-colors duration-150 hover:bg-accent-soft"
        >
          <Plus size={14} aria-hidden /> Add line
        </button>

        {unused.length > 0 && (
          <div className="mt-4 rounded-xl border border-accent-line bg-accent-soft p-3.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-dim">
              <Sparkles size={13} className="text-accent" aria-hidden />
              Heard in your recording
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Add one, then set its price. The recording named the part, not what it costs.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unused.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => addLine(part.item, part.quantity || 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent-line
                    bg-surface px-3 py-1 text-[12px] text-ink transition-colors duration-150
                    hover:border-accent hover:text-accent"
                >
                  <Plus size={12} aria-hidden />
                  {part.item}
                  {part.quantity > 1 && <span className="tabular text-muted">&times; {part.quantity}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Adjustments">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="discount-value">Discount</label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="discount-value"
                className={`${INPUT} tabular`}
                {...num('discount', invoice.discount.value, (n) =>
                  patch({ discount: { ...invoice.discount, value: n } }))}
              />
              <select
                aria-label="Discount type"
                className={`${INPUT} w-20 shrink-0`}
                value={invoice.discount.type}
                onChange={(e) =>
                  patch({ discount: { ...invoice.discount, type: e.target.value as 'amount' | 'percent' } })}
              >
                <option value="amount">{symbol(currency)}</option>
                <option value="percent">%</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="tax-rate">Tax rate (%)</label>
            <input
              id="tax-rate"
              className={`${INPUT} tabular mt-1.5`}
              {...num('tax', invoice.tax_rate, (n) => patch({ tax_rate: n }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="notes">Notes on the invoice</label>
            <textarea
              id="notes"
              rows={2}
              className={`${INPUT} mt-1.5 resize-y`}
              value={invoice.notes}
              placeholder="Payment terms, thanks, anything the customer should read"
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
        </div>
      </Group>
    </div>
  );
}
