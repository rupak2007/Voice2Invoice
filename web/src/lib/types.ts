export type JobStatus = 'invoiced' | 'needs_review' | 'invoice_failed' | 'failed';
export type StepState = 'done' | 'active' | 'pending' | 'failed' | 'blocked' | 'skipped';
export type CheckState = 'pass' | 'warn' | 'fail' | 'skip';

export interface Part {
  item: string;
  quantity: number | null;
}

export interface JobSummary {
  job_id: string;
  status: JobStatus;
  failed_stage: string | null;
  customer_name: string | null;
  work_performed: string | null;
  amount_to_charge: number | null;
  hours_logged: number | null;
  parts_count: number;
  parts_used?: Part[];
  follow_up_required: boolean;
  technician_number: string | null;
  timestamp: string;
  processing_ms: number | null;
  invoice_number: string | null;
  invoice_id: string | null;
  hosted_invoice_url: string | null;
  blocking_count: number;
  warning_count: number;
  source: string | null;
  demo: boolean;
}

export interface InvoiceSummary extends JobSummary {
  send_status: string | null;
  customer_id: string | null;
}

export interface TimelineStep {
  id: string;
  label: string;
  state: StepState;
}

export interface ValidationCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string | null;
}

export interface JobDetail {
  job_id: string;
  status: JobStatus;
  failed_stage: string | null;
  customer_name: string | null;
  work_performed: string | null;
  parts_used: Part[];
  hours_logged: number | null;
  amount_to_charge: number | null;
  follow_up_required: boolean;
  technician_number: string;
  timestamp: string;
  transcript_raw: string | null;
  message_sid: string | null;
  validation: { blocking: string[]; warnings: string[] };
  llm_output_raw: string | null;
  stripe: {
    customer_id: string | null;
    invoice_id: string | null;
    invoice_number: string | null;
    hosted_invoice_url: string | null;
    send_status: string | null;
  } | null;
  error: string | null;
  processing_ms: number | null;
  source: string | null;
  demo?: boolean;
  timeline: TimelineStep[];
  checks: ValidationCheck[];
  currency: string;
  /** Present on invoices created through the in-app review flow. */
  invoice_document?: (InvoiceDoc & {
    totals: { subtotal: number; discount: number; tax: number; total: number };
  }) | null;
  draft_id?: string | null;
}

export interface Stats {
  jobs_total: number;
  invoiced: number;
  needs_review: number;
  failed: number;
  invoiced_value: number;
  currency: string;
  last_job_at: string | null;
  demo_count: number;
}

export interface ActiveJob {
  job_id: string;
  technician_number: string | null;
  source: string | null;
  stage: string;
  active: boolean;
  status?: JobStatus;
  customer_name: string | null;
  amount_to_charge: number | null;
  started_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceDoc {
  customer: { name: string; email: string; address: string };
  issue_date: string;
  due_date: string;
  line_items: LineItem[];
  tax_rate: number;
  discount: { type: 'amount' | 'percent'; value: number };
  notes: string;
}

export type DraftStage =
  | 'received' | 'transcribing' | 'extracting' | 'validating'
  | 'ready' | 'finalized' | 'processing';

export interface SuggestedPart {
  id: string;
  item: string;
  quantity: number;
}

export interface Draft {
  draft_id: string;
  status: 'processing' | 'ready' | 'failed' | 'finalized';
  stage: DraftStage;
  created_at: string;
  updated_at: string;
  source: string;
  transcript_raw: string | null;
  llm_output_raw: string | null;
  extraction: Record<string, unknown> | null;
  validation: { blocking: string[]; warnings: string[] };
  suggested_parts: SuggestedPart[];
  stated_total: number | null;
  stated_hours: number | null;
  invoice: InvoiceDoc | null;
  error: string | null;
  finalized_job_id: string | null;
  /** Set when the draft was rebuilt from a job the automatic gate refused. */
  from_job_id?: string | null;
  demo?: boolean;
  totals: {
    subtotal: number; discount: number; tax: number; total: number;
    subtotal_cents: number; discount_cents: number; tax_cents: number; total_cents: number;
  } | null;
  currency: string;
  business_name: string;
  limits: { max_amount: number };
}

export interface DraftSummary {
  draft_id: string;
  status: Draft['status'];
  stage: DraftStage;
  created_at: string;
  customer_name: string | null;
  total: number | null;
  finalized_job_id: string | null;
  from_job_id?: string | null;
}

export interface Settings {
  currency: string;
  /** Printed as the issuer on every invoice document. */
  business_name: string;
  /** Optional first name, used only for the dashboard greeting. */
  operator_name: string | null;
  transcription_model: string;
  extraction_model: string;
  ai_base_url: string;
  max_invoice_amount: number;
  max_hours_logged: number;
  days_until_due: number;
  allow_text_input: boolean;
  validate_signature: boolean;
  jobs_file: string;
  webhook_base_url: string | null;
  webhook_path: string;
  stripe_mode: string;
  configured: {
    twilio: boolean;
    whatsapp_number: boolean;
    whatsapp_number_hint: string | null;
    ai: boolean;
    stripe: boolean;
  };
  /** Present but plausible? Distinguishes a real key from an .env.example placeholder. */
  verified?: { twilio: boolean; ai: boolean; stripe: boolean };
}
