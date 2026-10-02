import { requireActor } from '@/lib/auth';
import { readAuthorizedFile } from '@/lib/files';
import { handle } from '@/lib/http';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{const file=readAuthorizedFile(requireActor(req),(await params).id);return new Response(new Uint8Array(file.bytes),{headers:{'Content-Type':file.mimeType,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});});}
