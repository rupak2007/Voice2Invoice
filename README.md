# Voice2Invoice

Speak the job, get an invoice. Voice2Invoice turns a spoken description of finished work into a structured job record, a **Stripe Test Mode** invoice, and an audit-log entry.

## Try it in two minutes

Needs [Node 20+](https://nodejs.org). No accounts, no keys, no credit card.

```bash
npm install
npm run setup
cp .env.example .env
npm run seed:demo
npm start
```

Open **http://localhost:3000**. The dashboard, jobs, invoices, review workspace and the rest are
populated with clearly-labelled demo records, so you can click through the whole product straight
away. Remove them at any time with `npm run seed:demo -- --clear`.

**To make the microphone actually work**, add one free key. Grab it at
[console.groq.com/keys](https://console.groq.com/keys), put it in `.env`:

```text
AI_API_KEY=gsk_your_real_key_here
```

Restart, press **Start speaking**, and describe a job out loud — for example
*"Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings. Took two
hours. Charge 250 dollars."* You'll watch it get transcribed, understood, and drafted into an
invoice you review before anything is sent.

Without that key the app still runs and every screen works on the demo data — only recording and
transcription fail. Sending an invoice additionally needs a Stripe **test** key; the server refuses
to start with a live one.

---

There are two ways in, and they share the same speech and extraction pipeline:

```text
A. WhatsApp  voice note → Twilio → webhook ─┐
B. In-app    recording  → upload ───────────┤
                                            ↓
            Whisper transcript → LLM extraction (strict JSON) → validation
                                            ↓
        A. validation gate → invoice automatically, or needs_review
        B. human review screen → you edit and confirm → invoice
                                            ↓
                      job record (data/jobs.jsonl) → audit log
```

**A — WhatsApp** is for the technician who has one hand free and no time to type. It is fully automatic, so the gate is strict: if the amount or the customer isn't clearly stated, **no invoice is created**. The job is recorded as `needs_review` and the technician is asked to resend.

**B — In-app** is for the person doing the billing. You record in the browser, the same pipeline drafts an invoice, and then you land on a review screen where you can split lines, price parts, add tax or a discount, and see exactly what the customer will receive. Nothing is billed until you press send.

**The two paths meet.** When A refuses to bill — the technician never said a price, say — the job is not a dead end. Open it and press **Build this invoice**: the transcript, the customer, the work and the parts all carry over into B, and you fill in what was missing. The blocking reason follows it across as a flag to resolve, and the rebuilt draft still has to pass the same send gate as any other.

In both paths the model never invents a price. The only number it can supply is the total that was actually spoken out loud; every other price on an invoice is typed by a person.

---

## 1. Prerequisites

- **Node.js 20+** — check with `node -v`
- **ngrok** (or `cloudflared`) — to expose your local server to Twilio's webhook
- Free accounts, all no-cost / test-mode: **[Twilio](https://www.twilio.com/try-twilio)** (WhatsApp Sandbox), **[Groq](https://console.groq.com)** (or OpenAI) for Whisper + LLM, **[Stripe](https://dashboard.stripe.com/register)** (Test Mode)

## 2. Installation

```bash
npm install
npm run setup
cp .env.example .env
```

`npm install` installs the server. `npm run setup` installs and builds the dashboard into `web/dist`, which the server then serves at `/`.

## 3. Environment

Open `.env` and fill in exactly these 5 required values — everything else in `.env.example` already has a working default:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

AI_API_KEY=

STRIPE_SECRET_KEY=

WEBHOOK_BASE_URL=
```

| Variable | Where it comes from |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio Console → dashboard home |
| `TWILIO_WHATSAPP_NUMBER` | Twilio Console → Messaging → Try it out → Send a WhatsApp message — the sandbox number, **with** the `whatsapp:` prefix, e.g. `whatsapp:+14155238886` |
| `AI_API_KEY` | Groq Console → API Keys (default provider — free, no card) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys, **Test mode** on. Must start with `sk_test_` or `rk_test_` — the server **refuses to start** with a live key |
| `WEBHOOK_BASE_URL` | Your ngrok/tunnel URL once it's running (step 5) — no trailing slash |

Every variable read by the code is in `.env.example`, and every variable in `.env.example` is read by the code. Secrets are only ever read server-side — see §9.

## 4. Start the server

```bash
npm run dev
```

This serves both the API and the dashboard on one port:

- Dashboard — <http://localhost:3000>
- Health check — <http://localhost:3000/health> → `{"ok":true}`

To work on the frontend with hot reload, run the server *and* `npm run dev:web` (Vite on :5173, proxying `/api` to :3000).

## 5. Public webhook (ngrok)

In a second terminal:

```bash
ngrok http 3000
```

ngrok prints a forwarding URL like `https://abcd1234.ngrok-free.app`. Copy the **https** one into `.env` as `WEBHOOK_BASE_URL` (no trailing slash) and restart the server.

The exact URL to give Twilio is:

```text
https://abcd1234.ngrok-free.app/webhook/whatsapp
```

The Settings page in the dashboard shows this exact address once `WEBHOOK_BASE_URL` is set.

## 6. Twilio setup (WhatsApp Sandbox)

1. Twilio Console → **Messaging → Try it out → Send a WhatsApp message**.
2. From your phone, send the `join <your-code>` message shown there to the sandbox number. One-time per phone.
3. Open **Sandbox settings**.
4. Under "When a message comes in", paste `https://<your-ngrok-id>.ngrok-free.app/webhook/whatsapp`, method **POST**. Save.
5. Send a voice note. The server logs `[in] SM... media=1 type=audio/ogg`, then each pipeline stage.

## 7. AI setup (speech-to-text + extraction)

Default is **Groq** (already set in `.env.example`) — just set `AI_API_KEY`:

```env
AI_BASE_URL=https://api.groq.com/openai/v1
TRANSCRIPTION_MODEL=whisper-large-v3-turbo
EXTRACTION_MODEL=llama-3.3-70b-versatile
```

To use OpenAI instead, change only these three lines:

```env
AI_BASE_URL=https://api.openai.com/v1
TRANSCRIPTION_MODEL=whisper-1
EXTRACTION_MODEL=gpt-4o-mini
```

List current Groq models any time:

```bash
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $AI_API_KEY"
```

## 8. Stripe setup (Test Mode)

1. Stripe Dashboard → confirm the **Test mode** toggle is ON.
2. Developers → API keys → use the **Secret key** (`sk_test_...`), or a **restricted key** with `Customers: Write` and `Invoices: Write` (add `Invoice Items: Write` if listed separately).
3. Put it in `.env` as `STRIPE_SECRET_KEY`.
4. No webhook or product setup is needed — the pipeline creates the customer, invoice, and invoice item directly.
5. Optional: set `DEMO_CUSTOMER_EMAIL` to an address you own so Stripe attempts to email the invoice (best-effort; failure doesn't block the job).

## 9. The dashboard

| Page | What it answers |
|---|---|
| **Overview** | What happened today — jobs processed, invoices generated, needs review, invoiced value, plus drafts waiting on you and recent jobs |
| **New invoice** | Record a job, watch it being transcribed and understood, then review and send the invoice |
| **Jobs** | Every voice note that reached the system, whatever the outcome. Search by customer/work/transcript, filter by status |
| **Job Detail** | The whole transformation: transcript → extracted job → validation → invoice, plus the pipeline timeline |
| **Invoices** | Invoices actually created in Stripe test mode |
| **Invoice** | The invoice document as the customer receives it, printable, with a link back to how it was made |
| **Customers** | Everyone you have invoiced, rolled up live from the job log |
| **Products & parts** | What your recordings mention most often — the start of a priced catalogue |
| **Analytics** | Jobs over time, outcome mix and top customers, computed from the job log |
| **Integrations** | What is connected, and what the product could connect to |
| **Settings** | Read-only view of server configuration, and the exact webhook URL to paste into Twilio |

Customers, Products, Analytics and Integrations are marked **Preview**: their figures are real
aggregations of your own jobs, but saving, editing and connecting are not wired to a backend yet.

### What can and cannot bill someone

Everything to do with reading job history is `GET`-only: the dashboard can never create, edit, or re-run a WhatsApp job, so there is no path from the browser to Stripe that skips `src/validate.js`.

The review flow adds exactly six write routes, and only one of them can bill anyone:

| Route | Touches Stripe? |
|---|---|
| `POST /api/drafts` | No — uploads a recording and starts transcription |
| `POST /api/drafts/blank` | No — opens an empty draft to fill in by hand |
| `PATCH /api/drafts/:id` | No — saves your edits to a draft |
| `DELETE /api/drafts/:id` | No — discards a draft |
| `POST /api/jobs/:id/draft` | No — rebuilds a blocked voice note as a draft |
| `POST /api/drafts/:id/finalize` | **Yes — the only route that creates an invoice** |

`finalize` refuses unless all of the following hold:

1. the request carries an explicit `confirm: true` from a human pressing the button,
2. the document passes server-side validation again (`src/money.js` — customer named, at least one line, positive quantities, whole-cent prices, total above zero and under `MAX_INVOICE_AMOUNT`),
3. the total the reviewer saw on screen equals the total the server computes from the line items, and
4. the draft has not already been invoiced.

Totals are **always** recomputed server-side from the line items. A total sent by the browser is ignored — it is only used to check that what you approved is what the server would bill.

A blocked validation is never displayed as a successful invoice.

**No secret reaches the browser.** `/api/settings` reports whether each credential is present as a boolean (plus the last 4 digits of the public sandbox number) and never its value.

Seed clearly-labelled demo data to see every state without a live run:

```bash
npm run seed:demo
```

Those rows are flagged `demo: true`, badged **Demo** in the UI, and carry no Stripe link because no real invoice exists for them. Remove them with:

```bash
npm run seed:demo -- --clear
```

## 10. Test

```bash
npm test
```

53 unit tests, no network and no `.env` needed — the WhatsApp validation gate, the dashboard's timeline/validation derivations, the invoice arithmetic, every refusal in the finalize path, and the rescue path that rebuilds a blocked voice note.

Optional, needs `AI_API_KEY` (never creates invoices):

```bash
npm run eval
```

Offline debug tool — runs a hand-written JSON through the real validation gate and, with `--invoice`, the real Stripe call. It never skips validation:

```bash
npm run try -- "<transcript>" --json path/to/mock-llm-output.json [--invoice]
```

## 11. Live demo

With the server, tunnel, and Twilio webhook configured, send this exact voice note to the sandbox number:

> **"Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings. Took two hours. Charge 250 dollars."**

Expected within about 10–30 seconds:

```text
1. Dashboard Overview shows a "Processing job" card, stepping through the real stages
2. Stripe Dashboard → Invoices (test mode): new invoice for Bob Vance, $250.00
3. Job Detail shows transcript → extracted job → validation passed → invoice
4. Your WhatsApp: "✅ Invoice for Bob Vance ($250.00) created." + hosted link
```

Then send **"Finished the water heater job for Bob."** (no amount) — expect **no invoice**, a `needs_review` job, and a ⚠️ reply asking you to resend with the amount.

**Backup without WhatsApp:**

```bash
npm run try -- "Finished the water heater job for Bob Vance. Used one 50 gallon unit and two fittings. Took two hours. Charge 250 dollars." --invoice
```

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits with "Missing required env var" | Fill in the 5 required values in `.env` |
| Server exits with "must be a Stripe TEST key" | You pasted a live key. Use `sk_test_...` or `rk_test_...` |
| `/` shows "dashboard has not been built yet" | Run `npm run setup` (or `npm run build:web`) |
| Dashboard loads but shows "Server unreachable" | The API isn't running on :3000, or you opened the Vite dev server without the backend |
| Webhook never gets hit | Tunnel restarted with a new URL; sandbox URL must exactly match `<tunnel>/webhook/whatsapp` and use POST. Check Twilio Console → Monitor → Logs → Errors |
| No WhatsApp reply | `TWILIO_WHATSAPP_NUMBER` missing the `whatsapp:` prefix, or the phone hasn't joined the sandbox |
| `media download failed: HTTP 401` | Wrong `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — they authenticate the audio fetch |
| `unsupported audio type` | Content-type isn't one of `audio/ogg, audio/opus, audio/mpeg, audio/mp3, audio/mp4, audio/m4a, audio/wav, audio/webm` |
| Everything comes back `needs_review` | The amount or customer wasn't clearly stated, or the customer name isn't literally in the transcript — the hallucination guard working as intended |
| Stripe call fails (`invoice_failed`) | Key needs `Customers: Write` + `Invoices: Write`, or switch to the plain `sk_test_...` key |

---

## Project structure

```text
src/                     Backend (Node + Express, ESM)
  server.js              /health, /webhook/whatsapp, /api/*, serves web/dist
  config.js              env loading, defaults, live-key guard
  pipeline.js            orchestration, record lifecycle, stage tracking
  twilio.js              downloadMedia, sendWhatsApp, isValidTwilioRequest
  ai.js                  shared OpenAI-compatible client (Groq/OpenAI)
  transcribe.js          audio buffer -> transcript (Whisper)
  extract.js             SYSTEM_PROMPT + transcript -> strict JSON
  validate.js            pure validation gate (no I/O) — safety-critical
  invoice.js             Stripe Test Mode invoice creation
  store.js               append-only JSONL job log (append + read)
  jobstate.js            in-memory live pipeline tracker
  money.js               invoice arithmetic in cents + document validation — safety-critical
  drafts.js              mutable draft store (data/drafts.json)
  draftflow.js           in-app recording -> transcript -> extraction -> reviewable draft
  api.js                 dashboard API: GET-only for jobs, /drafts for the review flow

web/                     Dashboard (React + Vite + TypeScript + Tailwind v4)
  src/index.css          design tokens (colour, type, radius, shadow, motion, print)
  src/components/        AppShell (sidebar + top bar), ui (sections, pills,
                         states, inputs), Button, VoiceStudio, AiProgress,
                         InvoiceEditor, InvoiceDocument
  src/pages/             Overview, NewInvoice, Jobs, JobDetail,
                         Invoices, InvoiceView, Settings
  src/lib/               api hook, types, formatting,
                         money (mirrors src/money.js for live totals)

scripts/
  transcribe-file.js     npm run transcribe -- ./voice.ogg
  try-transcript.js      npm run try -- "<transcript>" [--invoice] [--json <file>]
  eval-extraction.js     npm run eval
  seed-demo.js           npm run seed:demo [-- --clear]

test/
  validate.test.js       WhatsApp validation gate (10 tests)
  api.test.js            dashboard derivations (13 tests)
  money.test.js          invoice arithmetic + document review gate (16 tests)
  drafts.test.js         finalize refusals, rescue and blank paths (14 tests)
  fixtures/transcripts.json

data/jobs.jsonl          append-only job/compliance log (git-ignored)
data/drafts.json         in-progress drafts, deleted once sent (git-ignored)
```

The interface is dark, with a single teal accent reserved for voice, AI activity, focus and the
one primary action on a screen. Only the live microphone is allowed to glow, and only while it is
actually listening.

Design decisions and UI rules live in `design.md`; product, architecture, schedule and implementation contracts in `prd.md`, `architecture.md`, `plan.md`, `instruction.md`.

---

## Status: verified vs. requires credentials vs. not implemented

**VERIFIED** (actually run in this environment, no external credentials needed):
- `npm install`, `npm run setup`, `npm test` (23/23), `tsc --noEmit`, and `vite build` all pass.
- Server starts, `/health` returns `{"ok":true}`, SPA routes resolve, dashboard is served from `web/dist`.
- Startup guards reject a live Stripe key and a missing required env var.
- Webhook returns `<Response></Response>` immediately; text-only and audio routing both dispatch correctly; failures are caught and recorded without crashing the server.
- **Live pipeline state**: an actually in-flight job (held at the download stage by a slow media server) appeared in `/api/active` as `stage: downloading, active: true` and rendered as a "Processing job" card with a live timeline on the Overview page.
- Validation gate: happy path passes with the exact expected fields; missing amount blocks; ambiguous amount blocks; a hallucinated part is dropped — verified through the real `validateExtraction()`.
- Stripe call sequence (customer → invoice → item → finalize) is reached in order and fails safely on an invalid key, with no key leaked.
- Dashboard rendered and inspected in a real browser at 1400×900 and 375×812: no horizontal overflow on any of the five pages, mobile switches from tables to cards, empty state, needs-review state, failed state, invoiced state and processing state all render correctly.
- `/api/settings` returns no secret values.

**REQUIRES CREDENTIALS** (implemented, exercised as far as possible without them):
- Real Whisper transcription and real LLM extraction (need `AI_API_KEY`).
- A real Stripe test invoice appearing in your dashboard (needs a real `sk_test_...` key).
- The full live WhatsApp → Twilio → webhook → confirmation round trip (needs real Twilio credentials, a joined phone, and a tunnel).

**NOT IMPLEMENTED** (out of MVP scope, per `prd.md` §7 and `architecture.md` §13):
- CRM push, confirm-before-send edit window, Stripe customer lookup/matching, authentication, multi-tenancy, deployment, dark mode.
