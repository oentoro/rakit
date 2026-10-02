import { requireActor } from '@/lib/auth';
import { scanOrder } from '@/lib/picking';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req);return scanOrder(actor,(await params).id,await req.json());});}
