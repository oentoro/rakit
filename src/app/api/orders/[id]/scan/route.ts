import { requireActor } from '@/lib/auth';
import { scanOrder } from '@/lib/picking';
import { notifyInstantReady } from '@/lib/notify';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req);const result=scanOrder(actor,(await params).id,await req.json());if(!result.replayed&&result.order.status==='completed')void notifyInstantReady(result.order);return result;});}
