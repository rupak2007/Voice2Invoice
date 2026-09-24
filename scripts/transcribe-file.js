import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { transcribe } from '../src/transcribe.js';

const TYPE_BY_EXT = {
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run transcribe -- <path-to-audio-file>');
  process.exit(1);
}

try {
  const ext = extname(path).toLowerCase();
  const contentType = TYPE_BY_EXT[ext] || 'application/octet-stream';
  const buffer = await readFile(path);
  const text = await transcribe(buffer, contentType);
  console.log(text);
} catch (err) {
  console.error(`Transcription failed: ${err.message}`);
  process.exit(1);
}
