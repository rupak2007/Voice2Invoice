# Voice2Invoice — Product Requirements Document

| | |
|---|---|
| **Version** | 1.1 (MVP build edition) |
| **Derived from** | "PRD: FieldVoice — Voice-to-Invoice & Compliance Engine for Field Trades", v1.0, Sept 10, 2026, owner KK (TechuilaGuys). *FieldVoice* was the original project name. The product is now **Voice2Invoice**. |
| **Build constraint** | The MVP/demo must run on free tiers with $0 spend. Target build time is about **1 hour**. |
| **Companion docs** | `architecture.md` (how it is built), `plan.md` (60-minute schedule), `instruction.md` (coding-agent instructions) |

**Labels used in this document**
- Unlabeled requirements come from the source PRD.
- **IMPLEMENTATION DECISION** marks a choice made to finish the MVP in one hour. These choices are not product requirements and can change later.

---

## 1. Product Overview

**Product name:** Voice2Invoice

**One-line description:** A field technician sends one WhatsApp voice note after a job, and Voice2Invoice turns it into a structured job record, a test invoice, and an audit log entry.

**Product vision:** A technician finishes a job and sends one WhatsApp voice note in their own words, with whatever accent or background noise is present. Within seconds, the customer has a professional invoice, the office's systems are updated, and a compliance record exists. The technician installs no app, logs into nothing, and types nothing.

**Core value proposition**
- **Technician:** billing becomes one voice note, with no forms.
- **Business owner:** invoices go out the same day, fewer charges are forgotten, and nobody chases technicians on Monday.
- **Customer:** gets a clear bill promptly.
- **Everyone:** each job has a timestamped, transcript-backed record.

---

## 2. Problem

**Who has it:** field service businesses and their technicians, such as plumbers, electricians, HVAC technicians, and construction crews.

**What they do today:** technicians finish jobs and put off invoicing until the end of the week, then reconstruct the details from memory. Office admins chase technicians for missing details.

**Why paperwork is painful:** job sites are dirty and time-pressured. Existing tools need a UI:
- Phone-scheduling bots don't handle billing.
- Heavy CRM apps (ServiceTitan, Jobber) require technicians to log in, navigate menus, and type, which they actively avoid.

**Consequences**
- **Lost billables:** 5–10% of billable parts and labor are forgotten and never charged.
- **Delayed invoicing:** invoices go out days or weeks late, which hurts cash flow.
- **Administrative overhead:** admins spend Mondays chasing technicians for job details.
- **Missing records:** no compliance or job-completion record is captured at the point of work.

---

## 3. Users

| User | Problem | Need | How Voice2Invoice interacts |
|---|---|---|---|
| **Field technician** | Paperwork is slow and awkward on site, so it gets delayed and details are forgotten | Log the job and get paid without paperwork | Sends one WhatsApp voice note per job and gets a WhatsApp confirmation back |
| **Business owner / office admin** | Late invoices, forgotten charges, and time spent chasing technicians | Faster billing and complete job data without re-entry | Sees invoices in the Stripe (test) dashboard and job records in the job log. CRM updates come in production. |
| **Customer** | Gets billed late or unclearly | Prompt, clear bill | Receives an invoice. In the MVP this is a Stripe hosted-invoice link (see §11, Q1). |

---

## 4. Core User Journey

```text
Technician finishes job
→ sends WhatsApp voice note to the business number
   e.g. "Just replaced the water heater for Bob Vance, used one 50-gallon unit
         and two fittings, took about two hours, charge two-fifty."
→ Voice2Invoice receives it (Twilio webhook)
→ audio is downloaded and transcribed
→ transcript is structured by an LLM into strict JSON
→ data is validated (nothing uncertain reaches an invoice)
→ invoice is generated in Stripe Test Mode   [only if validation passes]
→ job is recorded in the job/compliance log  [always, including failures]
→ CRM can be updated                          [production only]
→ technician receives a WhatsApp confirmation
   e.g. "✅ Invoice for Bob Vance ($250.00) created."
```

If validation fails, **no invoice is created**. The job is still recorded with status `needs_review`, and the technician is told what is missing.

---

## 5. Functional Requirements

Priority: **MUST** = required for the 1-hour demo. **SHOULD** = build it if time remains. **LATER** = production.

