import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';

export async function appendJob(record) {
  try {
    await mkdir(dirname(config.jobsFile), { recursive: true });
    await appendFile(config.jobsFile, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    console.error('[job-log] WRITE FAILED:', err.message, JSON.stringify(record));
  }
}

// Read the append-only log back, newest first. A corrupt line is skipped rather
// than failing the whole read — the log is an audit trail, not a database.
export async function readJobs() {
  let text;
  try {
    text = await readFile(config.jobsFile, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const jobs = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { jobs.push(JSON.parse(line)); }
    catch { console.warn('[job-log] skipped unparseable line'); }
  }
  // Newest first by job time. Real appends are already chronological, but sorting
  // keeps the ordering correct for backfilled or seeded records too.
  return jobs.sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')));
}
