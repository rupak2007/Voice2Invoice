// In-memory tracker for jobs currently moving through the pipeline.
// Persisted job records are only written when processing finishes (see store.js),
// so this is what lets the dashboard show real in-flight progress instead of guessing.
// Intentionally ephemeral: it is a live view, not a source of truth.

const ACTIVE = new Map();
const TTL_MS = 10 * 60 * 1000;

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of ACTIVE) {
    if (entry.updated_at_ms < cutoff) ACTIVE.delete(id);
  }
}

export function setStage(jobId, stage, patch = {}) {
  if (!jobId) return;
  const now = Date.now();
  const existing = ACTIVE.get(jobId);
  ACTIVE.set(jobId, {
    technician_number: null,
    started_at: new Date(now).toISOString(),
    started_at_ms: now,
    ...existing,
    ...patch,
    job_id: jobId,
    stage,
    active: !['completed', 'failed', 'needs_review'].includes(stage),
    updated_at: new Date(now).toISOString(),
    updated_at_ms: now,
  });
  prune();
}

export function listActive() {
  prune();
  return [...ACTIVE.values()]
    .sort((a, b) => b.started_at_ms - a.started_at_ms)
    .map(({ started_at_ms, updated_at_ms, ...rest }) => rest);
}

export function clear() {
  ACTIVE.clear();
}
