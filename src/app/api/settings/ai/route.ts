import { requireActor } from '@/lib/auth';
import { saveAiConfig } from '@/lib/settings';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request){return handle(async()=>{assertSameOrigin(req);return saveAiConfig(requireActor(req,['admin']),await req.json());});}
