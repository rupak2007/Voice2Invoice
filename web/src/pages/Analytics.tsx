import { Link } from 'react-router-dom';
import { BarChart3, Mic } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { JobSummary, Stats } from '../lib/types';
import { bucketByDay, rollUpCustomers, statusBreakdown } from '../lib/derive';
import { money } from '../lib/format';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import { ConceptNote, Empty, ErrorNote, Section, Skeleton } from '../components/ui';

const TONE_BAR: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Charted entirely from the real job log — no analytics service, no sample
 * series. Everything here is an aggregation of records the user actually has.
 */
export default function Analytics() {
  const { data, error, loading, refresh } = useApi<{ jobs: JobSummary[] }>('/api/jobs', { pollMs: 15000 });
  const { data: stats } = useApi<Stats>('/api/stats');
  const currency = stats?.currency ?? 'usd';

  const jobs = data?.jobs ?? [];
  const days = bucketByDay(jobs, 14);
  const peak = Math.max(1, ...days.map((d) => d.count));
  const breakdown = statusBreakdown(jobs);
  const topCustomers = rollUpCustomers(jobs).slice(0, 5);

  const invoicedJobs = jobs.filter((j) => j.status === 'invoiced');
  const avg = invoicedJobs.length
    ? invoicedJobs.reduce((s, j) => s + (j.amount_to_charge ?? 0), 0) / invoicedJobs.length
    : 0;
  const conversion = jobs.length ? Math.round((invoicedJobs.length / jobs.length) * 100) : 0;

  return (
    <PageBody>
      <PageHeader
        title="Analytics"
        description="How your voice notes turn into invoices."
        actions={(
          <Link to="/new" className={buttonStyles('primary', 'md')}>
            <Mic size={15} aria-hidden /> New invoice
          </Link>
        )}
      />

      <ConceptNote>
        There is no analytics service behind this yet — every figure and bar is computed live from
        your job log. Date-range filters, exports and saved reports are not wired up.
      </ConceptNote>

      {error ? <ErrorNote message={error} onRetry={refresh} />
        : loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : jobs.length === 0 ? (
          <Empty
            icon={<BarChart3 size={18} aria-hidden />}
            title="Nothing to chart yet"
            body="Record a few jobs and this fills in automatically."
            action={(
              <Link to="/new" className={buttonStyles('primary', 'md')}>
                <Mic size={15} aria-hidden /> Record a job
              </Link>
            )}
          />
        ) : (
          <>
            <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-4 border-y border-line-soft py-5">
              <div>
                <dt className="text-[11.5px] text-muted">Invoiced value</dt>
                <dd className="tabular display mt-1 text-[26px] text-ink">
                  {money(stats?.invoiced_value ?? 0, currency)}
                </dd>
              </div>
              <Figure label="Average invoice" value={money(avg, currency)} />
              <Figure label="Voice → invoice rate" value={`${conversion}%`} />
              <Figure label="Jobs processed" value={String(jobs.length)} />
            </dl>

            <div className="mt-9 grid gap-9 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Section title="Jobs over the last 14 days" divided={false}>
                <div className="rounded-xl border border-line bg-surface p-5">
                  <div className="flex h-44 items-end gap-1.5" role="img"
                    aria-label={`Daily job counts for the last 14 days, peak ${peak}`}>
                    {days.map((d) => (
                      <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <span className="tabular text-[10.5px] text-muted opacity-0 transition-opacity
                          duration-[120ms] group-hover:opacity-100">
                          {d.count || ''}
                        </span>
                        <span
                          className={`w-full rounded-sm transition-colors duration-[120ms] ${
                            d.count ? 'bg-accent/70 group-hover:bg-accent' : 'bg-line'
                          }`}
                          style={{ height: `${Math.max(2, (d.count / peak) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-line-soft pt-2.5">
                    <span className="text-[10.5px] text-muted">{days[0]?.label}</span>
                    <span className="text-[10.5px] text-muted">{days[days.length - 1]?.label}</span>
                  </div>
                </div>
              </Section>

              <Section title="Outcomes" divided={false}>
                <div className="rounded-xl border border-line bg-surface p-5">
                  <ul className="space-y-4">
                    {breakdown.map((row) => (
                      <li key={row.key}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[12.5px] text-dim">{row.label}</span>
                          <span className="tabular text-[12.5px] text-muted">
                            <span className="font-semibold text-ink">{row.value}</span> · {row.share}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                          <div
                            className={`h-full rounded-full ${TONE_BAR[row.tone]}`}
                            style={{ width: `${row.share}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            </div>

            <Section title="Top customers by billed value" className="mt-9">
              <ul className="divide-y divide-line-soft">
                {topCustomers.map((c, i) => (
                  <li key={c.name}>
                    <Link
                      to={`/jobs?q=${encodeURIComponent(c.name)}`}
                      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors
                        duration-[120ms] hover:bg-raised"
                    >
                      <span className="tabular w-5 shrink-0 text-[12px] text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.name}</span>
                      <span className="hidden w-24 shrink-0 text-right text-[11.5px] text-muted sm:block">
                        {c.jobs} job{c.jobs === 1 ? '' : 's'}
                      </span>
                      <span className="tabular w-28 shrink-0 text-right text-[13px] font-semibold text-ink">
                        {money(c.billed, currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
    </PageBody>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="tabular mt-1 text-[19px] font-semibold tracking-tight text-ink">{value}</dd>
    </div>
  );
}
