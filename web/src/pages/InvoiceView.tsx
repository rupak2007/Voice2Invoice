import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, PenLine, Route } from 'lucide-react';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { Button, ExternalLinkButton, buttonStyles } from '../components/Button';
import { PageBody } from '../components/AppShell';
import { ErrorNote, Skeleton } from '../components/ui';
import { useApi } from '../lib/useApi';
import { computeTotals } from '../lib/money';
import type { InvoiceDoc, JobDetail, Settings } from '../lib/types';

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Rebuilds a document view for invoices that came in over WhatsApp, which were
 * billed as a single line. Nothing is invented: the line is the work the
 * technician described, priced at the amount recorded.
 */
function documentFromJob(job: JobDetail, daysUntilDue: number): InvoiceDoc {
  const issue = job.timestamp?.slice(0, 10) ?? '';
  return {
    customer: { name: job.customer_name ?? '', email: '', address: '' },
    issue_date: issue,
    due_date: issue ? addDays(job.timestamp, daysUntilDue) : '',
    line_items: [{
      id: 'line_1',
      description: job.work_performed ?? 'Work performed',
      quantity: 1,
      unit_price: job.amount_to_charge ?? 0,
    }],
    tax_rate: 0,
    discount: { type: 'amount', value: 0 },
    notes: '',
  };
}

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error, loading, refresh } = useApi<JobDetail>(id ? `/api/jobs/${id}` : null);
  const { data: settings } = useApi<Settings>('/api/settings');

  if (loading) {
    return (
      <PageBody>
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-6 h-[580px] w-full rounded-xl" />
          <span className="sr-only">Loading invoice</span>
        </div>
      </PageBody>
    );
  }
  if (error) {
    return <PageBody><ErrorNote title="Could not load this invoice" message={error} onRetry={refresh} /></PageBody>;
  }
  if (!job) return <PageBody><ErrorNote title="Not found" message="This invoice does not exist." /></PageBody>;

  const businessName = settings?.business_name ?? 'Your Business';
  const currency = job.currency ?? 'usd';
  const invoice = job.invoice_document ?? documentFromJob(job, settings?.days_until_due ?? 7);
  const totals = job.invoice_document?.totals ?? computeTotals(invoice);

  const sent = job.stripe?.send_status === 'sent';
  const failed = job.status === 'invoice_failed';

  const paymentNote = failed
    ? 'This invoice was never issued, so there is nothing to pay.'
    : `Payable within ${settings?.days_until_due ?? 7} days of the issue date. `
      + `${sent ? 'A payment link was emailed to the customer.' : 'Use the Stripe link to take payment.'}`;

  return (
    <PageBody className="print-root">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted
            transition-colors duration-[120ms] hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden /> All invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/jobs/${job.job_id}`} className={buttonStyles('ghost', 'sm')}>
            <Route size={14} aria-hidden /> How it was made
          </Link>
          {job.draft_id && (
            <Link to={`/new?draft=${job.draft_id}`} className={buttonStyles('ghost', 'sm')}>
              <PenLine size={14} aria-hidden /> Source draft
            </Link>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Download size={14} aria-hidden /> Download PDF
          </Button>
          {job.stripe?.hosted_invoice_url && (
            <ExternalLinkButton variant="primary" size="sm" href={job.stripe.hosted_invoice_url}>
              <ExternalLink size={14} aria-hidden /> Open in Stripe
            </ExternalLinkButton>
          )}
        </div>
      </div>

      {failed && (
        <div className="no-print mx-auto mb-6 max-w-3xl">
          <ErrorNote
            title="Stripe did not accept this invoice"
            message={`${job.error ?? 'The invoice was not created.'} The document below is what you approved — nothing was billed.`}
          />
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <InvoiceDocument
          invoice={invoice}
          totals={totals}
          currency={currency}
          businessName={businessName}
          headingLevel="h1"
          invoiceNumber={job.stripe?.invoice_number ?? null}
          paymentNote={paymentNote}
          stamp={
            failed ? { label: 'Not sent', tone: 'void' }
              : sent ? { label: 'Sent', tone: 'issued' }
                : { label: 'Issued', tone: 'issued' }
          }
        />

        {!job.invoice_document && (
          <p className="no-print mt-4 text-[11.5px] leading-relaxed text-muted">
            This invoice came in over WhatsApp and was billed as a single line for the amount stated
            in the voice note.
          </p>
        )}
      </div>
    </PageBody>
  );
}
