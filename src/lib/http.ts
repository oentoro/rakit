import { ZodError } from 'zod';
import { DomainError, fail } from './errors';
export function assertSameOrigin(request:Request):void {
  const origin=request.headers.get('origin');const expected=process.env.APP_ORIGIN||new URL(request.url).origin;
  if(!origin||origin!==expected) fail(403,'Permintaan harus berasal dari aplikasi ini.');
}
export async function handle(fn:()=>unknown|Promise<unknown>):Promise<Response> {
  try { const result=await fn();return result instanceof Response ? result : Response.json(result,{headers:{'Cache-Control':'no-store'}});}
  catch(error) {
    if(error instanceof DomainError) return Response.json({error:error.message},{status:error.status});
    if(error instanceof ZodError) return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:422});
    console.error('Request failed:',error instanceof Error ? error.name : 'Unknown');
    return Response.json({error:'Terjadi masalah pada server. Data belum berhasil disimpan.'},{status:500});
  }
}
