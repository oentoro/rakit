import { requireActor } from '@/lib/auth';
import { buildReceipt } from '@/lib/orders';
import { handle } from '@/lib/http';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>new Response(new Uint8Array(await buildReceipt(requireActor(req),(await params).id)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="resi.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}));}
