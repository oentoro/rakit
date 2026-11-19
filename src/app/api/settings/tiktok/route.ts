import { requireActor } from '@/lib/auth';
import { saveTiktokConfig } from '@/lib/tiktok';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request){return handle(async()=>{assertSameOrigin(req);return saveTiktokConfig(requireActor(req,['admin']),await req.json());});}
