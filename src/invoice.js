import Stripe from 'stripe';
import { config, requireEnv } from './config.js';

let stripe;
const getStripe = () => (stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY'))); // live keys already rejected in config.js

function describe(job) {
  const parts = job.parts_used.length
    ? job.parts_used.map((p) => (p.quantity ? `${p.quantity} × ${p.item}` : p.item)).join(', ')
    : 'none stated';
  const lines = [
    `Work: ${job.work_performed}`,
    `Parts: ${parts}`,
    `Hours: ${job.hours_logged ?? 'not stated'}`,
  ];
  if (job.follow_up_required) lines.push('Follow-up visit required');
  lines.push(`Ref: ${job.job_id}`);
  return lines.join('\n').slice(0, 500);
}

export async function createInvoice(job) {
  const s = getStripe();
  const idem = (step) => ({ idempotencyKey: `${job.job_id}-${step}` });
  const metadata = { job_id: job.job_id, technician_number: String(job.technician_number) };
  const out = { customer_id: null, invoice_id: null, invoice_number: null, hosted_invoice_url: null, send_status: 'not_sent' };
  try {
    const customer = await s.customers.create({
      name: job.customer_name,
      ...(config.demoCustomerEmail ? { email: config.demoCustomerEmail } : {}),
      metadata,
    }, idem('customer'));
    out.customer_id = customer.id;

    const invoice = await s.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: config.daysUntilDue,
      currency: config.currency,
      auto_advance: false,
      description: describe(job),
      metadata,
    }, idem('invoice'));
    out.invoice_id = invoice.id;

    // One line item = the stated total. Attached explicitly to this invoice.
    await s.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(job.amount_to_charge * 100),
      currency: config.currency,
      description: job.work_performed,
    }, idem('item'));

    const finalized = await s.invoices.finalizeInvoice(invoice.id, {}, idem('finalize'));
    out.invoice_number = finalized.number;
    out.hosted_invoice_url = finalized.hosted_invoice_url;

    if (config.demoCustomerEmail) {
      try {
        await s.invoices.sendInvoice(invoice.id, {}, idem('send'));
        out.send_status = 'sent';
      } catch (err) {
        out.send_status = 'send_failed';
        out.send_error = err.message;
      }
    }
    return out;
  } catch (err) {
    err.stripePartial = out; // keep any IDs already created (a draft may exist)
    throw err;
  }
}

/**
 * Creates a Stripe invoice from a human-reviewed invoice document.
 *
 * Totals are passed in already computed by src/money.js on the server. Stripe's
 * own total is compared against ours afterwards, so a mismatch surfaces instead
 * of silently billing a different number than the reviewer approved.
 */
export async function createInvoiceFromDocument({ jobId, invoice, totals }) {
  const s = getStripe();
  const idem = (step) => ({ idempotencyKey: `${jobId}-${step}` });
  const metadata = { job_id: jobId, source: 'web' };
  const out = {
    customer_id: null, invoice_id: null, invoice_number: null,
    hosted_invoice_url: null, send_status: 'not_sent', total_matches: null,
  };

  const email = invoice.customer?.email?.trim() || config.demoCustomerEmail || null;

  try {
    const customer = await s.customers.create({
      name: invoice.customer.name,
      ...(email ? { email } : {}),
      metadata,
    }, idem('customer'));
    out.customer_id = customer.id;

    const descriptionLines = [];
    if (invoice.customer?.address?.trim()) descriptionLines.push(invoice.customer.address.trim());
    descriptionLines.push(`Issued ${invoice.issue_date} · Due ${invoice.due_date}`);

    const created = await s.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: config.daysUntilDue,
      currency: config.currency,
      auto_advance: false,
      description: descriptionLines.join('\n').slice(0, 500),
      ...(invoice.notes?.trim() ? { footer: invoice.notes.trim().slice(0, 500) } : {}),
      metadata,
    }, idem('invoice'));
    out.invoice_id = created.id;

    // One Stripe line per reviewed line. Whole quantities keep unit price and
    // quantity as separate columns; fractional ones (e.g. 2.5 hrs) must be sent
    // as a single computed amount because Stripe quantities are integers.
    for (const [index, line] of invoice.line_items.entries()) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      const whole = Number.isInteger(quantity) && quantity > 0;

      await s.invoiceItems.create({
        customer: customer.id,
        invoice: created.id,
        currency: config.currency,
        ...(whole
          ? { unit_amount: Math.round(unitPrice * 100), quantity }
          : { amount: Math.round(quantity * unitPrice * 100) }),
        description: whole
          ? line.description
          : `${line.description} (${quantity} × ${unitPrice.toFixed(2)})`,
      }, idem(`item-${index}`));
    }

    if (totals.discount_cents > 0) {
      await s.invoiceItems.create({
        customer: customer.id,
        invoice: created.id,
        currency: config.currency,
        amount: -totals.discount_cents,
        description: invoice.discount?.type === 'percent'
          ? `Discount (${invoice.discount.value}%)`
          : 'Discount',
      }, idem('discount'));
    }

    if (totals.tax_cents > 0) {
      await s.invoiceItems.create({
        customer: customer.id,
        invoice: created.id,
        currency: config.currency,
        amount: totals.tax_cents,
        description: `Tax (${invoice.tax_rate}%)`,
      }, idem('tax'));
    }

    const finalized = await s.invoices.finalizeInvoice(created.id, {}, idem('finalize'));
    out.invoice_number = finalized.number;
    out.hosted_invoice_url = finalized.hosted_invoice_url;
    out.total_matches = finalized.total === totals.total_cents;
    if (!out.total_matches) {
      out.stripe_total_cents = finalized.total;
      console.error(`[invoice] total mismatch for ${jobId}: stripe=${finalized.total} computed=${totals.total_cents}`);
    }

    if (email) {
      try {
        await s.invoices.sendInvoice(created.id, {}, idem('send'));
        out.send_status = 'sent';
      } catch (err) {
        out.send_status = 'send_failed';
        out.send_error = err.message;
      }
    }
    return out;
  } catch (err) {
    err.stripePartial = out;
    throw err;
  }
}
