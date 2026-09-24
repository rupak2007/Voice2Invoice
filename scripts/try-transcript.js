import { config } from '../src/config.js';
import { extract } from '../src/extract.js';
import { validateExtraction } from '../src/validate.js';
import { newRecord, processTranscript, buildConfirmation } from '../src/pipeline.js';
import { appendJob } from '../src/store.js';
import { createInvoice } from '../src/invoice.js';

// --json <file>: skip the network LLM call and use this JSON file as the "LLM output"
// instead. Useful for testing the validation gate + Stripe wiring without AI_API_KEY.
// This NEVER skips validateExtraction() — it only replaces where the JSON comes from.
const args = process.argv.slice(2);
const doInvoice = args.includes('--invoice');
const jsonFlagIndex = args.indexOf('--json');
const jsonFile = jsonFlagIndex !== -1 ? args[jsonFlagIndex + 1] : null;
const stripped = args.filter((a, i) => a !== '--invoice' && a !== '--json' && i !== jsonFlagIndex + 1);
const transcript = stripped.join(' ').trim();
if (!transcript) {
  console.error('Usage: npm run try -- "<transcript>" [--invoice] [--json <mock-llm-output.json>]');
  process.exit(1);
}

async function getExtraction() {
  if (jsonFile) {
    const { readFile } = await import('node:fs/promises');
    console.log(`(using mock LLM output from ${jsonFile} — no network call made)`);
    return JSON.parse(await readFile(jsonFile, 'utf8'));
  }
  const { json } = await extract(transcript);
  return json;
}

if (!doInvoice) {
  const json = await getExtraction();
  console.log('LLM JSON:\n', JSON.stringify(json, null, 2));
  console.log('Validation:\n', JSON.stringify(validateExtraction(json, transcript, config.limits), null, 2));
} else if (jsonFile) {
  // Mirrors processTranscript's invoice branch, but with a mock JSON source.
  const record = newRecord({ from: 'local-test', messageSid: null });
  record.transcript_raw = transcript;
  const json = await getExtraction();
  record.llm_output_raw = JSON.stringify(json);
  const v = validateExtraction(json, transcript, config.limits);
  Object.assign(record, v.job ?? {});
  record.validation = { blocking: v.blocking, warnings: v.warnings };
  if (!v.ok) {
    record.status = 'needs_review';
  } else {
    try {
      record.stripe = await createInvoice(record);
      record.status = 'invoiced';
    } catch (err) {
      record.status = 'invoice_failed';
      record.failed_stage = 'invoice';
      record.error = err.message;
      record.stripe = err.stripePartial ?? null;
    }
  }
  await appendJob(record);
  console.log(JSON.stringify(record, null, 2));
  console.log('\n' + buildConfirmation(record));
} else {
  const record = newRecord({ from: 'local-test', messageSid: null });
  record.transcript_raw = transcript;
  await processTranscript(record);
  await appendJob(record);
  console.log(JSON.stringify(record, null, 2));
  console.log('\n' + buildConfirmation(record));
}
