import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, CircleDashed, ExternalLink, FileText, Loader2, Minus,
  Package, PenLine, Quote, X,
} from 'lucide-react';
import { useApi } from '../lib/useApi';
import { useActiveJobs } from '../lib/activeJobs';
import type { CheckState, JobDetail as JobDetailType, StepState } from '../lib/types';
import { absoluteTime, duration, hours, money, relativeTime, technician } from '../lib/format';
import { Button, ExternalLinkButton, buttonStyles } from '../components/Button';
import { PageBody, PageHeader } from '../components/AppShell';
import { ErrorNote, JobStatusPill, Row, Section, Skeleton, StatusPill } from '../components/ui';

/** Voice → transcript → AI → validation → invoice → delivery, end to end. */
const LIFECYCLE = [
  ['received', 'Voice note received'],
  ['downloaded', 'Audio downloaded'],
  ['transcribed', 'Transcript created'],
  ['extracted', 'Details extracted by AI'],
  ['validated', 'Checked against the transcript'],
  ['invoiced', 'Invoice created'],
] as const;

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, refresh } = useApi<JobDetailType>(id ? `/api/jobs/${id}` : null);
  const { running } = useActiveJobs();
  const processing = running.some((j) => j.job_id === id);

  if (loading) {
    return (
      <PageBody>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-6 h-20 w-full rounded-xl" />
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <span className="sr-only">Loading job</span>
      </PageBody>
    );
  }
  if (error) return <PageBody><ErrorNote title="Could not load this job" message={error} onRetry={refresh} /></PageBody>;
  if (!job) return <PageBody><ErrorNote title="Not found" message="This job does not exist." /></PageBody>;

  const currency = job.currency ?? 'usd';
  const invoiced = job.status === 'invoiced' && job.stripe?.invoice_id;

  return (
    <PageBody>
      <Link
        to="/jobs"
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted
          transition-colors duration-[120ms] hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> All jobs
      </Link>

      <PageHeader
        eyebrow={job.demo ? 'Demo data' : undefined}
        title={job.customer_name ?? 'Not identified'}
        description={job.work_performed ?? undefined}
        actions={(
          <div className="flex flex-col items-end gap-2">
            <p className="tabular display text-[28px] leading-none text-ink">
              {job.amount_to_charge !== null
                ? money(job.amount_to_charge, currency)
                : <span className="text-[15px] font-normal text-muted">No amount confirmed</span>}
            </p>
            <JobStatusPill status={job.status} processing={processing} />
          </div>
        )}
      />

      <p className="-mt-4 mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        <span>{technician(job.technician_number)}</span>
        <span aria-hidden>·</span>
        <time dateTime={job.timestamp} title={absoluteTime(job.timestamp)}>{relativeTime(job.timestamp)}</time>
        {job.processing_ms !== null && (
          <>
            <span aria-hidden>·</span>
            <span>processed in {duration(job.processing_ms)}</span>
          </>
        )}
      </p>

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-9">
          <Section title="What the technician said" divided={false}>
            {job.transcript_raw ? (
              <figure className="rounded-xl border border-line bg-surface px-5 py-4">
                <Quote size={15} className="text-accent" aria-hidden />
                <blockquote className="mt-2.5 text-[14.5px] leading-relaxed text-ink">
                  {job.transcript_raw}
                </blockquote>
              </figure>
            ) : (
              <p className="text-[13px] text-muted">No transcript — this job failed before transcription.</p>
            )}
            <p className="mt-2.5 text-[11.5px] text-muted">
              Kept permanently as the audit record. The audio itself is never stored.
            </p>
          </Section>

          <Section
            title="What the AI understood"
            description="Structured by the model, then verified against the transcript."
          >
            <dl className="rounded-xl border border-line bg-surface px-5 py-1">
              <Row label="Customer" value={job.customer_name ?? '—'} />
              <Row label="Work performed" value={job.work_performed ?? '—'} />
              <Row label="Hours" value={job.hours_logged !== null ? hours(job.hours_logged) : 'Not stated'} />
              <Row
                label="Amount"
                value={job.amount_to_charge !== null ? money(job.amount_to_charge, currency) : 'Not stated'}
              />
              <Row label="Follow-up" value={job.follow_up_required ? 'Required' : 'None'} />
            </dl>

            <div className="mt-5">
              <p className="eyebrow flex items-center gap-1.5">
                <Package size={11} aria-hidden /> Parts used
              </p>
              {job.parts_used.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-muted">No parts were mentioned in the voice note.</p>
              ) : (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {job.parts_used.map((part, i) => (
                    <li key={`${part.item}-${i}`}>
                      <StatusPill tone="neutral">
                        {part.quantity !== null && <span className="tabular font-semibold">{part.quantity}×</span>}
                        {part.item}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
                Parts are never priced by the model. The invoice total is only the amount the
                technician said out loud.
              </p>
            </div>
          </Section>

          <Section title="Validation" description="Nothing uncertain is allowed to reach an invoice.">
            <ul className="divide-y divide-line-soft">
              {job.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-3 py-3">
                  <CheckIcon state={check.state} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{check.label}</p>
                    {check.detail && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{check.detail}</p>
                    )}
                  </div>
                </li>
              ))}
              {job.checks.length === 0 && (
                <li className="py-3 text-[12.5px] text-muted">
                  This job failed before validation ran, so there is nothing to report.
                </li>
              )}
            </ul>
          </Section>

          <Section title="Invoice">
            {invoiced ? (
              <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border
                border-line bg-surface px-5 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] text-muted">{job.stripe?.invoice_number ?? '—'}</p>
                  <p className="tabular display mt-1.5 text-[24px] text-ink">
                    {money(job.amount_to_charge, currency)}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-muted">Stripe test mode — no real money moves</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/invoices/${job.job_id}`} className={buttonStyles('secondary', 'md')}>
                    <FileText size={14} aria-hidden /> View document
                  </Link>
                  {job.stripe?.hosted_invoice_url && (
                    <ExternalLinkButton variant="primary" size="md" href={job.stripe.hosted_invoice_url}>
                      <ExternalLink size={14} aria-hidden /> Open in Stripe
                    </ExternalLinkButton>
                  )}
                </div>
              </div>
            ) : job.status === 'needs_review' ? (
              <div className="rounded-xl border border-warning-line bg-warning-soft px-5 py-4">
                <p className="text-[13px] font-semibold text-ink">No invoice was created</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
                  Validation blocked this job, so nobody was billed. A delayed invoice is better
                  than a wrong one — you can finish it yourself, and everything the AI understood
                  carries over.
                </p>
                <BuildInvoice jobId={job.job_id} className="mt-4" />
              </div>
            ) : job.status === 'invoice_failed' ? (
              <div className="rounded-xl border border-danger-line bg-danger-soft px-5 py-4">
                <p className="text-[13px] font-semibold text-ink">Stripe rejected the request</p>
                {job.error && <p className="mt-1.5 text-[12.5px] text-dim">{job.error}</p>}
                <p className="mt-1.5 text-[12.5px] text-dim">This work is still unbilled.</p>
                <BuildInvoice jobId={job.job_id} className="mt-4" label="Rebuild and send" />
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-surface px-5 py-4 text-[12.5px] text-muted">
                Processing never reached the invoicing stage, so no invoice exists for this job.
              </p>
            )}
          </Section>
        </div>

        {/* Lifecycle — always in the same place, on every job. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="eyebrow mb-4">Lifecycle</p>
          <ol className="relative">
            {LIFECYCLE.map(([stepId, label]) => {
              const state = job.timeline.find((s) => s.id === stepId)?.state ?? 'pending';
              return (
                <li key={stepId} className="relative flex gap-3 pb-5">
                  <span
                    aria-hidden
                    className={`absolute left-[8px] top-5 h-full w-px ${
                      state === 'done' ? 'bg-success-line' : 'bg-line'
                    }`}
                  />
                  <StepIcon state={state} />
                  <div className="min-w-0 pt-px">
                    <p className={`text-[12.5px] ${
                      state === 'pending' ? 'text-muted'
                        : state === 'failed' || state === 'blocked' ? 'font-medium text-ink'
                          : 'text-dim'
                    }`}>
                      {label}
                    </p>
                    {state === 'skipped' && <p className="text-[11px] text-muted">Not applicable</p>}
                    {state === 'blocked' && <p className="text-[11px] text-warning">Blocked — no invoice created</p>}
                    {state === 'failed' && <p className="text-[11px] text-danger">Failed here</p>}
                  </div>
                </li>
              );
            })}

            <li className="relative flex gap-3">
              <StepIcon state={job.stripe?.send_status === 'sent' ? 'done' : 'pending'} />
              <div className="min-w-0 pt-px">
                <p className={`text-[12.5px] ${
                  job.stripe?.send_status === 'sent' ? 'text-dim' : 'text-muted'
                }`}>
                  Emailed to customer
                </p>
                {job.stripe?.send_status === 'send_failed' && (
                  <p className="text-[11px] text-warning">Stripe could not send it</p>
                )}
              </div>
            </li>
          </ol>

          <p className="mt-5 border-t border-line-soft pt-4 text-[11.5px] leading-relaxed text-muted">
            Payment is not tracked here — Stripe is the source of truth for whether an invoice has
            been paid.
          </p>
        </aside>
      </div>
    </PageBody>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const base = 'relative z-10 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border';
  if (state === 'done') {
    return <span className={`${base} border-success-line bg-success-soft text-success`} aria-hidden><Check size={10} strokeWidth={3} /></span>;
  }
  if (state === 'failed') {
    return <span className={`${base} border-danger-line bg-danger-soft text-danger`} aria-hidden><X size={10} strokeWidth={3} /></span>;
  }
  if (state === 'blocked') {
    return <span className={`${base} border-warning-line bg-warning-soft text-warning`} aria-hidden><Minus size={10} strokeWidth={3} /></span>;
  }
  if (state === 'skipped') {
    return <span className={`${base} border-line bg-raised text-muted`} aria-hidden><Minus size={10} /></span>;
  }
  if (state === 'active') {
    return <span className={`${base} border-accent-line bg-accent-soft text-accent`} aria-hidden><Loader2 size={10} className="animate-spin" /></span>;
  }
  return <span className={`${base} border-line bg-surface`} aria-hidden><CircleDashed size={9} className="text-muted" /></span>;
}

function CheckIcon({ state }: { state: CheckState }) {
  const base = 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border';
  if (state === 'pass') return <span className={`${base} border-success-line bg-success-soft text-success`} aria-hidden><Check size={9} strokeWidth={3} /></span>;
  if (state === 'warn') return <span className={`${base} border-warning-line bg-warning-soft text-warning`} aria-hidden><Minus size={9} strokeWidth={3} /></span>;
  if (state === 'fail') return <span className={`${base} border-danger-line bg-danger-soft text-danger`} aria-hidden><X size={9} strokeWidth={3} /></span>;
  return <span className={`${base} border-line bg-raised text-muted`} aria-hidden><Minus size={9} /></span>;
}

/**
 * Turns a job the automatic gate refused into a reviewable draft. Creates
 * nothing in Stripe — the draft still has to pass the same finalize gate.
 */
function BuildInvoice({
  jobId, className = '', label = 'Build this invoice',
}: { jobId: string; className?: string; label?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/draft`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Could not start a draft (${res.status})`);
      navigate(`/new?draft=${body.draft_id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button variant="primary" size="md" onClick={run} disabled={busy}>
        {busy
          ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Preparing…</>
          : <><PenLine size={14} aria-hidden /> {label}</>}
      </Button>
      {error && <p className="mt-2 text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}
