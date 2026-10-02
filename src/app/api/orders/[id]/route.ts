import { requireActor } from '@/lib/auth';
import { getOrder,updateOrder,listActivities } from '@/lib/orders';
import { handle,assertSameOrigin } from '@/lib/http';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{const actor=requireActor(req);const id=(await params).id;return {order:getOrder(actor,id),activities:listActivities(actor,id)};});}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);updateOrder(actor,(await params).id,await req.json());return {ok:true};});}
