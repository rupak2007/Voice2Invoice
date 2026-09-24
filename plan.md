# Voice2Invoice — 60-Minute Build Plan

**Goal:** Technician sends a voice note → Voice2Invoice understands it → a test invoice appears → the job is recorded.
Everything else is secondary. File names, environment variables, and statuses match `architecture.md` and `instruction.md`.

---

## Ground Rules

1. **Build the happy path first.** Add guardrails once the happy path works, never before.
2. **Timebox every phase.** When a phase's time runs out, use its *Skip if blocked* option and move on.
3. **Test each layer on its own** using the local scripts, so a Twilio or tunnel problem never stops work on extraction or invoicing.
4. **Minutes 54–60 are for testing only.** No new features after minute 54.
5. **Never block the demo on** CRM, UI, authentication, deployment, analytics, perfect error handling, or advanced compliance.

> **IMPLEMENTATION DECISION: order change from the suggested outline.** Twilio stays early because it is the riskiest external setup. The Phase 1 webhook also sends a reply, which tests outbound WhatsApp messaging early and makes Phase 6 a small wiring step. Extraction, validation, and Stripe are each testable from local scripts, so they never wait on WhatsApp.

---

## Pre-Flight (before the clock starts, about 10–15 min)

Account signups and verification don't count toward the hour, but they can easily take 15 minutes. Do them first.

