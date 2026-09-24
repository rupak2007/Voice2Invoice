const KEYS = ['customer_name', 'work_performed', 'parts_used', 'hours_logged',
  'amount_to_charge', 'follow_up_required', 'missing_fields', 'ambiguities'];

const words = (s) => String(s ?? '').toLowerCase()
  .split(/[^a-z0-9']+/)
  .map((w) => w.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
  .filter(Boolean);
const stem = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const isNil = (v) => v === null || v === undefined;

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return NaN;
}
const numbersIn = (text) =>
  (String(text ?? '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map((s) => Number(s.replace(/,/g, '')));

export function validateExtraction(raw, transcript, limits) {
  const blocking = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, job: null, blocking: ['extraction is not a JSON object'], warnings };
  }
  for (const k of KEYS) if (!(k in raw)) blocking.push(`missing key: ${k}`);

  const tWords = new Set(words(transcript));
  const tStems = new Set([...tWords].map(stem));
  const job = {
    customer_name: null, work_performed: null, parts_used: [],
    hours_logged: null, amount_to_charge: null, follow_up_required: false,
  };

  // customer_name (must be grounded in the transcript)
  const name = typeof raw.customer_name === 'string' ? raw.customer_name.trim() : '';
  const nameWords = words(name);
  if (!name || nameWords.length === 0) blocking.push('customer name not stated');
  else if (name.length > 100) blocking.push('customer name is too long');
  else if (!nameWords.every((w) => tWords.has(w))) blocking.push(`customer name "${name}" not found in transcript`);
  else job.customer_name = name;

  // work_performed
  const work = typeof raw.work_performed === 'string' ? raw.work_performed.trim() : '';
  if (!work) blocking.push('work performed not stated');
  else job.work_performed = work.slice(0, 200);

  // amount_to_charge (never inferred)
  if (isNil(raw.amount_to_charge)) blocking.push('amount not stated');
  else {
    const amt = toNumber(raw.amount_to_charge);
    if (!Number.isFinite(amt)) blocking.push('amount is not a number');
    else if (amt <= 0) blocking.push('amount must be greater than 0');
    else if (amt > limits.maxAmount) blocking.push(`amount ${amt} exceeds limit ${limits.maxAmount}`);
    else if (Math.abs(amt * 100 - Math.round(amt * 100)) > 1e-6) blocking.push('amount has more than 2 decimal places');
    else {
      job.amount_to_charge = amt;
      if (typeof raw.amount_to_charge === 'string') warnings.push('amount was returned as text and converted');
      if (!numbersIn(transcript).includes(amt)) warnings.push('amount not stated as digits in transcript — verify');
    }
  }

  // hours_logged
  if (isNil(raw.hours_logged)) warnings.push('hours not stated');
  else {
    const h = toNumber(raw.hours_logged);
    if (!Number.isFinite(h) || h <= 0 || h > limits.maxHours) blocking.push(`hours_logged invalid: ${raw.hours_logged}`);
    else job.hours_logged = h;
  }

  // parts_used (drop anything not grounded in the transcript)
  if (!Array.isArray(raw.parts_used)) blocking.push('parts_used is not a list');
  else {
    for (const p of raw.parts_used) {
      const item = p && typeof p.item === 'string' ? p.item.trim() : '';
      if (!item) { warnings.push('dropped malformed part entry'); continue; }
      const itemStems = words(item).filter((w) => w.length >= 3).map(stem);
      if (!itemStems.some((w) => tStems.has(w))) { warnings.push(`dropped part not found in transcript: "${item}"`); continue; }
      let quantity = null;
      if (!isNil(p.quantity)) {
        const q = toNumber(p.quantity);
        if (Number.isFinite(q) && q > 0) quantity = q;
        else warnings.push(`invalid quantity for "${item}" ignored`);
      }
      job.parts_used.push({ item: item.slice(0, 100), quantity });
    }
  }

  // follow_up_required
  if (typeof raw.follow_up_required === 'boolean') job.follow_up_required = raw.follow_up_required;
  else warnings.push('follow_up_required was not a boolean; set to false');

  // ambiguities: any entry blocks
  if (!Array.isArray(raw.ambiguities)) blocking.push('ambiguities is not a list');
  else for (const a of raw.ambiguities) blocking.push(`ambiguous: ${String(a).slice(0, 200)}`);

  // missing_fields: shape + contradiction check
  if (!Array.isArray(raw.missing_fields)) blocking.push('missing_fields is not a list');
  else for (const f of ['customer_name', 'amount_to_charge']) {
    if (raw.missing_fields.includes(f) && !isNil(raw[f])) {
      blocking.push(`contradictory extraction: ${f} marked missing but has a value`);
    }
  }

  return { ok: blocking.length === 0, job, blocking, warnings };
}
