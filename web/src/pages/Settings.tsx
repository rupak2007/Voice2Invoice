import { Link } from 'react-router-dom';
import { Check, CircleDashed, Lock, Plug, TriangleAlert } from 'lucide-react';
import { useApi } from '../lib/useApi';
import type { Settings as SettingsType } from '../lib/types';
import { money } from '../lib/format';
import { PageBody, PageHeader } from '../components/AppShell';
import { buttonStyles } from '../components/Button';
import { ErrorNote, Row, Section, Skeleton, StatusPill } from '../components/ui';

export default function Settings() {
  const { data, error, loading, refresh } = useApi<SettingsType>('/api/settings');

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Settings" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
        <span className="sr-only">Loading settings</span>
      </PageBody>
    );
  }
  if (error) return <PageBody><PageHeader title="Settings" /><ErrorNote message={error} onRetry={refresh} /></PageBody>;
  if (!data) return null;

  const webhook = data.webhook_base_url
    ? `${data.webhook_base_url}${data.webhook_path}`
    : `https://<your-tunnel>${data.webhook_path}`;

  // A key that is present but looks like a placeholder is the one state worth
  // shouting about — the app appears ready and fails on first use.
  const unverified = [
    data.configured.ai && data.verified?.ai === false ? 'the speech / language model key' : null,
    data.configured.stripe && data.verified?.stripe === false ? 'the Stripe key' : null,
    data.configured.twilio && data.verified?.twilio === false ? 'the Twilio account SID' : null,
  ].filter(Boolean) as string[];

  const listed = unverified.length > 1
    ? `${unverified.slice(0, -1).join(', ')} and ${unverified[unverified.length - 1]}`
    : unverified[0];

  return (
    <PageBody>
      <PageHeader
        title="Settings"
        description="Configured on the server. This page reports what is set — it can never show or change a secret."
        actions={(
          <Link to="/integrations" className={buttonStyles('secondary', 'md')}>
            <Plug size={14} aria-hidden /> Integrations
          </Link>
        )}
      />

      {unverified.length > 0 && (
        <div className="mb-6">
          <ErrorNote
            title="Some credentials look like placeholders"
            message={`Voice2Invoice runs and the job history shown here is real, but ${listed} `
              + 'still hold example values. Recording, transcription and sending will fail until '
              + 'real keys are set in the server’s .env file.'}
          />
        </div>
      )}

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <Lock size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-dim">
          Credentials never leave the server. This page reports only whether each one is present and
          whether it looks like a real key — never its value — and nothing here can be edited from
          the browser.
        </p>
      </div>

      <div className="grid gap-9 xl:grid-cols-2">
        <Section title="Business" description="How you appear on every invoice you send." divided={false}>
          <dl className="rounded-xl border border-line bg-surface px-5 py-1">
            <Row label="Business name" value={data.business_name} />
            <Row label="Greeting name" value={data.operator_name ?? 'Not set'} />
            <Row label="Currency" value={data.currency.toUpperCase()} />
            <Row label="Payment terms" value={`${data.days_until_due} days`} />
          </dl>
        </Section>

        <Section title="Voice & AI" description="The models that turn a recording into a draft." divided={false}>
          <dl className="rounded-xl border border-line bg-surface px-5 py-1">
            <Row label="Transcription" value={data.transcription_model} mono />
            <Row label="Extraction" value={data.extraction_model} mono />
            <Row label="Provider" value={data.ai_base_url} mono />
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            The model is never asked to price anything. It may only carry across an amount that was
            spoken out loud; every other price on an invoice is typed by a person.
          </p>
        </Section>

        <Section title="Invoicing" description="Applied to every invoice, from either entry point.">
          <dl className="rounded-xl border border-line bg-surface px-5 py-1">
            <Row label="Maximum invoice" value={money(data.max_invoice_amount, data.currency, { compact: true })} />
            <Row label="Maximum hours" value={`${data.max_hours_logged} hrs`} />
            <Row label="Stripe mode" value="Test — the server refuses to start with a live key" />
            <Row label="Job log" value={data.jobs_file} mono />
          </dl>
        </Section>

        <Section title="Connections" description="Twilio is only needed for WhatsApp; speech and Stripe serve both ways in.">
          <ul className="divide-y divide-line-soft rounded-xl border border-line bg-surface px-5">
            <Connection
              label="Twilio account"
              hint="Account SID and auth token"
              present={data.configured.twilio}
              verified={data.verified?.twilio}
            />
            <Connection
              label="WhatsApp sender"
              hint={data.configured.whatsapp_number_hint
                ? `Sandbox number ending ${data.configured.whatsapp_number_hint}`
                : 'No sandbox number set'}
              present={data.configured.whatsapp_number}
            />
            <Connection
              label="Speech + language model"
              hint={data.ai_base_url}
              present={data.configured.ai}
              verified={data.verified?.ai}
            />
            <Connection
              label="Stripe (test mode)"
              hint="Invoice creation and delivery"
              present={data.configured.stripe}
              verified={data.verified?.stripe}
            />
          </ul>
        </Section>

        <Section title="WhatsApp webhook" description="Paste this into the Twilio sandbox settings." className="xl:col-span-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="eyebrow">When a message comes in (POST)</p>
            <p className="mt-2.5 overflow-x-auto rounded-lg border border-line bg-raised px-3 py-2.5
              font-mono text-[12px] text-dim">
              {webhook}
            </p>
            {!data.webhook_base_url && (
              <p className="mt-2.5 text-[11.5px] text-muted">
                Set <code className="font-mono text-dim">WEBHOOK_BASE_URL</code> in .env to your tunnel
                URL to see the exact address here.
              </p>
            )}
            <dl className="mt-4">
              <Row
                label="Signature validation"
                value={data.validate_signature
                  ? <StatusPill tone="success">On</StatusPill>
                  : <StatusPill tone="warning">Off</StatusPill>}
              />
              <Row
                label="Text input fallback"
                value={data.allow_text_input
                  ? <StatusPill tone="accent">Enabled</StatusPill>
                  : <StatusPill tone="neutral">Disabled</StatusPill>}
              />
            </dl>
          </div>
        </Section>
      </div>
    </PageBody>
  );
}

function Connection({
  label, hint, present, verified,
}: { label: string; hint: string; present: boolean; verified?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="truncate text-[11.5px] text-muted">{hint}</p>
      </div>
      {!present ? (
        <StatusPill tone="neutral" icon={<CircleDashed size={11} aria-hidden />}>Not set</StatusPill>
      ) : verified === false ? (
        <StatusPill tone="warning" icon={<TriangleAlert size={11} aria-hidden />}>Placeholder</StatusPill>
      ) : (
        <StatusPill tone="success" icon={<Check size={11} strokeWidth={3} aria-hidden />}>Configured</StatusPill>
      )}
    </li>
  );
}
