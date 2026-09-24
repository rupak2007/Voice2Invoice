import type { JobSummary } from './types';

/**
 * Client-side aggregations of the real job log.
 *
 * Voice2Invoice has no customer or product tables yet. Rather than invent
 * records, these functions roll up the jobs that genuinely exist — so the
 * Customers, Products and Analytics screens show the user's own history.
 * The moment those tables ship, these become the fallback rather than the
 * source.
 */

export interface CustomerRollup {
  name: string;
  jobs: number;
  invoiced: number;
  needsReview: number;
  billed: number;
  lastSeen: string;
}

export function rollUpCustomers(jobs: JobSummary[]): CustomerRollup[] {
  const map = new Map<string, CustomerRollup>();

  for (const job of jobs) {
    const name = job.customer_name?.trim();
    if (!name) continue; // a job with no identified customer is not a customer
    const current = map.get(name) ?? {
      name, jobs: 0, invoiced: 0, needsReview: 0, billed: 0, lastSeen: job.timestamp,
    };
    current.jobs += 1;
    if (job.status === 'invoiced') {
      current.invoiced += 1;
      current.billed += job.amount_to_charge ?? 0;
    }
    if (job.status === 'needs_review') current.needsReview += 1;
    if (job.timestamp > current.lastSeen) current.lastSeen = job.timestamp;
    map.set(name, current);
  }

  return [...map.values()].sort((a, b) => b.billed - a.billed || b.jobs - a.jobs);
}

export interface ProductRollup {
  item: string;
  timesUsed: number;
  totalQuantity: number;
  jobs: string[];
}

/**
 * Parts the technicians actually named. Deliberately has no price column: the
 * model never prices a part, so the job log has no price to roll up.
 */
export function rollUpParts(jobs: { parts_used?: { item: string; quantity: number | null }[]; customer_name: string | null }[]): ProductRollup[] {
  const map = new Map<string, ProductRollup>();

  for (const job of jobs) {
    for (const part of job.parts_used ?? []) {
      const key = part.item?.trim().toLowerCase();
      if (!key) continue;
      const current = map.get(key) ?? { item: part.item.trim(), timesUsed: 0, totalQuantity: 0, jobs: [] };
      current.timesUsed += 1;
      current.totalQuantity += part.quantity ?? 1;
      if (job.customer_name) current.jobs.push(job.customer_name);
      map.set(key, current);
    }
  }

  return [...map.values()].sort((a, b) => b.timesUsed - a.timesUsed);
}

export interface DayBucket { day: string; label: string; count: number; value: number }

/** Jobs and billed value per day, oldest first, for the last `days` days. */
export function bucketByDay(jobs: JobSummary[], days = 14): DayBucket[] {
  const buckets: DayBucket[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    buckets.push({
      day,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
      value: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.day, i]));
  for (const job of jobs) {
    const key = job.timestamp?.slice(0, 10);
    const i = key ? index.get(key) : undefined;
    if (i === undefined) continue;
    buckets[i].count += 1;
    if (job.status === 'invoiced') buckets[i].value += job.amount_to_charge ?? 0;
  }
  return buckets;
}

export function statusBreakdown(jobs: JobSummary[]) {
  const total = jobs.length || 1;
  const count = (s: JobSummary['status']) => jobs.filter((j) => j.status === s).length;
  return [
    { key: 'invoiced', label: 'Invoiced', value: count('invoiced'), tone: 'success' as const },
    { key: 'needs_review', label: 'Needs review', value: count('needs_review'), tone: 'warning' as const },
    { key: 'invoice_failed', label: 'Invoice failed', value: count('invoice_failed'), tone: 'danger' as const },
    { key: 'failed', label: 'Failed', value: count('failed'), tone: 'danger' as const },
  ].map((row) => ({ ...row, share: Math.round((row.value / total) * 100) }));
}
