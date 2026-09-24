import { readFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import { extract } from '../src/extract.js';
import { validateExtraction } from '../src/validate.js';

const fixtures = JSON.parse(await readFile(new URL('../test/fixtures/transcripts.json', import.meta.url), 'utf8'));

let passed = 0;
for (const fixture of fixtures) {
  const reasons = [];
  try {
    const { json } = await extract(fixture.transcript);
    const v = validateExtraction(json, fixture.transcript, config.limits);
    const status = v.ok ? 'ready' : 'needs_review';
    const expect = fixture.expect ?? {};

    if ('status' in expect && status !== expect.status) {
      reasons.push(`status: expected ${expect.status}, got ${status}`);
    }
    if ('amount_to_charge' in expect && (v.job?.amount_to_charge ?? null) !== expect.amount_to_charge) {
      reasons.push(`amount_to_charge: expected ${expect.amount_to_charge}, got ${v.job?.amount_to_charge ?? null}`);
    }
    if ('parts_count' in expect && (v.job?.parts_used?.length ?? 0) !== expect.parts_count) {
      reasons.push(`parts_count: expected ${expect.parts_count}, got ${v.job?.parts_used?.length ?? 0}`);
    }
    if ('follow_up_required' in expect && (v.job?.follow_up_required ?? false) !== expect.follow_up_required) {
      reasons.push(`follow_up_required: expected ${expect.follow_up_required}, got ${v.job?.follow_up_required ?? false}`);
    }
  } catch (err) {
    reasons.push(`error: ${err.message}`);
  }

  if (reasons.length === 0) {
    passed++;
    console.log(`PASS ${fixture.name}`);
  } else {
    console.log(`FAIL ${fixture.name} → ${reasons.join('; ')}`);
  }
}

console.log(`\n${passed}/${fixtures.length} passed`);
if (passed !== fixtures.length) process.exit(1);
