// Writes clearly-labelled demo job records into JOBS_FILE so the dashboard can be
// shown without a live WhatsApp/Stripe run. Every record carries `demo: true`, and
// the UI badges those rows as demo data. Demo records deliberately have NO hosted
// Stripe URL, because no real invoice exists for them.
//
//   npm run seed:demo          add demo records
//   npm run seed:demo -- --clear   remove demo records, keep real ones
//
// This script writes to the job log only. It cannot create invoices: it never
// touches Stripe, and the validation gate is not involved.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../src/config.js';
import { appendJob } from '../src/store.js';
import { createDraft, deleteDraft, listDrafts } from '../src/drafts.js';

const TECH = 'whatsapp:+15551234567';
const TECH2 = 'whatsapp:+15557654321';
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const jobs = [
  {
    job_id: 'job_demo_0001', status: 'invoiced', failed_stage: null,
    customer_name: 'Bob Vance', work_performed: 'Replaced water heater',
    parts_used: [{ item: '50 gallon unit', quantity: 1 }, { item: 'fittings', quantity: 2 }],
    hours_logged: 2, amount_to_charge: 250, follow_up_required: false,
    technician_number: TECH, timestamp: hoursAgo(3),
    transcript_raw: 'Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings. Took two hours. Charge 250 dollars.',
    message_sid: 'SMdemo0001', source: 'voice',
    validation: { blocking: [], warnings: [] },
    stripe: { customer_id: 'cus_demo0001', invoice_id: 'in_demo0001', invoice_number: 'V2I-DEMO-0001', hosted_invoice_url: null, send_status: 'not_sent' },
    error: null, processing_ms: 7120,
  },
  {
    job_id: 'job_demo_0002', status: 'invoiced', failed_stage: null,
    customer_name: 'Priya Shah', work_performed: 'Unclogged kitchen drain',
    parts_used: [], hours_logged: 0.75, amount_to_charge: 120, follow_up_required: false,
    technician_number: TECH2, timestamp: hoursAgo(9),
    transcript_raw: 'Unclogged the kitchen drain for Priya Shah, took forty-five minutes, charge one twenty.',
    message_sid: 'SMdemo0002', source: 'voice',
    validation: { blocking: [], warnings: ['amount not stated as digits in transcript — verify'] },
    stripe: { customer_id: 'cus_demo0002', invoice_id: 'in_demo0002', invoice_number: 'V2I-DEMO-0002', hosted_invoice_url: null, send_status: 'not_sent' },
    error: null, processing_ms: 6480,
  },
  {
    job_id: 'job_demo_0003', status: 'invoiced', failed_stage: null,
    customer_name: 'Tom Reed', work_performed: 'Inspected the boiler',
    parts_used: [], hours_logged: 1.5, amount_to_charge: 180, follow_up_required: true,
    technician_number: TECH, timestamp: hoursAgo(26),
    transcript_raw: 'Inspected the boiler for Tom Reed, an hour and a half, charge 180 dollars. Need to come back Thursday to replace the pressure valve.',
    message_sid: 'SMdemo0003', source: 'voice',
    validation: { blocking: [], warnings: [] },
    stripe: { customer_id: 'cus_demo0003', invoice_id: 'in_demo0003', invoice_number: 'V2I-DEMO-0003', hosted_invoice_url: null, send_status: 'not_sent' },
    error: null, processing_ms: 5910,
  },
  {
    job_id: 'job_demo_0004', status: 'needs_review', failed_stage: null,
    customer_name: 'Maria Lopez', work_performed: 'Panel upgrade',
    parts_used: [{ item: '200 amp breaker panel', quantity: 1 }],
    hours_logged: 3, amount_to_charge: null, follow_up_required: false,
    technician_number: TECH2, timestamp: hoursAgo(5),
    transcript_raw: "Finished the panel upgrade at Maria Lopez's place. Took three hours, used one 200 amp breaker panel. Didn't get to pricing yet.",
    message_sid: 'SMdemo0004', source: 'voice',
    validation: { blocking: ['amount not stated'], warnings: [] },
    stripe: null, error: null, processing_ms: 6030,
  },
  {
    job_id: 'job_demo_0005', status: 'needs_review', failed_stage: null,
    customer_name: 'Dan Kim', work_performed: 'Fixed the AC',
    parts_used: [], hours_logged: 1, amount_to_charge: null, follow_up_required: false,
    technician_number: TECH, timestamp: hoursAgo(31),
    transcript_raw: "Fixed the AC for Dan Kim, took about an hour, charge him fifteen or fifty, I can't remember which.",
    message_sid: 'SMdemo0005', source: 'voice',
    validation: { blocking: ["ambiguous: amount unclear: 'fifteen or fifty'"], warnings: [] },
    stripe: null, error: null, processing_ms: 6270,
  },
  {
    job_id: 'job_demo_0006', status: 'invoice_failed', failed_stage: 'invoice',
    customer_name: 'Sarah Lee', work_performed: 'Replaced shut-off valve',
    parts_used: [{ item: 'shut-off valve', quantity: 1 }],
    hours_logged: 1, amount_to_charge: 95, follow_up_required: false,
    technician_number: TECH2, timestamp: hoursAgo(48),
    transcript_raw: 'Replaced the shut-off valve for Sarah Lee, about an hour, charge 95 dollars.',
    message_sid: 'SMdemo0006', source: 'voice',
    validation: { blocking: [], warnings: [] },
    stripe: { customer_id: 'cus_demo0006', invoice_id: null, invoice_number: null, hosted_invoice_url: null, send_status: 'not_sent' },
    error: 'Stripe API temporarily unavailable', processing_ms: 8450,
  },
  {
    job_id: 'job_demo_0007', status: 'failed', failed_stage: 'transcription',
    customer_name: null, work_performed: null, parts_used: [],
    hours_logged: null, amount_to_charge: null, follow_up_required: false,
    technician_number: TECH, timestamp: hoursAgo(52),
    transcript_raw: null, message_sid: 'SMdemo0007', source: 'voice',
    validation: { blocking: [], warnings: [] },
    stripe: null, error: 'no speech detected', processing_ms: 3180,
  },
].map((j) => ({ ...j, llm_output_raw: null, demo: true }));

