import { toFile } from 'openai';
import { getAI } from './ai.js';
import { config } from './config.js';

const EXT = {
  'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm',
};
const HINT = 'Field service job note: plumbing, electrical, HVAC. Customer name, parts used, hours, total amount in dollars.';

export async function transcribe(buffer, contentType = 'audio/ogg') {
  const type = String(contentType).split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) throw new Error(`unsupported audio type: ${type}`);
  const file = await toFile(buffer, `voice.${ext}`, { type });
  const res = await getAI().audio.transcriptions.create({
    file, model: config.transcriptionModel, temperature: 0, prompt: HINT,
  });
  return String(res.text ?? '').trim();
}
