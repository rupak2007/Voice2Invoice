import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CircleDashed, Loader2, X } from 'lucide-react';
import type { JobStatus } from '../lib/types';

/* ---------------------------------------------------------------------------
   Every screen is assembled from these. One spacing rhythm, one type scale,
   one border treatment — so no page can drift into looking bespoke.
--------------------------------------------------------------------------- */

/** A band of content. Space and a hairline separate sections, not nested boxes. */
export function Section({
  title, description, actions, children, className = '', divided = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  divided?: boolean;
}) {
  return (
    <section className={`${divided ? 'border-t border-line-soft pt-7' : ''} ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[14.5px] font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A raised plane. Used for panels and documents — never as a wrapper by reflex. */
export function Panel({
  children, className = '', pad = true, tone = 'surface',
}: { children: ReactNode; className?: string; pad?: boolean; tone?: 'surface' | 'raised' }) {
  return (
    <div
      className={`rounded-xl border border-line ${tone === 'raised' ? 'bg-raised' : 'bg-surface'}
        ${pad ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/** Label + value on a hairline. The product's only definition-list row. */
export function Row({
  label, value, mono = false,
}: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line-soft py-2.5 last:border-0">
      <dt className="shrink-0 text-[12.5px] text-muted">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-[13px] text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------- status ---------------------------------- */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const PILL: Record<Tone, string> = {
  neutral: 'bg-raised text-dim border-line',
  accent: 'bg-accent-soft text-accent border-accent-line',
  success: 'bg-success-soft text-success border-success-line',
  warning: 'bg-warning-soft text-warning border-warning-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
};

/** Status is always a word plus a shape — never colour alone. */
export function StatusPill({
  tone = 'neutral', icon, children, className = '',
}: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px]
        text-[11.5px] font-medium leading-4 ${PILL[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

const JOB_STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  invoiced: { label: 'Invoiced', tone: 'success' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  invoice_failed: { label: 'Invoice failed', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function JobStatusPill({ status, processing = false }: { status: JobStatus; processing?: boolean }) {
  if (processing) {
    return (
      <StatusPill tone="accent" icon={<Loader2 size={11} className="animate-spin" aria-hidden />}>
        Processing
      </StatusPill>
    );
  }
  const { label, tone } = JOB_STATUS[status] ?? { label: status, tone: 'neutral' as Tone };
  const icon = tone === 'success' ? <Check size={11} strokeWidth={3} aria-hidden />
    : tone === 'warning' ? <AlertTriangle size={11} aria-hidden />
      : <X size={11} strokeWidth={3} aria-hidden />;
  return <StatusPill tone={tone} icon={icon}>{label}</StatusPill>;
}

/** Derived strictly from what Stripe actually returned for this job. */
export function InvoiceStatusPill({
  invoiceId, sendStatus, status,
}: { invoiceId: string | null; sendStatus: string | null; status: JobStatus }) {
  if (status === 'invoice_failed') {
    return <StatusPill tone="danger" icon={<X size={11} strokeWidth={3} aria-hidden />}>Failed</StatusPill>;
  }
  if (!invoiceId) {
    return <StatusPill tone="neutral" icon={<CircleDashed size={11} aria-hidden />}>Not created</StatusPill>;
  }
  if (sendStatus === 'sent') {
    return <StatusPill tone="success" icon={<Check size={11} strokeWidth={3} aria-hidden />}>Sent</StatusPill>;
  }
  if (sendStatus === 'send_failed') {
    return <StatusPill tone="warning" icon={<AlertTriangle size={11} aria-hidden />}>Send failed</StatusPill>;
  }
  return <StatusPill tone="accent" icon={<Check size={11} strokeWidth={3} aria-hidden />}>Issued</StatusPill>;
}

/* -------------------------------- table ----------------------------------- */

export interface Column<T> {
  key: string;
  header: string;
  /** Tailwind width/flex classes for this cell. */
  cell: string;
  align?: 'right';
  /** Hide below this breakpoint, e.g. 'lg'. */
  from?: 'sm' | 'md' | 'lg' | 'xl';
  render: (row: T) => ReactNode;
}

const HIDE: Record<string, string> = {
  sm: 'hidden sm:flex', md: 'hidden md:flex', lg: 'hidden lg:flex', xl: 'hidden xl:flex',
};

/**
 * One table for the whole product. Rows are lightweight: hairline dividers,
 * generous height, a whole-row link, and no boxed cells.
 */
export function DataTable<T>({
  columns, rows, rowKey, rowHref, empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div role="table" className="w-full">
      <div
        role="row"
        className="flex items-center gap-4 border-b border-line px-3 pb-2.5"
      >
        {columns.map((col) => (
          <div
            key={col.key}
            role="columnheader"
            className={`eyebrow ${col.cell} ${col.from ? HIDE[col.from] : 'flex'}
              ${col.align === 'right' ? 'justify-end text-right' : ''}`}
          >
            {col.header}
          </div>
        ))}
      </div>

      <div role="rowgroup" className="divide-y divide-line-soft">
        {rows.map((row) => {
          const inner = (
            <>
              {columns.map((col) => (
                <div
                  key={col.key}
                  role="cell"
                  className={`min-w-0 items-center ${col.cell} ${col.from ? HIDE[col.from] : 'flex'}
                    ${col.align === 'right' ? 'justify-end text-right' : ''}`}
                >
                  {col.render(row)}
                </div>
              ))}
            </>
          );
          const cls = 'group flex items-center gap-4 rounded-lg px-3 py-3.5 transition-colors duration-[120ms]';
          return rowHref ? (
            <Link key={rowKey(row)} to={rowHref(row)} role="row" className={`${cls} hover:bg-raised`}>
              {inner}
            </Link>
          ) : (
            <div key={rowKey(row)} role="row" className={cls}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- states ----------------------------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line-soft" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-[20%]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty states always name the action that fills them. */
export function Empty({
  icon, title, body, action,
}: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border
          border-accent-line bg-accent-soft text-accent">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
      {body && <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Errors say what failed and offer the next move. */
export function ErrorNote({
  title = "That didn't load", message, onRetry, action,
}: { title?: string; message: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-3.5">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-dim">{message}</p>
        {(onRetry || action) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-line bg-raised px-3 py-1.5 text-[12.5px]
                  font-medium text-ink transition-colors duration-[120ms] hover:bg-elevated"
              >
                Try again
              </button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Marks a screen whose data is real but whose actions are not yet wired to a
 * backend. Used so a demo surface can never be mistaken for a shipping one.
 */
export function ConceptNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-raised px-4 py-3">
      <span className="mt-0.5 shrink-0 rounded-md border border-accent-line bg-accent-soft px-1.5
        py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
        Preview
      </span>
      <p className="text-[12.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/* -------------------------------- toast ----------------------------------- */

interface Toast { id: number; title: string; body?: string; tone: Tone }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((prev) => prev.slice(1)), 4200);
    return () => clearTimeout(timer);
  }, [toasts]);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="slide-up pointer-events-auto flex items-start gap-3 rounded-xl border
              border-line bg-elevated px-4 py-3 shadow-lg"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
              ${t.tone === 'success' ? 'bg-success-soft text-success'
                : t.tone === 'danger' ? 'bg-danger-soft text-danger'
                  : 'bg-accent-soft text-accent'}`}
            >
              {t.tone === 'danger'
                ? <X size={11} strokeWidth={3} aria-hidden />
                : <Check size={11} strokeWidth={3} aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              className="-mr-1 ml-auto shrink-0 rounded-md p-1 text-muted transition-colors
                duration-[120ms] hover:bg-raised hover:text-ink"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------- inputs ---------------------------------- */

export const INPUT =
  'w-full rounded-lg border border-line bg-raised px-3 py-2 text-[13.5px] text-ink '
  + 'placeholder:text-muted transition-[border-color,box-shadow,background-color] duration-[120ms] '
  + 'hover:border-line-strong focus:border-accent focus:bg-elevated focus:outline-none '
  + 'focus:ring-4 focus:ring-accent/10';

export const LABEL = 'block text-[12.5px] font-medium text-dim';
