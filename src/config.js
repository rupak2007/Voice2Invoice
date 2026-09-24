import 'dotenv/config';

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}
function num(name, def) {
  const v = Number(process.env[name] ?? def);
  if (!Number.isFinite(v)) throw new Error(`Env var ${name} must be a number`);
  return v;
}

// Test-mode guard: runs at import time
const sk = process.env.STRIPE_SECRET_KEY?.trim();
if (sk && !/^(sk|rk)_test_/.test(sk)) {
  throw new Error('Refusing to start: STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_ or rk_test_).');
}

export const config = {
  port: num('PORT', 3000),
  webhookBaseUrl: (process.env.WEBHOOK_BASE_URL || '').trim().replace(/\/$/, ''),
  validateSignature: process.env.VALIDATE_TWILIO_SIGNATURE === 'true',
  allowTextInput: process.env.ALLOW_TEXT_INPUT === 'true',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
  transcriptionModel: process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
  extractionModel: process.env.EXTRACTION_MODEL || 'llama-3.3-70b-versatile',
  currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
  daysUntilDue: num('INVOICE_DAYS_UNTIL_DUE', 7),
  // Shown as the issuer on the invoice document. An invoice with no issuer looks fake.
  businessName: (process.env.BUSINESS_NAME || 'Your Business').trim(),
  // Used only to greet whoever is running the app. Empty is fine — the greeting
  // simply drops the name rather than inventing one.
  operatorName: (process.env.OPERATOR_NAME || '').trim(),
  demoCustomerEmail: process.env.DEMO_CUSTOMER_EMAIL?.trim() || null,
  limits: { maxAmount: num('MAX_INVOICE_AMOUNT', 10000), maxHours: num('MAX_HOURS_LOGGED', 24) },
  jobsFile: process.env.JOBS_FILE || 'data/jobs.jsonl',
};
