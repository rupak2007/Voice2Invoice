import twilio from 'twilio';
import { config, requireEnv } from './config.js';

let client;
const getClient = () => (client ??= twilio(requireEnv('TWILIO_ACCOUNT_SID'), requireEnv('TWILIO_AUTH_TOKEN')));

export function sendWhatsApp(to, body) {
  return getClient().messages.create({
    from: requireEnv('TWILIO_WHATSAPP_NUMBER'),
    to,
    body: String(body).slice(0, 1500),
  });
}

export async function downloadMedia(url) {
  const auth = Buffer.from(`${requireEnv('TWILIO_ACCOUNT_SID')}:${requireEnv('TWILIO_AUTH_TOKEN')}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } }); // follows redirect
  if (!res.ok) throw new Error(`media download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error('media download returned 0 bytes');
  if (buffer.length > 25 * 1024 * 1024) throw new Error('audio file too large (>25 MB)');
  return buffer;
}

export function isValidTwilioRequest(req) {
  return twilio.validateRequest(
    requireEnv('TWILIO_AUTH_TOKEN'),
    req.header('X-Twilio-Signature') || '',
    `${config.webhookBaseUrl}/webhook/whatsapp`,
    req.body,
  );
}