| ID | Area | Requirement | Priority |
|---|---|---|---|
| FR-1 | WhatsApp voice input | Accept a WhatsApp voice note sent to the business number. The MVP uses the Twilio WhatsApp Sandbox; production uses the WhatsApp Business API. | MUST |
| FR-2 | Webhook reception | Receive Twilio's inbound-message webhook (sender, message ID, media URL, media type). **IMPLEMENTATION DECISION:** acknowledge Twilio immediately and process asynchronously, because the full pipeline can exceed Twilio's webhook timeout. | MUST |
| FR-3 | Non-voice messages | If a message has no audio, reply asking for a voice note. **IMPLEMENTATION DECISION:** an optional `ALLOW_TEXT_INPUT` flag treats typed text as the transcript. This is only a demo fallback. | MUST (reply) / SHOULD (flag) |
| FR-4 | Audio retrieval | Download the voice-note file from Twilio using authenticated requests. Reject non-audio media. | MUST |
| FR-5 | Speech-to-text | Transcribe the audio with Whisper, using Whisper's default multilingual behavior. An empty or blank transcript counts as a failure. | MUST |
| FR-6 | LLM extraction | Extract `customer_name`, `work_performed`, `parts_used[]`, `hours_logged`, `amount_to_charge`, and `follow_up_required` from the transcript. | MUST |
| FR-7 | Strict JSON output | The LLM must return one JSON object with a fixed key set, with no markdown or prose. Invalid JSON is retried once and then treated as a failure. | MUST |
| FR-8 | Validation | Validate every extraction before invoicing: required fields, types, numeric ranges, and that key facts appear in the transcript (see §9 and `architecture.md` §6). | MUST |
| FR-9 | Job record creation | Every processed voice note produces a job record, **whatever the outcome**, including `transcript_raw`. | MUST |
| FR-10 | Invoice generation | Only when validation passes: create the customer, invoice, and invoice item in **Stripe Test Mode**, then finalize the invoice. | MUST |
| FR-11 | Invoice delivery | Return the Stripe hosted-invoice link. Also try Stripe's send-invoice action; a failure there is recorded but does not block. | MUST (link) / best-effort (email) |
| FR-12 | Job/compliance log | Keep an append-only, timestamped log of what was done, by whom, and for whom. | MUST |
| FR-13 | Technician confirmation | Send a WhatsApp message with the outcome: invoiced (amount and link), needs review (reason), or failed (what to do). | MUST |
| FR-14 | Error handling | Never create an invoice from uncertain data. Every failure is recorded and reported to the technician. | MUST |
| FR-15 | Test-mode guard | Refuse to start with a live Stripe key. **IMPLEMENTATION DECISION.** | MUST |
| FR-16 | Duplicate protection | The same inbound message must never create two invoices (Stripe idempotency keys). **IMPLEMENTATION DECISION.** | SHOULD |
| FR-17 | Confirm-before-send | Show the parsed data to the technician before sending, with a 60-second window to edit it (e.g., reply "no, $300"). This is the source's risk mitigation. | SHOULD / LATER |
| FR-18 | CRM push | Write-only push of the job record to Jobber, ServiceTitan, or QuickBooks. | LATER |

---

## 6. Job Record Schema

Source fields:

| Field | Type | Source | Description |
|---|---|---|---|
| `customer_name` | string | LLM | Customer name as spoken |
| `work_performed` | string | LLM | Short description of the work |
| `parts_used` | array of `{ item: string, quantity: number \| null }` | LLM | Only parts explicitly mentioned. May be empty. |
| `hours_logged` | number \| null | LLM | Billable hours as stated |
| `amount_to_charge` | number \| null | LLM | Final invoice amount as stated. **Never inferred.** |
| `follow_up_required` | boolean | LLM | True only if a return visit is mentioned |
| `technician_number` | string | System | Sender's WhatsApp number, for accountability |
| `timestamp` | datetime (ISO 8601) | System | Job completion time. **IMPLEMENTATION DECISION:** the time the voice note is received is used as the completion time. |
| `transcript_raw` | string | System | Full transcript, kept for audit and dispute resolution |

**IMPLEMENTATION DECISION: additional operational fields** (full definition in `architecture.md` §8): `job_id`, `status`, `failed_stage`, `message_sid`, `validation`, `llm_output_raw`, `stripe`, `error`, `processing_ms`. The LLM output also carries `missing_fields[]` and `ambiguities[]`, which the validator uses.

Allowed `status` values: `invoiced` | `needs_review` | `invoice_failed` | `failed`.

---

## 7. MVP Scope

### MUST HAVE (1-hour demo)
- Twilio WhatsApp Sandbox webhook receives voice notes (FR-1, FR-2, FR-3 reply).
- Authenticated audio download and Whisper transcription (FR-4, FR-5).
- Strict-JSON LLM extraction with "extract, don't invent" rules (FR-6, FR-7).
- Validation gate before any invoice (FR-8, FR-14).
- Stripe Test Mode invoice with a hosted link (FR-10, FR-11).
- Append-only job log that always keeps `transcript_raw` (FR-9, FR-12).
- WhatsApp confirmation to the technician (FR-13).
- Refusal to run with live Stripe keys (FR-15).
- Local test scripts so extraction and invoicing can be tested without WhatsApp.

### SHOULD HAVE (only if time remains)
- Stripe idempotency keys (FR-16). These are cheap to add.
- Twilio request-signature validation, which can be turned on with an environment variable.
- `ALLOW_TEXT_INPUT` demo fallback (FR-3).
- Looking up an existing Stripe customer by name instead of always creating a new one.
- Confirm-before-send with a reply-to-correct flow (FR-17).
- An immediate "Processing…" acknowledgment message.

