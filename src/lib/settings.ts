import { z } from 'zod';
import { getDatabase } from './db';
import { assertActiveActor } from './auth';
import type { Actor } from './types';
import { aiProviders,type AiProvider,type AiStatus } from './settings-shared';
export { aiProviders,providerLabels,type AiProvider,type AiStatus } from './settings-shared';
const schema=z.object({provider:z.enum(aiProviders),model:z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/,'Nama model hanya boleh huruf, angka, titik, garis bawah, atau strip.'),apiKey:z.string().trim().max(500).optional()});
function setting(key:string):string|undefined{return getDatabase().prepare('SELECT value FROM settings WHERE key=?').get(key)?.value as string|undefined;}
/** Settings saved by admin win; env vars remain the fallback for existing deployments. */
export function providerConfig(provider:AiProvider):{apiKey:string;model:string}{
  const env=provider.toUpperCase();
  return {apiKey:setting(`${provider}_api_key`)||process.env[`${env}_API_KEY`]||'',model:setting(`${provider}_model`)||process.env[`${env}_MODEL`]||''};
}
export function aiConfig():{provider:AiProvider;apiKey:string;model:string}{
  const stored=setting('ai_provider'),provider:AiProvider=aiProviders.includes(stored as AiProvider)?stored as AiProvider:'gemini';
  return {provider,...providerConfig(provider)};
}
export function isAiConfigured():boolean{const {apiKey,model}=aiConfig();return !!apiKey&&!!model;}
/** Never exposes API keys. */
export function aiStatus(actor:Actor):AiStatus{
  assertActiveActor(actor,['admin']);
  const status=(p:AiProvider)=>{const {apiKey,model}=providerConfig(p);return {model,hasApiKey:!!apiKey};};
  return {provider:aiConfig().provider,gemini:status('gemini'),deepseek:status('deepseek')};
}
export function saveAiConfig(actor:Actor,input:z.input<typeof schema>):AiStatus{
  assertActiveActor(actor,['admin']);const data=schema.parse(input);
  const upsert=getDatabase().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  upsert.run('ai_provider',data.provider);upsert.run(`${data.provider}_model`,data.model);
  if(data.apiKey)upsert.run(`${data.provider}_api_key`,data.apiKey); // blank keeps the stored key
  return aiStatus(actor);
}
