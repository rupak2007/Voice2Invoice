import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mic, Search, SearchX } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { useActiveJobs } from '../lib/activeJobs';
import type { JobSummary } from '../lib/types';
import { money, relativeTime, technician } from '../lib/format';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import {
  DataTable, Empty, ErrorNote, INPUT, JobStatusPill, SkeletonRows, StatusPill,
} from '../components/ui';

const STATUSES = [
  ['all', 'All statuses'],
  ['invoiced', 'Invoiced'],
  ['needs_review', 'Needs review'],
  ['invoice_failed', 'Invoice failed'],
  ['failed', 'Failed'],
];

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  // Keep the input responsive while the request stays debounced.
  useEffect(() => {
    const id = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query) next.set('q', query); else next.delete('q');
        return next;
      }, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [query, setParams]);

  // A search typed in the top bar arrives through the URL.
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);

  const search = new URLSearchParams();
  if (status !== 'all') search.set('status', status);
  if (urlQuery) search.set('q', urlQuery);
  const qs = search.toString();

  const { data, error, loading, refresh } = useApi<{ jobs: JobSummary[]; total: number; currency: string }>(
    `/api/jobs${qs ? `?${qs}` : ''}`,
    { pollMs: 5000 },
  );
  const { running } = useActiveJobs();
  const processingIds = new Set(running.map((j) => j.job_id));

  const jobs = data?.jobs ?? [];
  const currency = data?.currency ?? 'usd';
  const filtered = status !== 'all' || urlQuery.length > 0;

  return (
    <PageBody>
      <PageHeader
        title="Jobs"
        description="Every voice note that reached Voice2Invoice — from WhatsApp or recorded here — and what became of it."
        actions={(
          <Link to="/new" className={buttonStyles('primary', 'md')}>
            <Mic size={15} aria-hidden /> New invoice
          </Link>
        )}
      />

      <div className="mb-2 flex flex-col gap-2.5 border-y border-line-soft py-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Search jobs by customer, work or transcript"
            placeholder="Search customer, work or transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${INPUT} pl-9`}
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (e.target.value === 'all') next.delete('status');
            else next.set('status', e.target.value);
            return next;
          })}
          className={`${INPUT} sm:w-44`}
        >
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="tabular text-[12px] text-muted sm:ml-auto">
          {loading ? 'Loading…' : `${data?.total ?? 0} job${(data?.total ?? 0) === 1 ? '' : 's'}`}
        </p>
      </div>

      {error ? <div className="mt-6"><ErrorNote message={error} onRetry={refresh} /></div>
        : loading ? <SkeletonRows rows={7} />
          : (
            <DataTable<JobSummary>
              rows={jobs}
              rowKey={(j) => j.job_id}
              rowHref={(j) => `/jobs/${j.job_id}`}
              columns={[
                {
                  key: 'customer', header: 'Customer', cell: 'flex-[1.4]',
                  render: (j) => (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
                        {j.customer_name ?? <span className="text-muted">Not identified</span>}
                        {j.demo && <StatusPill tone="neutral" className="shrink-0">Demo</StatusPill>}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">{j.work_performed ?? '—'}</p>
                    </div>
                  ),
                },
                {
                  key: 'source', header: 'From', cell: 'flex-1', from: 'lg',
                  render: (j) => (
                    <span className="truncate text-[12px] text-muted">{technician(j.technician_number)}</span>
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
                  render: (j) => (
                    <time dateTime={j.timestamp} className="text-[11.5px] text-muted">
                      {relativeTime(j.timestamp)}
                    </time>
                  ),
                },
              ]}
              empty={filtered ? (
                <Empty
                  icon={<SearchX size={18} aria-hidden />}
                  title="No matching jobs"
                  body="Nothing matches this search and filter. Try a different customer name, or clear the filters."
                  action={(
                    <button type="button" onClick={() => setParams({})} className={buttonStyles('secondary', 'md')}>
                      Clear filters
                    </button>
                  )}
                />
              ) : (
                <Empty
                  icon={<Mic size={18} aria-hidden />}
                  title="No jobs yet"
                  body="Every voice note lands here — whether a technician sends it over WhatsApp or you record one yourself."
                  action={(
                    <Link to="/new" className={buttonStyles('primary', 'md')}>
                      <Mic size={15} aria-hidden /> Record your first job
                    </Link>
                  )}
                />
              )}
            />
          )}
    </PageBody>
  );
}
