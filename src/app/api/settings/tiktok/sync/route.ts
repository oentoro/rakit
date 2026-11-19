import { requireActor } from '@/lib/auth';
import { syncTiktokNow } from '@/lib/tiktok';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return syncTiktokNow(requireActor(req,['admin']));});}
