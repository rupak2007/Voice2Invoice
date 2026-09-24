import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { isValidTwilioRequest, sendWhatsApp } from './twilio.js';
import { processVoiceNote, processTextNote } from './pipeline.js';
import { createApiRouter } from './api.js';

// Credentials are reported at boot but no longer block it. Each subsystem still
// calls requireEnv() at the point of use, so a missing key fails loudly on the
// feature that needs it — while the rest of the app (the dashboard, the job
// history, the review workspace) stays usable. Refusing to start meant someone
// cloning the repo hit a wall before seeing anything.
const CREDENTIALS = [
  ['TWILIO_ACCOUNT_SID', 'WhatsApp intake'],
  ['TWILIO_AUTH_TOKEN', 'WhatsApp intake'],
  ['TWILIO_WHATSAPP_NUMBER', 'WhatsApp replies'],
  ['AI_API_KEY', 'transcription and extraction'],
  ['STRIPE_SECRET_KEY', 'invoice creation'],
];
const missing = CREDENTIALS.filter(([k]) => !process.env[k]?.trim());
if (missing.length) {
  const affected = [...new Set(missing.map(([, feature]) => feature))].join(', ');
  console.warn([
    '',
    `  Starting without: ${missing.map(([k]) => k).join(', ')}`,
    `  These features will fail until those keys are set: ${affected}.`,
    '  Everything else works. See Settings in the dashboard for live status.',
    '',
  ].join('\n'));
}
if (config.validateSignature && !config.webhookBaseUrl) {
  throw new Error('WEBHOOK_BASE_URL is required when VALIDATE_TWILIO_SIGNATURE=true');
}

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhook/whatsapp', express.urlencoded({ extended: false }), (req, res) => {
  if (config.validateSignature && !isValidTwilioRequest(req)) return res.status(403).send('Invalid signature');

  // Acknowledge immediately; the pipeline runs after the response.
  res.type('text/xml').send('<Response></Response>');

  const {
    From: from, MessageSid: messageSid, NumMedia,
    MediaUrl0: mediaUrl, MediaContentType0: mediaType = '', Body: body = '',
  } = req.body;
  const numMedia = Number(NumMedia || 0);
  console.log(`[in] ${messageSid} media=${numMedia} type=${mediaType}`);

  let work;
  if (numMedia > 0 && mediaType.startsWith('audio/')) {
    work = processVoiceNote({ from, messageSid, mediaUrl, mediaType });
  } else if (numMedia === 0 && config.allowTextInput && body.trim()) {
    work = processTextNote({ from, messageSid, text: body });
  } else {
    work = sendWhatsApp(from, '🎙️ Please send a voice note describing the job: customer name, work done, parts, hours and the total to charge.');
  }
  work
    .then((r) => r?.job_id && console.log(`[done] ${r.job_id} status=${r.status} ${r.processing_ms}ms`))
    .catch((err) => console.error('[error]', err.message));
});

// Read-only dashboard API. No route here can create an invoice.
app.use('/api', createApiRouter());
app.use('/api', (err, _req, res, _next) => {
  console.error('[api]', err.message);
  res.status(500).json({ error: 'internal error' });
});

// Serve the built dashboard when it exists, with SPA fallback for client routes.
const webDist = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next();
    res.sendFile(join(webDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.status(503).type('html').send(
    '<pre style="font:14px ui-monospace,monospace;padding:32px;line-height:1.6">'
    + 'Voice2Invoice API is running, but the dashboard has not been built yet.\n\n'
    + 'Build it once:   npm run build:web\n'
    + 'Or run it live:  npm run dev:web   (Vite dev server on :5173)\n\n'
    + 'API is available at /api/stats, /api/jobs, /api/settings'
    + '</pre>'));
}

app.listen(config.port, () => console.log(`Voice2Invoice listening on :${config.port}`));