// A reviewable draft, so the voice → review → send flow can be shown without
// spending AI credits. Flagged demo:true like the job records.
const DEMO_TRANSCRIPT =
  'Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings. '
  + 'Took two hours. Charge 250 dollars.';

const demoExtraction = {
  customer_name: 'Bob Vance',
  work_performed: 'Replaced water heater',
  parts_used: [{ item: '50 gallon unit', quantity: 1 }, { item: 'fittings', quantity: 2 }],
  hours_logged: 2,
  amount_to_charge: 250,
  follow_up_required: false,
  missing_fields: [],
  ambiguities: [],
};

const today = new Date().toISOString().slice(0, 10);
const dueDate = new Date(Date.now() + config.daysUntilDue * 86400000).toISOString().slice(0, 10);

const demoDraft = {
  draft_id: 'draft_demo_0001',
  demo: true,
  status: 'ready',
  stage: 'ready',
  source: 'web',
  transcript_raw: DEMO_TRANSCRIPT,
  llm_output_raw: JSON.stringify(demoExtraction),
  extraction: demoExtraction,
  validation: { blocking: [], warnings: [] },
  suggested_parts: [
    { id: 'part_1', item: '50 gallon unit', quantity: 1 },
    { id: 'part_2', item: 'fittings', quantity: 2 },
  ],
  stated_total: 250,
  stated_hours: 2,
  invoice: {
    customer: { name: 'Bob Vance', email: '', address: '' },
    issue_date: today,
    due_date: dueDate,
    line_items: [{ id: 'line_1', description: 'Replaced water heater', quantity: 1, unit_price: 250 }],
    tax_rate: 0,
    discount: { type: 'amount', value: 0 },
    notes: 'Thank you for your business. Payment due within 7 days.',
  },
};

const clear = process.argv.includes('--clear');

if (clear) {
  for (const draft of await listDrafts()) {
    if (draft.demo) await deleteDraft(draft.draft_id);
  }
}

if (clear) {
  let text = '';
  try { text = await readFile(config.jobsFile, 'utf8'); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  const kept = text.split('\n').filter((line) => {
    if (!line.trim()) return false;
    try { return !JSON.parse(line).demo; } catch { return true; }
  });
  await mkdir(dirname(config.jobsFile), { recursive: true });
  await writeFile(config.jobsFile, kept.length ? kept.join('\n') + '\n' : '', 'utf8');
  console.log(`Removed demo records. ${kept.length} real record(s) kept in ${config.jobsFile}`);
} else {
  for (const job of jobs) await appendJob(job);
  for (const draft of await listDrafts()) {
    if (draft.demo) await deleteDraft(draft.draft_id);
  }
  await createDraft(demoDraft);
  console.log(`Seeded ${jobs.length} demo job records into ${config.jobsFile}`);
  console.log('Seeded 1 reviewable demo draft (open "New invoice" to review it).');
  console.log('They are flagged demo:true and shown as "Demo" in the dashboard.');
  console.log('Remove them with: npm run seed:demo -- --clear');
}
