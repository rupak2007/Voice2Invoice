import { Check, Loader2 } from 'lucide-react';
import type { Draft } from '../lib/types';

/**
 * Makes the AI's work legible while it happens.
 *
 * Every row reflects a stage the server actually reported, and every extracted
 * field appears only once the model has produced it. A field the model could
 * not fill says so plainly rather than showing a confident blank.
 */

const STAGES = [
  { id: 'received', label: 'Audio received' },
  { id: 'transcribing', label: 'Transcribing speech' },
  { id: 'extracting', label: 'Understanding the job' },
  { id: 'validating', label: 'Validating against the transcript' },
];

const money = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(v);

export function ProcessingStage({ draft, currency }: { draft: Draft | null; currency: string }) {
  const stage = draft?.stage ?? 'received';
  const ready = draft?.status === 'ready';
  const index = STAGES.findIndex((s) => s.id === stage);
  const active = index < 0 ? 0 : index;

  const fields = draft?.invoice
    ? [
      { label: 'Customer', value: draft.invoice.customer.name || null, note: null },
      { label: 'Work', value: draft.invoice.line_items[0]?.description || null, note: null },
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
        note: draft.stated_total === null ? 'not stated aloud — you set it' : 'as you said it',
      },
    ]
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ol className="space-y-4">
        {STAGES.map((s, i) => {
          const state = ready || i < active ? 'done' : i === active ? 'active' : 'todo';
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                {state === 'done' && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full
                    border border-success-line bg-success-soft text-success">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                {state === 'active' && <Loader2 size={16} className="animate-spin text-accent" />}
                {state === 'todo' && <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />}
              </span>
              <span className={`text-[13.5px] ${
                state === 'todo' ? 'text-muted' : state === 'active' ? 'font-medium text-ink' : 'text-dim'
              }`}>
                {s.label}
              </span>
              {state === 'active' && (
                <span className="relative ml-1 h-px flex-1 overflow-hidden bg-line" aria-hidden>
                  <span className="scan absolute inset-y-0 w-1/4 bg-accent" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {draft?.transcript_raw && (
        <figure className="rise mt-8 rounded-xl border border-line bg-surface px-5 py-4">
          <figcaption className="eyebrow">Transcript</figcaption>
          <blockquote className="mt-2.5 text-[14.5px] leading-relaxed text-ink">
            &ldquo;{draft.transcript_raw}&rdquo;
          </blockquote>
        </figure>
      )}

      {fields.length > 0 && (
        <div className="rise mt-4 rounded-xl border border-line bg-surface px-5 py-4">
          <p className="eyebrow">Extracted</p>
          <dl className="mt-1.5">
            {fields.map(({ label, value, note }) => (
              <div
                key={label}
                className="confirm flex items-baseline justify-between gap-6 border-b border-line-soft
                  py-2.5 last:border-0"
              >
                <dt className="shrink-0 text-[12.5px] text-muted">{label}</dt>
                <dd className="flex min-w-0 items-baseline gap-2 text-right">
                  {note && <span className="shrink-0 text-[11px] text-muted">{note}</span>}
                  <span className={`truncate text-[13px] font-medium ${value ? 'text-ink' : 'text-muted'}`}>
                    {value ?? '—'}
                  </span>
                  {value && <Check size={12} className="shrink-0 text-success" aria-hidden />}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
