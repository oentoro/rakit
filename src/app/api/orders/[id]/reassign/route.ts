import { requireActor } from '@/lib/auth';
import { reassignOrder } from '@/lib/picking';
import { handle,assertSameOrigin } from '@/lib/http';
import { z } from 'zod';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);const data=z.object({staffId:z.string().uuid()}).parse(await req.json());return reassignOrder(actor,(await params).id,data.staffId);});}
