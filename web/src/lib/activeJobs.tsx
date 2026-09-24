import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from './useApi';
import type { ActiveJob } from './types';

interface ActivePayload {
  active: ActiveJob[];
}

interface ActiveContextValue {
  active: ActiveJob[];
  running: ActiveJob[];
  online: boolean;
}

const ActiveContext = createContext<ActiveContextValue>({ active: [], running: [], online: true });

/**
 * Polls the in-memory pipeline tracker once for the whole app. This is real
 * backend state — jobs appear here only while the server is actually processing them.
 */
export function ActiveJobsProvider({ children }: { children: ReactNode }) {
  const { data, error } = useApi<ActivePayload>('/api/active', { pollMs: 2500 });
  const active = data?.active ?? [];
  const value: ActiveContextValue = {
    active,
    running: active.filter((job) => job.active),
    online: !error,
  };
  return <ActiveContext.Provider value={value}>{children}</ActiveContext.Provider>;
}

export function useActiveJobs() {
  return useContext(ActiveContext);
}
