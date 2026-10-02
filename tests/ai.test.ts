import { afterEach,expect,test,vi } from 'vitest';
import { extractOrders } from '../src/lib/ai';
afterEach(()=>vi.unstubAllEnvs());
function configured(){vi.stubEnv('GEMINI_API_KEY','private-key');vi.stubEnv('GEMINI_MODEL','test-model');}
function response(data:unknown){return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]}),{status:200});}
test('PDF extraction returns editable multiple orders preserving SKU/resi zeros',async()=>{
 configured();const orders=[{orderNumber:'O1',airwayBill:'0001',receiptPages:[1],items:[{sku:'000A',name:'Barang A',qty:2}]},{orderNumber:'O2',airwayBill:'0002',receiptPages:[2],items:[{sku:'UNKNOWN',name:'B',qty:1}]}];
 const result=await extractOrders(new Uint8Array([1,2]),2,{fetch:async(_input,init)=>{
  expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('private-key');
  const body=JSON.parse(init?.body as string);expect(body.contents[0].parts[0].inlineData.mimeType).toBe('application/pdf');return response({orders});
 }});expect(result).toEqual(orders);
});
test('missing configuration and provider failures leave manual entry available without exposing key',async()=>{
 vi.stubEnv('GEMINI_API_KEY','');await expect(extractOrders(new Uint8Array([1]),1)).rejects.toThrow(/AI/);
 configured();for(const fetch of [async()=>new Response('private-key secret',{status:429}),async()=>{throw new DOMException('Timeout','TimeoutError');},async()=>new Response('{}')]) {
  await expect(extractOrders(new Uint8Array([1]),1,{fetch})).rejects.toThrow();
  try {await extractOrders(new Uint8Array([1]),1,{fetch});}catch(error){expect((error as Error).message).not.toContain('private-key');}
 }
});
test('malformed AI qty and page indexes are rejected rather than automatically confirmed',async()=>{
 configured();for(const [qty,pages] of [[-1,[1]],[1,[3]]] as [number,number[]][]) {
  await expect(extractOrders(new Uint8Array([1]),2,{fetch:async()=>response({orders:[{orderNumber:'O',airwayBill:'R',receiptPages:pages,items:[{sku:'A',name:'A',qty}]}]})})).rejects.toThrow();
 }
});