### OUT OF SCOPE (v1)
- Live payment processing. It needs Stripe account activation and business KYC, and comes after the demo.
- Two-way CRM sync (reading schedules or job assignments back). v1 is write-only, and CRM writes are deferred to production.
- Multi-language tuning beyond Whisper's defaults.
- Formal licensed-trade compliance or inspection forms. v1 captures only a basic job-completion audit log.
- iMessage channel. It has no equivalent open developer API, so v1 is WhatsApp only.
- **IMPLEMENTATION DECISION (MVP-only exclusions):** admin UI, authentication, multi-tenant support, deployment, databases, analytics, and retry queues.

---

## 8. Success Criteria

**Product criteria (from source)**

| Metric | Target |
|---|---|
| Voice note → invoice created | Under 30 seconds in demo conditions (aim for about 10 s) |
| Transcription/extraction accuracy | Customer name and amount correct on 9 of 10 noisy, field-simulated recordings (judged subjectively) |
| Technician setup | No app install and no login; the demo works with only a WhatsApp message* |
| Pilot validation | At least 3 local trade businesses agree to a free 2-week pilot after the live demo |

\* The Twilio Sandbox requires a one-time "join &lt;code&gt;" message from each phone. This comes from the sandbox, not the product, and goes away with a production WhatsApp Business sender.

**1-hour build criteria:** see the Definition of Done in `instruction.md` §12.

---

## 9. Risks

| Risk | MVP mitigation | Production mitigation |
|---|---|---|
| **Wrong customer name** (misheard) | The name must appear in the transcript, otherwise `needs_review`. The confirmation message echoes the name. | Confirm-before-send; match against the CRM customer list |
| **Wrong numbers** (hours or amount misheard) | Range checks. Amount must be > 0 and ≤ `MAX_INVOICE_AMOUNT`. A warning is added if the amount doesn't appear as digits in the transcript. The confirmation echoes the amount. | Confirm-before-send with a 60-second edit window |
| **Wrong invoice amount** | An invoice is created only if the amount was explicitly stated, is unambiguous, and passes validation | Same, plus confirm-before-send |
| **LLM hallucination** (invented part or price) | The prompt forbids inference. Parts not grounded in the transcript are dropped. Prices are never calculated. Parts are never priced line items. | Same, plus eval suite on recorded audio |
| **Missing amount** | No invoice. Status is `needs_review`, and the technician is asked to resend with the amount. | Reply-to-fill flow |
| **Ambiguous amount** ("fifteen or fifty") | The LLM must report it in `ambiguities`. Any ambiguity blocks the invoice. | Same |
| **API failures** (Twilio, Groq, Stripe) | One retry, then a recorded failure and a message to the technician. The transcript is kept whenever it exists. | Queue with backoff and alerting |
| **Free-tier limits** | Keep test volume low and test extraction with local scripts. Watch the usage dashboards. | Paid tiers |
| **Privacy** (Twilio and the LLM provider see customer names and job details) | Demo data only. Secrets stay in env vars. Audio is not stored. | Review Twilio and LLM-provider data-processing terms before any real rollout; set a retention policy |
| **Technician disputes an invoice** | `transcript_raw` is kept permanently in the job log | Same, in durable storage |
| **Whisper produces text from silence or noise** | Empty-transcript check; the name-grounding check blocks junk | Voice-activity detection |

---

## 10. Product Principles

1. **Zero UI for the technician.** The voice note is the whole interface, and replies arrive in the same chat.
2. **Extract, don't invent.** Only information the technician actually said reaches a record or invoice. Missing means missing, never guessed.
3. **Fast processing.** Aim for a confirmation within seconds, and acknowledge Twilio immediately.
4. **Auditability.** Every voice note leaves a timestamped record with the raw transcript, whether or not an invoice was created.
5. **Human confirmation for risky billing data.** If the amount or customer is missing, ambiguous, or suspicious, the system stops and asks. A delayed invoice is better than a wrong one.

---

## 11. Open Questions (gaps in the source)

1. **Customer contact details.** The source says customers receive invoices "via text/WhatsApp", but the schema has no customer phone or email. **IMPLEMENTATION DECISION (MVP):** the Stripe hosted-invoice link goes to the technician (who can forward it), and Stripe's send uses an optional `DEMO_CUSTOMER_EMAIL`. For the pilot, decide whether contact details come from the CRM, from the voice note, or from the office.
2. **Spoken price shorthand.** The source's canonical example says "charge two-fifty" and expects $250. The MVP accepts clear price shorthand but adds a "verify amount" warning when the amount isn't stated as digits. Confirm-before-send (FR-17) is the long-term fix.
3. **Response time.** The source gives both "~10 seconds" and "under 30 seconds". This document treats 30 s as the requirement and 10 s as the aspiration.
4. **Tax, currency, and line items.** These are not specified. The MVP bills one line item equal to `amount_to_charge` in `STRIPE_CURRENCY` (default `usd`), with no tax.
