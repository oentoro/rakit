import { requireActor } from '@/lib/auth';
import { saveNotifyTarget } from '@/lib/notify';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request){return handle(async()=>{assertSameOrigin(req);return saveNotifyTarget(requireActor(req,['admin']),await req.json());});}
