// Draft store for the in-app voice → invoice flow.
//
// Drafts are mutable working documents, so they cannot live in the append-only
// job log. They live in their own file and are deleted once finalized-and-done.
// The job log (data/jobs.jsonl) stays the permanent audit trail: a draft only
// becomes a job record at the moment a human finalizes it.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './config.js';

const DRAFTS_FILE = join(dirname(config.jobsFile), 'drafts.json');

// Serialises read-modify-write so two concurrent updates cannot clobber each other.
let chain = Promise.resolve();
function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

async function readAll() {
  try {
    return JSON.parse(await readFile(DRAFTS_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    console.error('[drafts] unreadable store, starting empty:', err.message);
    return {};
  }
}

async function writeAll(drafts) {
  await mkdir(dirname(DRAFTS_FILE), { recursive: true });
  await writeFile(DRAFTS_FILE, JSON.stringify(drafts, null, 2), 'utf8');
}

export async function createDraft(initial = {}) {
  return withLock(async () => {
    const drafts = await readAll();
    const now = new Date().toISOString();
    const draft = {
      draft_id: `draft_${randomUUID()}`,
      status: 'processing',
      stage: 'received',
      created_at: now,
      updated_at: now,
      source: 'web',
      transcript_raw: null,
      llm_output_raw: null,
      extraction: null,
      validation: { blocking: [], warnings: [] },
      suggested_parts: [],
      stated_total: null,
      stated_hours: null,
      invoice: null,
      error: null,
      finalized_job_id: null,
      ...initial,
    };
    drafts[draft.draft_id] = draft;
    await writeAll(drafts);
    return draft;
  });
}

export async function getDraft(id) {
  const drafts = await readAll();
  return drafts[id] ?? null;
}

export async function listDrafts() {
  const drafts = await readAll();
  return Object.values(drafts).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function updateDraft(id, patch) {
  return withLock(async () => {
    const drafts = await readAll();
    const existing = drafts[id];
    if (!existing) return null;
    const next = { ...existing, ...patch, updated_at: new Date().toISOString() };
    drafts[id] = next;
    await writeAll(drafts);
    return next;
  });
}

export async function deleteDraft(id) {
  return withLock(async () => {
    const drafts = await readAll();
    if (!drafts[id]) return false;
    delete drafts[id];
    await writeAll(drafts);
    return true;
  });
}