- [ ] Node.js 20 or newer installed (`node -v`)
- [ ] **Twilio:** free account created → WhatsApp Sandbox activated → your phone has sent `join <code>` to the sandbox number → **Account SID**, **Auth Token**, and **sandbox number** noted
- [ ] **Groq:** free account → API key created
- [ ] **Stripe:** free account → **Test Mode** on → restricted key with Customers: Write and Invoices: Write (add Invoice Items: Write if it's listed separately). If the restricted key gives permission errors, use the `sk_test_…` secret key.
- [ ] **Tunnel:** ngrok installed and authenticated (`ngrok config add-authtoken …`), **or** `cloudflared` installed (quick tunnels need no account)
- [ ] A browser tab open on Stripe Dashboard → Invoices (test mode)
- [ ] 2–3 practice voice notes planned (see `instruction.md` §11)

---

## Phase 0 — 0–5 min: Project Setup

**Objective:** a runnable, empty project with configuration loading and secrets in place.

**Actions**
1. Create the project, install dependencies, and create the folders.
2. Write `package.json` scripts, `.gitignore`, and `.env.example`, then copy `.env.example` to `.env` and fill in the values.
3. Write `src/config.js`: loads env vars, provides `requireEnv()`, and rejects non-test Stripe keys.
4. Check that the Groq model names are still available.

**Files:** `package.json`, `.gitignore`, `.env.example`, `.env`, `src/config.js`

**Commands**
```bash
mkdir voice2invoice && cd voice2invoice
npm init -y
npm pkg set type=module
npm install express twilio openai stripe dotenv
mkdir -p src scripts test/fixtures data
cp .env.example .env   # then fill in the values
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $AI_API_KEY" | grep -o '"id":"[^"]*"'
```
(Run `export AI_API_KEY=...` first for the curl check, or paste the key into the command.)

**Env vars:** all of them, as listed in `instruction.md` §4.

**Expected result:** `node -e "import('./src/config.js').then(()=>console.log('ok'))"` prints `ok`.

**Test:** `STRIPE_SECRET_KEY=sk_live_x node -e "import('./src/config.js')"` must throw "must be a Stripe TEST key". (A variable already set in the shell takes precedence over `.env`.)

**Skip if blocked:** if the Groq models endpoint fails, continue anyway. Phase 2 will show whether the key works. If a model name is gone, pick a current Whisper model and a current Llama/instruct model from the list and set `TRANSCRIPTION_MODEL` / `EXTRACTION_MODEL`.

---

## Phase 1 — 5–13 min: Twilio WhatsApp Webhook

**Objective:** a voice note sent from your phone reaches the local server, and the server can send a WhatsApp reply.

**Actions**
1. `src/twilio.js`: `sendWhatsApp(to, body)` and `downloadMedia(url)` (the download is written now and used in Phase 2).
2. `src/server.js`: `GET /health`, and `POST /webhook/whatsapp`, which immediately returns empty TwiML, logs `From`, `MessageSid`, `NumMedia`, `MediaUrl0`, and `MediaContentType0`, then calls `sendWhatsApp(From, "Received ✅")`.
3. Start the server and the tunnel. Set `WEBHOOK_BASE_URL`, then paste `<tunnel>/webhook/whatsapp` into Twilio Sandbox settings with method POST.

**Files:** `src/server.js`, `src/twilio.js`

**Commands**
```bash
npm run dev                         # terminal 1
ngrok http 3000                     # terminal 2
# fallback: cloudflared tunnel --url http://localhost:3000
curl -s localhost:3000/health       # → {"ok":true}
```

**Env vars:** `PORT`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `WEBHOOK_BASE_URL`, `VALIDATE_TWILIO_SIGNATURE=false`

**Expected result:** sending a voice note from your phone produces a console log with `NumMedia: 1` and `MediaContentType0: audio/ogg`, and the phone receives "Received ✅".

**Test:** send one voice note and one text message. Both should be logged.

**Skip if blocked:**
- If the webhook is never hit, check Twilio Console → Monitor → Logs → Errors, confirm the URL has the `/webhook/whatsapp` path and uses POST, and switch to `cloudflared`.
- If outbound messages fail, check that `TWILIO_WHATSAPP_NUMBER` has the `whatsapp:` prefix and that your phone has joined the sandbox. If it still fails, log the confirmation text instead and keep going.
- **At minute 13, if the webhook still doesn't work,** continue with Phases 2–5 using the local scripts and come back to this only if time allows. The fallback demo is `npm run transcribe` + `npm run try -- --invoice`.

---

## Phase 2 — 13–21 min: Audio Retrieval + Transcription

**Objective:** a real WhatsApp voice note becomes transcript text.

**Actions**
1. `src/ai.js` (shared OpenAI-compatible client with `baseURL = AI_BASE_URL`) and `src/transcribe.js`: `transcribe(buffer, contentType)` using `toFile(buffer, "voice.<ext>")`.
2. `scripts/transcribe-file.js <path>`: reads a local audio file and prints the transcript.
3. Temporarily, the webhook downloads `MediaUrl0`, transcribes it, and logs the transcript.

**Files:** `src/ai.js`, `src/transcribe.js`, `scripts/transcribe-file.js`, `src/server.js` (temporary change)

**Commands**
```bash
npm run transcribe -- ./sample.ogg     # any short audio file you have
```
To get a sample file quickly, record a voice memo on your phone and email or AirDrop it to yourself, or reuse any `.mp3`/`.m4a`.

**Env vars:** `AI_API_KEY`, `AI_BASE_URL`, `TRANSCRIPTION_MODEL`

**Expected result:** after sending a voice note, the console shows the transcript within a few seconds.

**Test:** say the happy-path sentence from `instruction.md` §10 and check that the customer name and amount are transcribed correctly.

**Skip if blocked:**
- For Groq errors, switch to OpenAI by changing env vars only (`AI_BASE_URL=https://api.openai.com/v1`, `TRANSCRIPTION_MODEL=whisper-1`, `EXTRACTION_MODEL=gpt-4o-mini`).
- If the download returns 401, check the SID and token used for Basic auth.
- **At minute 21, if there's still no transcript,** set `ALLOW_TEXT_INPUT=true` so typed WhatsApp text is treated as the transcript. The demo still shows WhatsApp → invoice, and voice can be fixed later.

---

## Phase 3 — 21–31 min: LLM Structured Extraction

**Objective:** a transcript becomes the strict JSON object.

**Actions**
1. `src/extract.js`: the system prompt, copied exactly from `instruction.md` §7, and `extract(transcript)` → `{ json, raw }`. It uses JSON mode and `temperature: 0`, strips code fences, calls `JSON.parse`, and retries once on failure.
2. `scripts/try-transcript.js "<text>"`: prints the extraction (and, from Phase 4 on, the validation result).
3. `test/fixtures/transcripts.json`: the test transcripts from `instruction.md` §10.

**Files:** `src/extract.js`, `scripts/try-transcript.js`, `test/fixtures/transcripts.json`

**Commands**
```bash
npm run try -- "Just replaced the water heater for Bob Vance, used one 50-gallon unit and two fittings, took about two hours, charge two hundred fifty dollars."
```

**Env vars:** `AI_API_KEY`, `AI_BASE_URL`, `EXTRACTION_MODEL`

**Expected result:** a JSON object with all 8 keys: `customer_name: "Bob Vance"`, `amount_to_charge: 250`, `hours_logged: 2`, two parts, and empty `ambiguities`.

**Test:** run the missing-amount transcript. `amount_to_charge` must be `null` and `missing_fields` must include `"amount_to_charge"`.

**Skip if blocked:** if JSON mode causes errors with the chosen model, remove `response_format` and rely on the prompt plus fence-stripping. Don't tune the prompt beyond two iterations; validation will catch the rest.

---

## Phase 4 — 31–39 min: Validation + Job Record

**Objective:** bad or uncertain extractions can never reach Stripe, and every job is logged.

**Actions**
1. `src/validate.js`: `validateExtraction(json, transcript, limits)`, written from `instruction.md` §8.
2. `test/validate.test.js`: unit tests with hard-coded LLM outputs, so no API calls are needed.
3. `src/store.js`: `appendJob(record)` appends one JSON line to `JOBS_FILE`, creating the folder if needed.
4. Extend `try-transcript.js` to print the validation result.

**Files:** `src/validate.js`, `src/store.js`, `test/validate.test.js`, `scripts/try-transcript.js`

**Commands**
```bash
npm test
npm run eval        # optional if time is short: fixtures → LLM → validation, prints PASS/FAIL
```

**Env vars:** `MAX_INVOICE_AMOUNT`, `MAX_HOURS_LOGGED`, `JOBS_FILE`

**Expected result:** all unit tests pass. The happy path gives `ok: true`. Missing and ambiguous amounts give `ok: false` with reasons.

**Test:** `npm test`, plus `npm run try` on the missing-amount transcript, which must show `ok: false`.

**Skip if blocked:** these checks are **never skipped**: required fields, amount type and range, ambiguities block, and customer-name grounding. If time is short, skip part grounding, the `missing_fields` contradiction check, and `npm run eval`.

---

## Phase 5 — 39–48 min: Stripe Test Mode Invoice

**Objective:** a validated job becomes a finalized test invoice with a hosted link.

**Actions**
1. `src/invoice.js`: `createInvoice(job)` following the sequence in `architecture.md` §8, with idempotency keys, returning `{ customer_id, invoice_id, invoice_number, hosted_invoice_url, send_status }`.
2. Add `--invoice` to `try-transcript.js`: if validation passes, create the invoice and append the job record.

**Files:** `src/invoice.js`, `scripts/try-transcript.js`

**Commands**
```bash
npm run try -- "Just replaced the water heater for Bob Vance, used one 50-gallon unit and two fittings, took about two hours, charge two hundred fifty dollars." --invoice
tail -n 1 data/jobs.jsonl
```

**Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_CURRENCY`, `INVOICE_DAYS_UNTIL_DUE`, `DEMO_CUSTOMER_EMAIL` (optional)

**Expected result:** the invoice for Bob Vance ($250.00) appears in Stripe Dashboard → Invoices (test mode), the script prints the `hosted_invoice_url`, and `jobs.jsonl` has a line with `status: "invoiced"`.

**Test:** open the hosted invoice URL. Then run the missing-amount transcript with `--invoice`. It must **not** create an invoice.

**Skip if blocked:**
- If finalizing fails because of the missing customer email, set `DEMO_CUSTOMER_EMAIL`.
- If `sendInvoice` fails, ignore it (`send_status: send_failed`); the link is enough.
- If the restricted key gives a permission error, use the `sk_test_` key.
- If idempotency keys cause trouble, remove them.

---

## Phase 6 — 48–54 min: Pipeline Wiring + Technician Confirmation

**Objective:** the webhook runs the whole pipeline, and the technician gets the outcome on WhatsApp.

**Actions**
1. `src/pipeline.js`: `processVoiceNote`, `processTextNote`, `processTranscript`, `buildConfirmation`, and the `finally` block that always runs `appendJob` and `notify`. Use the code in `instruction.md` §9.
2. `src/server.js`: replace the temporary Phase 1–2 code with the final routing (audio, text-if-allowed, otherwise the "send a voice note" reply).

**Files:** `src/pipeline.js`, `src/server.js`

**Commands:** `npm run dev` (the tunnel is still running)

**Env vars:** none new. `ALLOW_TEXT_INPUT` is optional.

**Expected result:** a voice note produces "✅ Invoice for Bob Vance ($250.00) created…" with the link, a new invoice in Stripe, and a new line in `jobs.jsonl`.

**Test:** send the happy-path voice note. Then send the missing-amount voice note and confirm you get ⚠️ and no new invoice.

**Skip if blocked:** if the WhatsApp reply fails, `console.log` the confirmation text and show the terminal during the demo.

---

## Phase 7 — 54–60 min: End-to-End Test + Demo Rehearsal (reserved)

**Objective:** prove the Definition of Done and rehearse the demo once.

**Actions**
1. `npm test` (unit tests).
2. From your phone, with `tail -f data/jobs.jsonl` running:
   - Happy path → ✅, invoice in Stripe, `invoiced` line in the log
   - Missing amount → ⚠️, no invoice, `needs_review` line
   - Ambiguous amount → ⚠️, no invoice, `needs_review` line with an ambiguity reason
3. Time the happy path from sending to receiving ✅. It should be under 30 s.
4. Tick the Definition of Done in `instruction.md` §12.
5. Run the demo script from `instruction.md` §11 once.

**Expected result:** every Definition of Done box is ticked.

**Skip if blocked:** if live WhatsApp is flaky, demo with `npm run transcribe` on a recorded voice note, then `npm run try -- "<transcript>" --invoice`, with Stripe open.

---

## Checkpoints and Cut Lines

| Minute | Must have | If not, then… |
|---|---|---|
| 5 | Config loads, dependencies installed | Stop polishing config and hard-fail on missing env vars |
| 13 | Webhook hit from phone | Switch to cloudflared. If it still fails, build on scripts and return later. |
| 21 | Real transcript | Change provider via env, or set `ALLOW_TEXT_INPUT=true` |
| 31 | Valid JSON for the happy path | Drop JSON mode and keep fence-stripping; stop tuning the prompt |
| 39 | Validation blocks missing/ambiguous amounts | Cut part grounding and the eval script, keep the core checks |
| 48 | Stripe invoice from the script | Use the `sk_test_` key and drop idempotency/send |
| 54 | **Feature freeze** | Whatever isn't done is deferred |

## Deferred Unless Everything Above Is Done

In this order: Twilio signature validation → looking up existing Stripe customers → "Processing…" acknowledgment → confirm-before-send with the edit window (FR-17) → CRM push.
