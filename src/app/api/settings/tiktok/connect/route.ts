import { requireActor } from '@/lib/auth';
import { tiktokAuthorizeUrl } from '@/lib/tiktok';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return {url:tiktokAuthorizeUrl(requireActor(req,['admin']))};});}
