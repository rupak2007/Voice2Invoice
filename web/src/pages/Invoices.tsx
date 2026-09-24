import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Mic, Receipt } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { InvoiceSummary } from '../lib/types';
import { absoluteTime, money, relativeTime } from '../lib/format';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import {
  DataTable, Empty, ErrorNote, InvoiceStatusPill, SkeletonRows, StatusPill,
} from '../components/ui';

export default function Invoices() {
  const { data, error, loading, refresh } = useApi<{
    invoices: InvoiceSummary[]; total: number; currency: string;
  }>('/api/invoices', { pollMs: 5000 });

  const invoices = data?.invoices ?? [];
  const currency = data?.currency ?? 'usd';
  const value = invoices.reduce((sum, i) => sum + (i.amount_to_charge ?? 0), 0);
  const sent = invoices.filter((i) => i.send_status === 'sent').length;
  const issued = invoices.filter((i) => i.invoice_id && i.send_status !== 'sent').length;
  const failed = invoices.filter((i) => i.status === 'invoice_failed').length;

  return (
    <PageBody>
      <PageHeader
        title="Invoices"
        description="Created in Stripe test mode — sent by you from a recording, or billed automatically from a voice note that passed validation."
        actions={(
          <Link to="/new" className={buttonStyles('primary', 'md')}>
            <Mic size={15} aria-hidden /> New invoice
          </Link>
        )}
      />

      {!loading && invoices.length > 0 && (
        <>
          <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-4 border-y border-line-soft py-5">
            <div>
              <dt className="text-[11.5px] text-muted">Total issued</dt>
              <dd className="tabular display mt-1 text-[26px] text-ink">{money(value, currency)}</dd>
            </div>
            <Figure label="Invoices" value={data?.total ?? 0} />
            <Figure label="Emailed" value={sent} />
            <Figure label="Awaiting send" value={issued} />
            {failed > 0 && <Figure label="Failed" value={failed} tone="danger" />}
          </dl>
          <p className="mb-2 mt-3 text-[11.5px] leading-relaxed text-muted">
            Payment status lives in Stripe — Voice2Invoice does not track paid or overdue yet, so it
            does not claim to.
          </p>
        </>
      )}

      {error ? <div className="mt-6"><ErrorNote message={error} onRetry={refresh} /></div>
        : loading ? <SkeletonRows rows={5} />
          : (
            <DataTable<InvoiceSummary>
              rows={invoices}
              rowKey={(i) => i.job_id}
              rowHref={(i) => `/invoices/${i.job_id}`}
              columns={[
                {
                  key: 'customer', header: 'Customer', cell: 'flex-[1.4]',
                  render: (i) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        border border-line bg-raised text-muted transition-colors duration-[120ms]
                        group-hover:border-accent-line group-hover:bg-accent-soft group-hover:text-accent">
                        <Receipt size={14} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
                          {i.customer_name ?? '—'}
                          {i.demo && <StatusPill tone="neutral" className="shrink-0">Demo</StatusPill>}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted">
                          {i.invoice_number ?? 'No number'}
                        </span>
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'work', header: 'Job', cell: 'flex-1', from: 'lg',
                  render: (i) => (
                    <span className="truncate text-[12px] text-muted">{i.work_performed ?? '—'}</span>
                  ),
                },
                {
                  key: 'amount', header: 'Amount', cell: 'w-24', align: 'right',
                  render: (i) => (
                    <span className="tabular text-[13px] font-semibold text-ink">
                      {money(i.amount_to_charge, currency)}
                    </span>
                  ),
                },
                {
                  key: 'status', header: 'Status', cell: 'w-[116px]',
                  render: (i) => (
                    <InvoiceStatusPill
                      invoiceId={i.invoice_id}
                      sendStatus={i.send_status}
                      status={i.status}
                    />
                  ),
                },
                {
                  key: 'date', header: 'Created', cell: 'w-20', align: 'right', from: 'sm',
                  render: (i) => (
                    <time dateTime={i.timestamp} title={absoluteTime(i.timestamp)} className="text-[11.5px] text-muted">
                      {relativeTime(i.timestamp)}
                    </time>
                  ),
                },
                {
                  key: 'go', header: '', cell: 'w-16', align: 'right',
                  render: (i) => (i.hosted_invoice_url ? (
                    <a
                      href={i.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:text-accent-hover"
                    >
                      Stripe <ExternalLink size={11} aria-hidden />
                    </a>
                  ) : (
                    <ArrowRight
                      size={13}
                      className="text-muted transition-transform duration-[120ms] group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  )),
                },
              ]}
              empty={(
                <Empty
                  icon={<Receipt size={18} aria-hidden />}
                  title="No invoices yet"
                  body="Create your first invoice by speaking. Nothing is billed until you review and send it."
                  action={(
                    <Link to="/new" className={buttonStyles('primary', 'md')}>
                      <Mic size={15} aria-hidden /> Start speaking
                    </Link>
                  )}
                />
              )}
            />
          )}
    </PageBody>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className={`tabular mt-1 text-[19px] font-semibold tracking-tight
        ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}
