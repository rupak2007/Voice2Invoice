import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CircleAlert, Loader2, Send, Trash2 } from 'lucide-react';
import { VoiceStage } from '../components/VoiceStage';
import { ProcessingStage } from '../components/ProcessingStage';
import { InvoiceEditor } from '../components/InvoiceEditor';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { Button } from '../components/Button';
import { PageBody, PageHeader } from '../components/AppShell';
import { ErrorNote, useToast } from '../components/ui';
import { useApi } from '../lib/useApi';
import { computeTotals } from '../lib/money';
import type { Draft, InvoiceDoc } from '../lib/types';

type Step = 'record' | 'processing' | 'review';

const money = (v: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2,
  }).format(v);

export default function NewInvoice() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const draftId = params.get('draft');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [sendState, setSendState] = useState<'idle' | 'confirming' | 'sending'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);
  const [discarding, setDiscarding] = useState(false);
  const [polling, setPolling] = useState(true);

  const { data: draft, error: draftError, refresh } = useApi<Draft>(
    draftId ? `/api/drafts/${draftId}` : null,
    { pollMs: polling ? 900 : undefined },
  );

  const currency = draft?.currency ?? 'usd';
  const businessName = draft?.business_name ?? 'Your Business';

  useEffect(() => {
    if (draft?.status === 'ready' && draft.invoice && !invoice) {
      setInvoice(draft.invoice);
      setPolling(false);
    }
    if (draft?.status === 'failed') setPolling(false);
    // A draft that cannot be fetched at all is never going to start working.
    if (draftError) setPolling(false);
  }, [draft, invoice, draftError]);

  const step: Step = !draftId ? 'record' : invoice ? 'review' : 'processing';
  const failed = Boolean(draftError) || draft?.status === 'failed';

  const upload = useCallback(async (blob: Blob) => {
    setUploadError(null);
    setUploading(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Upload failed (${res.status})`);
      setPolling(true);
      setParams({ draft: body.draft_id }, { replace: true });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [setParams]);

  const createManual = async () => {
    setUploading(true);
    try {
      const res = await fetch('/api/drafts/blank', { method: 'POST' });
      const body = await res.json();
      if (res.ok) setParams({ draft: body.draft_id }, { replace: true });
    } finally { setUploading(false); }
  };

  // Autosave, so a refresh or a later visit keeps the work.
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!draftId || !invoice || step !== 'review') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice }),
      }).catch(() => { /* best effort; Send re-validates server-side */ });
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [invoice, draftId, step]);

  const totals = useMemo(() => (invoice ? computeTotals(invoice) : null), [invoice]);

  const reset = () => {
    setInvoice(null);
    setPolling(true);
    setSendState('idle');
    setSendError(null);
    setBlocking([]);
    setDiscarding(false);
    setParams({}, { replace: true });
  };

  const discard = async () => {
    if (draftId) {
      try { await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' }); } catch { /* already gone */ }
    }
    reset();
  };

  const send = async () => {
    if (!draftId || !totals) return;
    setSendState('sending');
    setSendError(null);
    setBlocking([]);
    try {
      const res = await fetch(`/api/drafts/${draftId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The total on screen is what we claim to approve. The server refuses if
        // its own arithmetic disagrees.
        body: JSON.stringify({ confirm: true, expected_total: totals.total }),
      });
      const body = await res.json();
      if (res.status === 422) {
        setBlocking(body.blocking ?? []);
        setSendError('This invoice is not ready to send yet.');
        setSendState('idle');
        return;
      }
      if (!res.ok && res.status !== 502) throw new Error(body?.error || `Could not send (${res.status})`);

      // Report what actually happened, never a blanket success.
      if (body.status === 'invoiced') {
        toast({ tone: 'success', title: 'Invoice created', body: `${money(totals.total, currency)} issued in Stripe.` });
      } else {
        toast({ tone: 'danger', title: 'Stripe rejected the invoice', body: 'Nothing was billed. The document was kept.' });
      }
      navigate(`/invoices/${body.job_id}`, { replace: true });
    } catch (err) {
      setSendError((err as Error).message);
      setSendState('idle');
    }
  };

  return (
    <PageBody wide={step === 'review'} className="pb-28 xl:pb-9">
      <div className="no-print">
        <PageHeader
          eyebrow="Voice → AI → invoice"
          title={step === 'record' ? 'New invoice' : step === 'processing' ? 'Reading your recording' : 'Review & send'}
          description={
            failed ? 'That recording did not make it through. Nothing was billed.'
              : step === 'record' ? 'Describe the job out loud, upload a recording, or enter it by hand.'
                : step === 'processing' ? 'Transcribing, then pulling out the details you said.'
                  : 'Check every line. Nothing is billed until you send it.'
          }
          actions={step !== 'record' && !failed && (
            discarding ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
                <p className="text-[12.5px] text-muted">Discard this draft?</p>
                <Button variant="ghost" size="sm" onClick={() => setDiscarding(false)}>Keep</Button>
                <Button variant="danger" size="sm" onClick={discard}>Discard</Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (step === 'review' ? setDiscarding(true) : discard())}
              >
                <Trash2 size={14} aria-hidden /> Discard draft
              </Button>
            )
          )}
        />
        <Steps step={step} failed={failed} />
      </div>

      {step === 'record' && (
        <div className="mx-auto mt-8 max-w-2xl">
          <VoiceStage onCaptured={upload} onManual={createManual} disabled={uploading} />
          {uploading && (
            <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-muted">
              <Loader2 size={13} className="animate-spin" aria-hidden /> Uploading…
            </p>
          )}
          {uploadError && <div className="mt-4"><ErrorNote title="Upload failed" message={uploadError} /></div>}
          <Example />
        </div>
      )}

      {step === 'processing' && (
        failed ? (
          <div className="mx-auto mt-10 max-w-lg">
            <ErrorNote
              title={draftError ? 'Could not load that draft' : 'That recording could not be processed'}
              message={draftError ?? draft?.error ?? 'The pipeline stopped before a draft could be made.'}
              onRetry={refresh}
              action={(
                <button
                  type="button"
                  onClick={discard}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-ink
                    transition-colors duration-[120ms] hover:bg-accent-hover"
                >
                  Record again
                </button>
              )}
            />
          </div>
        ) : (
          <div className="mt-10"><ProcessingStage draft={draft} currency={currency} /></div>
        )
      )}

      {step === 'review' && invoice && totals && draft && (
        <>
          {/* What I said → what AI understood → what will be billed. */}
          <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]
            2xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,400px)]">
            <aside className="min-w-0 xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-20 2xl:self-start">
              <p className="eyebrow">What you said</p>
              {draft.transcript_raw ? (
                <blockquote className="mt-2.5 border-l-2 border-accent-line pl-3 text-[13px]
                  leading-relaxed text-dim">
                  &ldquo;{draft.transcript_raw}&rdquo;
                </blockquote>
              ) : (
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                  This draft was started by hand, so there is no recording behind it.
                </p>
              )}
              {draft.from_job_id && (
                <Link
                  to={`/jobs/${draft.from_job_id}`}
                  className="mt-3 inline-block text-[12px] font-medium text-accent hover:text-accent-hover"
                >
                  Rebuilt from a blocked voice note &rarr;
                </Link>
              )}
            </aside>

            <div className="min-w-0">
              <p className="eyebrow mb-4">What AI understood</p>
              <InvoiceEditor
                invoice={invoice}
                onChange={setInvoice}
                suggestedParts={draft.suggested_parts ?? []}
                currency={currency}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
              <div className="order-2 xl:order-1">
                <p className="eyebrow no-print mb-2">What will be billed</p>
                <InvoiceDocument
                  invoice={invoice}
                  totals={totals}
                  currency={currency}
                  businessName={businessName}
                  density="compact"
                  stamp={{ label: 'Draft', tone: 'draft' }}
                />
              </div>
              <div className="order-1 xl:order-2" id="send-panel">
                <SendPanel
                  draft={draft}
                  total={totals.total}
                  currency={currency}
                  customerName={invoice.customer.name}
                  state={sendState}
                  error={sendError}
                  blocking={blocking}
                  onAskConfirm={() => { setSendState('confirming'); setSendError(null); }}
                  onCancel={() => setSendState('idle')}
                  onSend={send}
                />
              </div>
            </div>
          </div>

          {/* Live total where the sticky panel cannot reach. */}
          <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-base/90
            px-4 py-2.5 backdrop-blur-xl xl:hidden">
            <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 lg:pl-[228px]">
              <div>
                <p className="eyebrow">Total due</p>
                <p className="tabular display text-[22px] text-ink">{money(totals.total, currency)}</p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => document.getElementById('send-panel')?.scrollIntoView({ block: 'center' })}
              >
                <Send size={14} aria-hidden /> Review &amp; send
              </Button>
            </div>
          </div>
        </>
      )}
    </PageBody>
  );
}

