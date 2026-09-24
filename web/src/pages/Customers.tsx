import { Link } from 'react-router-dom';
import { ArrowRight, Mic, Users } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { JobSummary, Stats } from '../lib/types';
import { rollUpCustomers, type CustomerRollup } from '../lib/derive';
import { money, relativeTime } from '../lib/format';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import {
  ConceptNote, DataTable, Empty, ErrorNote, SkeletonRows, StatusPill,
} from '../components/ui';

/**
 * There is no customer table in the backend yet. Rather than invent records,
 * this rolls up the real job log by customer name — so everything on screen is
 * the user's own history, and the screen shows what the shipped feature would.
 */
export default function Customers() {
  const { data, error, loading, refresh } = useApi<{ jobs: JobSummary[] }>('/api/jobs', { pollMs: 10000 });
  const { data: stats } = useApi<Stats>('/api/stats');
  const currency = stats?.currency ?? 'usd';

  const customers = rollUpCustomers(data?.jobs ?? []);
  const repeat = customers.filter((c) => c.jobs > 1).length;

  return (
    <PageBody>
      <PageHeader
        title="Customers"
        description="Everyone you have invoiced, built from the jobs you have recorded."
        actions={(
          <Link to="/new" className={buttonStyles('primary', 'md')}>
            <Mic size={15} aria-hidden /> New invoice
          </Link>
        )}
      />

      <ConceptNote>
        Customer records are not a backend table yet, so this view is derived live from your job
        history. The figures are real; saving, editing and merging customers are not wired up.
      </ConceptNote>

      {!loading && customers.length > 0 && (
        <dl className="mb-2 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-y border-line-soft py-5">
          <div>
            <dt className="text-[11.5px] text-muted">Customers</dt>
            <dd className="tabular display mt-1 text-[26px] text-ink">{customers.length}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">Repeat customers</dt>
            <dd className="tabular mt-1 text-[19px] font-semibold tracking-tight text-ink">{repeat}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">Billed across all</dt>
            <dd className="tabular mt-1 text-[19px] font-semibold tracking-tight text-ink">
              {money(customers.reduce((s, c) => s + c.billed, 0), currency)}
            </dd>
          </div>
        </dl>
      )}

      {error ? <div className="mt-6"><ErrorNote message={error} onRetry={refresh} /></div>
        : loading ? <SkeletonRows rows={5} />
          : (
            <DataTable<CustomerRollup>
              rows={customers}
              rowKey={(c) => c.name}
              rowHref={(c) => `/jobs?q=${encodeURIComponent(c.name)}`}
              columns={[
                {
                  key: 'name', header: 'Customer', cell: 'flex-[1.4]',
                  render: (c) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        border border-line bg-raised text-[11px] font-semibold uppercase text-muted
                        transition-colors duration-[120ms] group-hover:border-accent-line
                        group-hover:bg-accent-soft group-hover:text-accent">
                        {c.name.slice(0, 2)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{c.name}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {c.jobs} job{c.jobs === 1 ? '' : 's'}
                          {c.jobs > 1 && <span className="text-accent"> · repeat</span>}
                        </span>
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'invoiced', header: 'Invoiced', cell: 'w-20', align: 'right', from: 'sm',
                  render: (c) => <span className="tabular text-[13px] text-dim">{c.invoiced}</span>,
                },
                {
                  key: 'billed', header: 'Billed', cell: 'w-28', align: 'right',
                  render: (c) => (
                    <span className="tabular text-[13px] font-semibold text-ink">
                      {money(c.billed, currency)}
                    </span>
                  ),
                },
                {
                  key: 'flag', header: 'Open', cell: 'w-[118px]',
                  render: (c) => (c.needsReview > 0
                    ? <StatusPill tone="warning">{c.needsReview} to review</StatusPill>
                    : <span className="text-[11.5px] text-muted">—</span>),
                },
                {
                  key: 'last', header: 'Last job', cell: 'w-20', align: 'right', from: 'md',
                  render: (c) => <span className="text-[11.5px] text-muted">{relativeTime(c.lastSeen)}</span>,
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
                  icon={<Users size={18} aria-hidden />}
                  title="No customers yet"
                  body="Customers appear here as soon as a voice note names one."
                  action={(
                    <Link to="/new" className={buttonStyles('primary', 'md')}>
                      <Mic size={15} aria-hidden /> Record a job
                    </Link>
                  )}
                />
              )}
            />
          )}
    </PageBody>
  );
}
