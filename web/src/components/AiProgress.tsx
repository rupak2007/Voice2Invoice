import { Check, Loader2 } from 'lucide-react';
import type { Draft } from '../lib/types';

const STAGES = [
  { id: 'transcribing', label: 'Transcribing your recording' },
  { id: 'extracting', label: 'Understanding the job' },
  { id: 'validating', label: 'Checking it against what you said' },
];

const money = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(v);

/**
 * Makes the AI's work legible. Each field appears only once the model has
 * actually produced it, so the screen is reporting progress rather than
 * performing it — and a field the model could not fill says so plainly.
 */
export function AiProgress({ draft, currency }: { draft: Draft | null; currency: string }) {
  const index = STAGES.findIndex((s) => s.id === draft?.stage);
  const done = draft?.status === 'ready';

  const extracted = draft?.invoice
    ? [
      { label: 'Customer', value: draft.invoice.customer.name || null },
      { label: 'Work', value: draft.invoice.line_items[0]?.description || null },
      {
        label: 'Parts',
        value: draft.suggested_parts?.length
          ? draft.suggested_parts.map((p) => p.item).join(', ')
          : null,
        note: draft.suggested_parts?.length ? 'you set the prices' : 'none mentioned',
      },
      {
        label: 'Amount',
        value: draft.stated_total !== null ? money(draft.stated_total, currency) : null,
        note: draft.stated_total === null ? 'not stated out loud — you set it' : 'as you said it',
      },
    ]
    : [];

  return (
    <div className="mx-auto max-w-xl">
      <ol className="space-y-3.5">
        {STAGES.map((stage, i) => {
          const state = done || (index >= 0 && i < index) ? 'done'
            : index === i || (index < 0 && i === 0) ? 'active'
              : 'todo';
          return (
            <li key={stage.id} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                {state === 'done' && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-tint text-success">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                {state === 'active' && <Loader2 size={16} className="animate-spin text-brand" />}
                {state === 'todo' && <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />}
              </span>
              <span className={`text-[13.5px] ${
                state === 'todo' ? 'text-faint' : state === 'active' ? 'font-medium text-ink' : 'text-muted'
              }`}>
                {stage.label}
              </span>
              {state === 'active' && (
                <span className="relative ml-1 h-px flex-1 overflow-hidden bg-line" aria-hidden>
                  <span className="scan absolute inset-y-0 w-1/3 bg-brand" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* The user's own words, the moment they exist. */}
      {draft?.transcript_raw && (
        <figure className="rise mt-7 rounded-xl border border-line bg-surface px-5 py-4">
          <figcaption className="eyebrow">What we heard</figcaption>
          <blockquote className="mt-2 text-[14.5px] leading-relaxed text-ink">
            &ldquo;{draft.transcript_raw}&rdquo;
          </blockquote>
        </figure>
      )}

      {/* What the model pulled out of it. */}
      {extracted.length > 0 && (
        <div className="rise mt-4 rounded-xl border border-line bg-surface px-5 py-4">
          <p className="eyebrow">What we understood</p>
          <dl className="mt-1">
            {extracted.map(({ label, value, note }) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-b border-line-soft py-2.5 last:border-0"
              >
                <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
                <dd className="flex min-w-0 items-baseline gap-2 text-right">
                  {note && <span className="shrink-0 text-[11.5px] text-faint">{note}</span>}
                  <span className={`truncate text-[13.5px] font-medium ${value ? 'text-ink' : 'text-faint'}`}>
                    {value ?? '—'}
                  </span>
                  {value && <Check size={13} className="shrink-0 text-success" aria-hidden />}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
