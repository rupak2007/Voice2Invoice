// Money is always rendered in the currency the backend is configured with.
// Never convert between currencies (design.md §47).
export function money(amount: number | null | undefined, currency = 'usd', opts: { compact?: boolean } = {}) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: opts.compact ? 0 : 2,
      maximumFractionDigits: opts.compact ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(opts.compact ? 0 : 2)} ${currency.toUpperCase()}`;
  }
}

export function hours(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value} ${value === 1 ? 'hr' : 'hrs'}`;
}

const REL = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return 'just now';
  if (abs < 3600) return REL.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return REL.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 2592000) return REL.format(Math.round(diffSec / 86400), 'day');
  return REL.format(Math.round(diffSec / 2592000), 'month');
}

export function absoluteTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** `whatsapp:+15551234567` → `+1 555 123 4567`. Local/test senders pass through. */
export function technician(number: string | null | undefined) {
  if (!number) return '—';
  const raw = number.replace(/^whatsapp:/, '');
  if (!raw.startsWith('+')) return raw;
  const digits = raw.slice(1);
  if (digits.length === 11) return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return raw;
}

export function duration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