function Steps({ step, failed = false }: { step: Step; failed?: boolean }) {
  const items: { id: Step; label: string }[] = [
    { id: 'record', label: 'Speak' },
    { id: 'processing', label: 'AI understands' },
    { id: 'review', label: 'Review & send' },
  ];
  const active = items.findIndex((i) => i.id === step);

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
      {items.map((item, i) => {
        const state = i < active ? 'done' : i === active ? (failed ? 'failed' : 'current') : 'todo';
        return (
          <li key={item.id} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1
                text-[11.5px] font-medium transition-colors duration-[320ms] ${
                state === 'current' ? 'border-accent-line bg-accent-soft text-accent'
                  : state === 'failed' ? 'border-danger-line bg-danger-soft text-danger'
                    : state === 'done' ? 'border-success-line bg-success-soft text-success'
                      : 'border-line bg-surface text-muted'
              }`}
              aria-current={state === 'current' || state === 'failed' ? 'step' : undefined}
            >
              {state === 'done' ? <Check size={11} strokeWidth={3} aria-hidden />
                : state === 'failed' ? <CircleAlert size={11} aria-hidden />
                  : <span className="tabular">{i + 1}</span>}
              {item.label}
            </span>
            {i < items.length - 1 && <span className="h-px w-5 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function SendPanel({
  draft, total, currency, customerName, state, error, blocking, onAskConfirm, onCancel, onSend,
}: {
  draft: Draft;
  total: number;
  currency: string;
  customerName: string;
  state: 'idle' | 'confirming' | 'sending';
  error: string | null;
  blocking: string[];
  onAskConfirm: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const warnings = draft.validation?.warnings ?? [];
  const voiceBlocking = draft.validation?.blocking ?? [];
  const stated = draft.stated_total;
  const differs = stated !== null && Math.abs(stated - total) > 0.005;

  return (
    <section className="no-print rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Total due</p>
          <p className="tabular display mt-1.5 text-[30px] text-ink">{money(total, currency)}</p>
        </div>
        <p className="min-w-0 truncate text-right text-[12.5px] text-muted">
          {customerName || <span className="text-danger">No customer</span>}
        </p>
      </div>

      {(voiceBlocking.length > 0 || warnings.length > 0 || differs) && (
        <ul className="mt-4 space-y-2">
          {differs && (
            <Flag tone="warn">
              You said <strong>{money(stated as number, currency)}</strong>; this totals{' '}
              <strong>{money(total, currency)}</strong>.
            </Flag>
          )}
          {voiceBlocking.map((item) => <Flag key={item} tone="warn">{item}</Flag>)}
          {warnings.map((item) => <Flag key={item} tone="info">{item}</Flag>)}
        </ul>
      )}

      {blocking.length > 0 && (
        <ul className="mt-4 space-y-2">
          {blocking.map((item) => <Flag key={item} tone="error">{item}</Flag>)}
        </ul>
      )}

      {error && <p className="mt-4 text-[12.5px] text-danger">{error}</p>}

      <div className="mt-5">
        {state === 'confirming' ? (
          <div className="fade rounded-xl border border-line bg-raised p-4">
            <p className="text-[13px] leading-relaxed text-ink">
              Create and send an invoice for <strong>{money(total, currency)}</strong>
              {customerName ? <> to <strong>{customerName}</strong></> : null}?
            </p>
            <p className="mt-1.5 text-[12px] text-muted">
              This charges nothing now — it issues the invoice in Stripe.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={onSend}>
                <Send size={13} aria-hidden /> Yes, send it
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={state === 'sending'}
            onClick={onAskConfirm}
          >
            {state === 'sending'
              ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Sending…</>
              : <><Send size={15} aria-hidden /> Review &amp; send</>}
          </Button>
        )}
      </div>
    </section>
  );
}

function Flag({ tone, children }: { tone: 'warn' | 'info' | 'error'; children: React.ReactNode }) {
  const box = {
    warn: 'border-warning-line bg-warning-soft',
    info: 'border-line bg-raised',
    error: 'border-danger-line bg-danger-soft',
  }[tone];
  const icon = { warn: 'text-warning', info: 'text-muted', error: 'text-danger' }[tone];
  return (
    <li className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${box}`}>
      <AlertTriangle size={12} className={`mt-0.5 shrink-0 ${icon}`} aria-hidden />
      <span className="text-dim [&_strong]:font-semibold [&_strong]:text-ink">{children}</span>
    </li>
  );
}

/** States the one rule that matters: the AI never invents a price. */
function Example() {
  const rows = [
    ['Customer', 'Bob Vance'],
    ['Work', 'Replaced water heater'],
    ['Parts', '50 gallon unit, fittings'],
    ['Amount', '$250.00'],
  ];
  return (
    <section className="mt-9 border-t border-line-soft pt-6">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">
        What a good voice note sounds like
      </h2>
      <blockquote className="mt-3 border-l-2 border-accent-line pl-3 text-[13px] leading-relaxed text-dim">
        &ldquo;Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings.
        Took two hours. Charge 250 dollars.&rdquo;
      </blockquote>
      <p className="eyebrow mt-6">What comes back</p>
      <dl className="mt-2 grid gap-x-10 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2">
            <dt className="text-[12.5px] text-muted">{label}</dt>
            <dd className="text-[12.5px] font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 text-[12px] leading-relaxed text-muted">
        Parts come back unpriced — you set those. The amount you say out loud is the only price that
        ever comes from a recording, and you can still change it before sending.
      </p>
    </section>
  );
}
