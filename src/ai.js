import OpenAI from 'openai';
import { config, requireEnv } from './config.js';

let ai;
export const getAI = () => (ai ??= new OpenAI({ apiKey: requireEnv('AI_API_KEY'), baseURL: config.aiBaseUrl }));
