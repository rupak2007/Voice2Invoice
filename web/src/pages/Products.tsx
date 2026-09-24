import { Link } from 'react-router-dom';
import { Boxes, Mic } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { JobSummary } from '../lib/types';
import { rollUpParts, type ProductRollup } from '../lib/derive';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import { ConceptNote, DataTable, Empty, ErrorNote, SkeletonRows } from '../components/ui';

/**
 * Parts and services the technicians actually named, rolled up from the job log.
 *
 * There is deliberately no price column: the model is never allowed to price a
 * part, so no price exists to aggregate. A shipped catalogue is where prices
 * would live, and that is exactly what this screen is a preview of.
 */
export default function Products() {
  const { data, error, loading, refresh } = useApi<{ jobs: JobSummary[] }>('/api/jobs', { pollMs: 10000 });

  const parts = rollUpParts(data?.jobs ?? []);
  const totalUses = parts.reduce((s, p) => s + p.timesUsed, 0);

  return (
    <PageBody>
      <PageHeader
        title="Products & parts"
        description="What your voice notes mention most often — the beginnings of a priced catalogue."
        actions={(
          <Link to="/new" className={buttonStyles('primary', 'md')}>
            <Mic size={15} aria-hidden /> New invoice
          </Link>
        )}
      />

      <ConceptNote>
        A priced catalogue is not built yet. This view rolls up the parts your recordings actually
        named so you can see what would be in it. There is no price column on purpose — the AI never
        prices a part, so the job log holds no price to show.
      </ConceptNote>

      {!loading && parts.length > 0 && (
        <dl className="mb-2 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-y border-line-soft py-5">
          <div>
            <dt className="text-[11.5px] text-muted">Distinct items</dt>
            <dd className="tabular display mt-1 text-[26px] text-ink">{parts.length}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">Total mentions</dt>
            <dd className="tabular mt-1 text-[19px] font-semibold tracking-tight text-ink">{totalUses}</dd>
          </div>
        </dl>
      )}

      {error ? <div className="mt-6"><ErrorNote message={error} onRetry={refresh} /></div>
        : loading ? <SkeletonRows rows={4} />
          : (
            <DataTable<ProductRollup>
              rows={parts}
              rowKey={(p) => p.item}
              rowHref={(p) => `/jobs?q=${encodeURIComponent(p.item)}`}
              columns={[
                {
                  key: 'item', header: 'Item', cell: 'flex-[1.6]',
                  render: (p) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        border border-line bg-raised text-muted transition-colors duration-[120ms]
                        group-hover:border-accent-line group-hover:bg-accent-soft group-hover:text-accent">
                        <Boxes size={14} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{p.item}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {[...new Set(p.jobs)].slice(0, 3).join(', ') || 'No customer recorded'}
                        </span>
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'uses', header: 'Jobs', cell: 'w-20', align: 'right',
                  render: (p) => <span className="tabular text-[13px] text-dim">{p.timesUsed}</span>,
                },
                {
                  key: 'qty', header: 'Total qty', cell: 'w-24', align: 'right', from: 'sm',
                  render: (p) => (
                    <span className="tabular text-[13px] font-medium text-ink">{p.totalQuantity}</span>
                  ),
                },
                {
                  key: 'price', header: 'Unit price', cell: 'w-28', align: 'right', from: 'md',
                  render: () => (
                    <span className="text-[11.5px] text-muted" title="You set part prices during review">
                      Set at review
                    </span>
                  ),
                },
              ]}
              empty={(
                <Empty
                  icon={<Boxes size={18} aria-hidden />}
                  title="No parts mentioned yet"
                  body="When a voice note names a part, it shows up here so you can start pricing a catalogue."
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
