import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileEdit, Loader2, Mic, Receipt, Trash2 } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { useActiveJobs } from '../lib/activeJobs';
import type { DraftSummary, InvoiceSummary, JobSummary, Settings, Stats } from '../lib/types';
import { money, relativeTime } from '../lib/format';
import { PageBody } from '../components/AppShell';
import { VoiceStage } from '../components/VoiceStage';
import { Button, IconButton, buttonStyles } from '../components/Button';
import {
  DataTable, Empty, ErrorNote, JobStatusPill, Section, SkeletonRows, StatusPill,
} from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Overview() {
  const navigate = useNavigate();
  const stats = useApi<Stats>('/api/stats', { pollMs: 5000 });
  const jobs = useApi<{ jobs: JobSummary[] }>('/api/jobs', { pollMs: 5000 });
  const invoices = useApi<{ invoices: InvoiceSummary[] }>('/api/invoices', { pollMs: 5000 });
  const drafts = useApi<{ drafts: DraftSummary[] }>('/api/drafts', { pollMs: 5000 });
  const { data: settings } = useApi<Settings>('/api/settings');
  const { running } = useActiveJobs();

  const [busy, setBusy] = useState(false);
  const currency = stats.data?.currency ?? 'usd';
  const name = settings?.operator_name;

  const openDrafts = (drafts.data?.drafts ?? []).filter((d) => !d.finalized_job_id);
  const needsReview = (jobs.data?.jobs ?? []).filter((j) => j.status === 'needs_review');
  const processingIds = new Set(running.map((j) => j.job_id));

  const startRecording = async (blob: Blob) => {
    setBusy(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      const body = await res.json();
      if (res.ok) navigate(`/new?draft=${body.draft_id}`);
      else setBusy(false);
    } catch { setBusy(false); }
  };

  const createManual = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/drafts/blank', { method: 'POST' });
      const body = await res.json();
      if (res.ok) navigate(`/new?draft=${body.draft_id}`);
      else setBusy(false);
    } catch { setBusy(false); }
  };

  return (
    <PageBody wide>
      {/* Workspace + contextual rail. The voice stage is the subject. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <p className="text-[13px] text-muted">{greeting()}{name ? `, ${name}` : ''}.</p>
          <h1 className="display mt-2 max-w-[18ch] text-[34px] text-ink sm:text-[42px]">
            Create an invoice with your voice.
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">
            Describe the job. We transcribe it, pull out the details, and draft the invoice —
            you review every line before anything is sent.
          </p>

          <div className="mt-7">
            <VoiceStage onCaptured={startRecording} onManual={createManual} disabled={busy} />
          </div>

          {busy && (
            <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-muted">
              <Loader2 size={13} className="animate-spin" aria-hidden /> Opening the workspace…
            </p>
          )}

          {/* Statistics are context, never the headline. */}
          {!stats.loading && stats.data && (
            <dl className="mt-8 flex flex-wrap items-baseline gap-x-9 gap-y-4 border-t border-line-soft pt-5">
              <Stat label="Jobs processed" value={String(stats.data.jobs_total)} to="/jobs" />
              <Stat label="Invoices issued" value={String(stats.data.invoiced)} to="/invoices" />
              <Stat
                label="Needs review"
                value={String(stats.data.needs_review)}
                to="/jobs?status=needs_review"
                tone={stats.data.needs_review > 0 ? 'warning' : undefined}
              />
              <Stat
                label="Invoiced value"
                value={money(stats.data.invoiced_value, currency, { compact: true })}
              />
            </dl>
          )}
        </section>

        {/* Contextual rail — what is waiting on a person, not empty space. */}
        <aside className="min-w-0 xl:border-l xl:border-line-soft xl:pl-8">
          <h2 className="eyebrow">Needs your attention</h2>

          {openDrafts.length === 0 && needsReview.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-6 text-center
              text-[12.5px] leading-relaxed text-muted">
              Nothing is waiting. Record a job and it will appear here until you send it.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {openDrafts.map((draft) => (
                <li
                  key={draft.draft_id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                    border border-accent-line bg-accent-soft text-accent">
                    {draft.status === 'processing'
                      ? <Loader2 size={14} className="animate-spin" aria-hidden />
                      : <FileEdit size={14} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {draft.customer_name || 'Untitled draft'}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {draft.status === 'processing' ? 'Processing…'
                        : draft.status === 'failed' ? <span className="text-danger">Could not be processed</span>
                          : draft.total !== null ? `${money(draft.total, currency)} · ready to review`
                            : 'Ready to review'}
                    </p>
                  </div>
                  <DiscardDraft draftId={draft.draft_id} onDone={drafts.refresh} />
                  <Link
                    to={`/new?draft=${draft.draft_id}`}
                    className={buttonStyles('secondary', 'sm', 'shrink-0')}
                  >
                    Review
                  </Link>
                </li>
              ))}

              {needsReview.map((job) => (
                <li key={job.job_id}>
                  <Link
                    to={`/jobs/${job.job_id}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface
                      px-3.5 py-3 transition-colors duration-[120ms] hover:border-line-strong hover:bg-raised"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                      border border-warning-line bg-warning-soft text-warning">
                      <Mic size={14} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {job.customer_name ?? 'Not identified'}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">
                        {job.work_performed ?? 'No work described'}
                      </p>
                    </div>
                    <StatusPill tone="warning">Review</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div className="mt-10 grid gap-10 2xl:grid-cols-2">
        <Section
          title="Recent jobs"
          actions={<Link to="/jobs" className="text-[12.5px] font-medium text-accent hover:text-accent-hover">
            View all
          </Link>}
        >
          {jobs.error ? <ErrorNote message={jobs.error} onRetry={jobs.refresh} />
            : jobs.loading ? <SkeletonRows rows={4} />
              : (
                <DataTable<JobSummary>
                  rows={(jobs.data?.jobs ?? []).slice(0, 6)}
                  rowKey={(j) => j.job_id}
                  rowHref={(j) => `/jobs/${j.job_id}`}
                  columns={[
                    {
                      key: 'customer', header: 'Customer', cell: 'flex-[1.3]',
                      render: (j) => (
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {j.customer_name ?? 'Not identified'}
                          </p>
                          <p className="truncate text-[11.5px] text-muted">{j.work_performed ?? '—'}</p>
                        </div>
                      ),
                    },
                    {
                      key: 'amount', header: 'Amount', cell: 'w-24', align: 'right',
                      render: (j) => (
                        <span className="tabular text-[13px] font-medium text-ink">
                          {j.amount_to_charge !== null ? money(j.amount_to_charge, currency) : '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'status', header: 'Status', cell: 'w-[118px]',
                      render: (j) => <JobStatusPill status={j.status} processing={processingIds.has(j.job_id)} />,
                    },
                    {
                      key: 'date', header: 'Date', cell: 'w-20', align: 'right', from: 'sm',
                      render: (j) => <span className="text-[11.5px] text-muted">{relativeTime(j.timestamp)}</span>,
                    },
                  ]}
                  empty={(
                    <Empty
                      icon={<Mic size={18} aria-hidden />}
                      title="No jobs yet"
                      body="Record a job above, or let a technician send a WhatsApp voice note."
                    />
                  )}
                />
              )}
        </Section>

        <Section
          title="Recent invoices"
          actions={<Link to="/invoices" className="text-[12.5px] font-medium text-accent hover:text-accent-hover">
            View all
          </Link>}
        >
          {invoices.error ? <ErrorNote message={invoices.error} onRetry={invoices.refresh} />
            : invoices.loading ? <SkeletonRows rows={4} />
              : (
                <DataTable<InvoiceSummary>
                  rows={(invoices.data?.invoices ?? []).slice(0, 6)}
                  rowKey={(i) => i.job_id}
                  rowHref={(i) => `/invoices/${i.job_id}`}
                  columns={[
                    {
                      key: 'customer', header: 'Customer', cell: 'flex-[1.3]',
                      render: (i) => (
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{i.customer_name ?? '—'}</p>
                          <p className="truncate font-mono text-[11px] text-muted">
                            {i.invoice_number ?? 'No number'}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: 'amount', header: 'Amount', cell: 'w-24', align: 'right',
                      render: (i) => (
                        <span className="tabular text-[13px] font-medium text-ink">
                          {money(i.amount_to_charge, currency)}
                        </span>
                      ),
                    },
                    {
                      key: 'go', header: '', cell: 'w-5',
                      render: () => (
                        <ArrowRight
                          size={13}
                          className="text-muted transition-transform duration-[120ms] group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      ),
                    },
                  ]}
                  empty={(
                    <Empty
                      icon={<Receipt size={18} aria-hidden />}
                      title="No invoices yet"
                      body="Send your first draft and it will appear here."
                    />
                  )}
                />
              )}
        </Section>
      </div>
    </PageBody>
  );
}

function Stat({
  label, value, to, tone,
}: { label: string; value: string; to?: string; tone?: 'warning' }) {
  const body = (
    <>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className={`tabular mt-1 text-[19px] font-semibold tracking-tight
        ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
        {value}
      </dd>
    </>
  );
  return to
    ? <Link to={to} className="rounded-lg transition-opacity duration-[120ms] hover:opacity-70">{body}</Link>
    : <div>{body}</div>;
}

/** Drafts that are never sent would otherwise sit in the rail forever. */
function DiscardDraft({ draftId, onDone }: { draftId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' }).catch(() => {});
            onDone();
          }}
        >
          Discard
        </Button>
      </span>
    );
  }
  return (
    <IconButton label="Discard this draft" className="shrink-0" onClick={() => setConfirming(true)}>
      <Trash2 size={13} aria-hidden />
    </IconButton>
  );
}
