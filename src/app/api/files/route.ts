import { requireActor } from '@/lib/auth';
import { storeUpload } from '@/lib/files';
import { handle,assertSameOrigin } from '@/lib/http';
import { fail } from '@/lib/errors';
import { z } from 'zod';
export async function POST(req:Request){return handle(async()=>{
 assertSameOrigin(req);const actor=requireActor(req,['admin']);
 const limit=16*1024*1024;if(Number(req.headers.get('content-length'))>limit)fail(413,'Upload terlalu besar.');
 const reader=req.body?.getReader();if(!reader)fail(422,'File belum dipilih.');const chunks:Uint8Array<ArrayBuffer>[]=[];let total=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();fail(413,'Upload terlalu besar.');}chunks.push(new Uint8Array(value));}}finally{reader.releaseLock();}
 const form=await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const file=form.get('file');if(!(file instanceof File))fail(422,'File belum dipilih.');const kind=z.enum(['photo','pdf']).parse(form.get('kind'));return storeUpload(actor,file,kind);
});}
