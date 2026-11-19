import { afterEach,expect,test,vi } from 'vitest';
import { fixture } from './helpers';
import { aiConfig,aiStatus,saveAiConfig } from '../src/lib/settings';
import { extractOrders } from '../src/lib/ai';
afterEach(()=>vi.unstubAllEnvs());
const reply=(text:string)=>JSON.stringify({orders:[{orderNumber:'O',airwayBill:'R',receiptPages:[1],items:[]}],_:text});
test('admin AI settings override env, keep stored key when blank, switch provider, and never expose keys',async()=>{
 const {admin,staff}=fixture();vi.stubEnv('GEMINI_API_KEY','env-key');vi.stubEnv('GEMINI_MODEL','env-model');
 expect(aiConfig()).toEqual({provider:'gemini',apiKey:'env-key',model:'env-model'});
 saveAiConfig(admin,{provider:'gemini',model:'db-model',apiKey:'db-key'});
 saveAiConfig(admin,{provider:'gemini',model:'db-model-2',apiKey:''});
 expect(aiConfig()).toEqual({provider:'gemini',apiKey:'db-key',model:'db-model-2'});
 const status=saveAiConfig(admin,{provider:'deepseek',model:'deepseek-chat',apiKey:'ds-key'});
 expect(status).toEqual({provider:'deepseek',gemini:{model:'db-model-2',hasApiKey:true},deepseek:{model:'deepseek-chat',hasApiKey:true}});
 expect(JSON.stringify(aiStatus(admin))).not.toMatch(/db-key|ds-key/);
 expect(aiConfig()).toEqual({provider:'deepseek',apiKey:'ds-key',model:'deepseek-chat'});
 expect(()=>saveAiConfig(staff,{provider:'gemini',model:'x'})).toThrow();
 expect(()=>saveAiConfig(admin,{provider:'gemini',model:'bad/model'})).toThrow();
 expect(()=>saveAiConfig(admin,{provider:'openai' as 'gemini',model:'x'})).toThrow();
});
test('Gemini provider uses stored model and key',async()=>{
 const {admin}=fixture();saveAiConfig(admin,{provider:'gemini',model:'db-model',apiKey:'db-key'});
 await extractOrders(new Uint8Array([1]),1,{fetch:async(input,init)=>{
  expect(String(input)).toContain('/models/db-model:');expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('db-key');
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:reply('')}]}}]}));
 }});
});
import { PDFDocument,StandardFonts } from 'pdf-lib';
async function pdf(texts:string[]){const doc=await PDFDocument.create();for(const t of texts){const page=doc.addPage();if(t)page.drawText(t,{x:50,y:700});}return doc.save();}
test('DeepSeek provider sends per-page PDF text and maps provider errors',async()=>{
 const {admin}=fixture();saveAiConfig(admin,{provider:'deepseek',model:'deepseek-chat',apiKey:'ds-key'});
 const bytes=await pdf(['ORDER 0001 SKU 000A x2','RESI JX0001']);
 const result=await extractOrders(bytes,2,{fetch:async(input,init)=>{
  expect(String(input)).toBe('https://api.deepseek.com/chat/completions');expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ds-key');
  const body=JSON.parse(init?.body as string);expect(body.model).toBe('deepseek-chat');expect(body.response_format).toEqual({type:'json_object'});
  expect(body.messages[1].content).toMatch(/<page number="1">\nORDER 0001 SKU 000A x2[\s\S]*<page number="2">\nRESI JX0001/);
  return new Response(JSON.stringify({choices:[{message:{content:reply('')}}]}));
 }});
 expect(result[0].orderNumber).toBe('O');
 await expect(extractOrders(bytes,2,{fetch:async()=>new Response('ds-key',{status:402})})).rejects.toThrow(/Saldo DeepSeek habis/);
 await expect(extractOrders(await pdf(['','']),2,{fetch:async()=>{throw new Error('must not call');}})).rejects.toThrow(/hasil scan/);
});
test('model list uses stored key, is admin-only, and requires a saved key',async()=>{
 const {admin,staff}=fixture();const { listModels }=await import('../src/lib/ai');
 await expect(listModels(admin,'deepseek')).rejects.toThrow(/Simpan API key DeepSeek/);
 saveAiConfig(admin,{provider:'deepseek',model:'deepseek-chat',apiKey:'ds-key'});
 expect(await listModels(admin,'deepseek',{fetch:async(input,init)=>{expect(String(input)).toBe('https://api.deepseek.com/models');expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ds-key');return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-chat'},{id:'deepseek-reasoner'}]}));}})).toEqual(['deepseek-chat','deepseek-reasoner']);
 saveAiConfig(admin,{provider:'gemini',model:'g',apiKey:'g-key'});
 expect(await listModels(admin,'gemini',{fetch:async()=>new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/embedding-001',supportedGenerationMethods:['embedContent']}]}))})).toEqual(['gemini-2.5-flash']);
 await expect(listModels(staff,'deepseek')).rejects.toThrow();
 await expect(listModels(admin,'deepseek',{fetch:async()=>new Response('',{status:401})})).rejects.toThrow(/API key DeepSeek tidak valid/);
});
test('DeepSeek receives adjacent PDF text runs as separate tokens',async()=>{
 const {admin}=fixture();saveAiConfig(admin,{provider:'deepseek',model:'deepseek-chat',apiKey:'ds-key'});
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),page=doc.addPage();
 // Touching runs in different fonts, as resi + sort code on SPX labels.
 page.drawText('SPXID06708143994B',{x:50,y:700,size:10,font});page.drawText('GPD-A-03',{x:50+font.widthOfTextAtSize('SPXID06708143994B',10),y:700,size:10,font:bold});
 await extractOrders(await doc.save(),1,{fetch:async(_input,init)=>{
  expect(JSON.parse(init?.body as string).messages[1].content).toMatch(/SPXID06708143994B\s+GPD-A-03/);
  return new Response(JSON.stringify({choices:[{message:{content:reply('')}}]}));
 }});
});
