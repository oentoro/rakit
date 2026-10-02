import { requireActor } from '@/lib/auth';
import { saveRack } from '@/lib/racks';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);return {id:saveRack(requireActor(req,['admin']),Number((await params).id),await req.json())};});}
