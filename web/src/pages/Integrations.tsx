import { Check, CircleDashed, ExternalLink, TriangleAlert } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { Settings } from '../lib/types';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import { ConceptNote, ErrorNote, Section, Skeleton, StatusPill } from '../components/ui';

/**
 * Live connections report their genuine state from /api/settings. Everything in
 * the second group is an integration the product would offer and does not have —
 * listed so the shape of the ecosystem is visible, never shown as connected.
 */
export default function Integrations() {
  const { data, error, loading, refresh } = useApi<Settings>('/api/settings');

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Integrations" />
        <div className="space-y-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      </PageBody>
    );
  }
  if (error) return <PageBody><PageHeader title="Integrations" /><ErrorNote message={error} onRetry={refresh} /></PageBody>;
  if (!data) return null;

  const live = [
    {
      name: 'Twilio WhatsApp',
      blurb: 'Technicians send voice notes from WhatsApp; jobs arrive automatically.',
      state: data.configured.twilio && data.configured.whatsapp_number
        ? data.verified?.twilio === false ? 'unverified' : 'connected'
        : 'missing',
      detail: data.configured.whatsapp_number_hint
        ? `Sandbox number ending ${data.configured.whatsapp_number_hint}`
        : 'No sandbox number set',
    },
    {
      name: 'Speech + language model',
      blurb: 'Transcribes recordings and extracts the job details.',
      state: data.configured.ai
        ? data.verified?.ai === false ? 'unverified' : 'connected'
        : 'missing',
      detail: `${data.transcription_model} · ${data.extraction_model}`,
    },
    {
      name: 'Stripe',
      blurb: 'Creates and emails the invoice, and takes the payment.',
      state: data.configured.stripe
        ? data.verified?.stripe === false ? 'unverified' : 'connected'
        : 'missing',
      detail: 'Test mode — the server refuses to start with a live key',
    },
  ] as const;

  const planned = [
    ['QuickBooks', 'Push issued invoices into your books automatically.'],
    ['Xero', 'Sync customers and invoices both ways.'],
    ['Jobber', 'Pull scheduled jobs in, push invoices back out.'],
    ['Google Calendar', 'Match a recording to the job that was booked that day.'],
    ['Slack', 'Post a message when a voice note needs review.'],
    ['Zapier', 'Trigger your own workflow whenever an invoice is issued.'],
  ];

  return (
    <PageBody>
      <PageHeader
        title="Integrations"
        description="What Voice2Invoice is connected to, and what it could be."
      />

      <Section title="Connected services" description="Reported live from the server configuration." divided={false}>
        <ul className="divide-y divide-line-soft rounded-xl border border-line bg-surface px-5">
          {live.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-5 py-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">{item.name}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.blurb}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-muted">{item.detail}</p>
              </div>
              {item.state === 'connected' ? (
                <StatusPill tone="success" icon={<Check size={11} strokeWidth={3} aria-hidden />}>
                  Connected
                </StatusPill>
              ) : item.state === 'unverified' ? (
                <StatusPill tone="warning" icon={<TriangleAlert size={11} aria-hidden />}>
                  Key looks like a placeholder
                </StatusPill>
              ) : (
                <StatusPill tone="neutral" icon={<CircleDashed size={11} aria-hidden />}>
                  Not set
                </StatusPill>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          Credentials are set in the server&rsquo;s .env file and never reach the browser. This page
          reports whether each one is present and whether it looks like a real key — never its value.
        </p>
      </Section>

      <Section title="Available to build" className="mt-9">
        <ConceptNote>
          None of these are implemented. They are listed to show where the product goes next — no
          button here will connect anything.
        </ConceptNote>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {planned.map(([name, blurb]) => (
            <li
              key={name}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">{name}</p>
                  <StatusPill tone="neutral">Not built</StatusPill>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">{blurb}</p>
              </div>
              <button
                type="button"
                disabled
                title="Not implemented in this demo"
                className={buttonStyles('secondary', 'sm', 'mt-4 w-full')}
              >
                Connect <ExternalLink size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </PageBody>
  );
}
