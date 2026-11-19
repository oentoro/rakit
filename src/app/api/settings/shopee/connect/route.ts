import { requireActor } from '@/lib/auth';
import { shopeeAuthorizeUrl } from '@/lib/shopee';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return {url:shopeeAuthorizeUrl(requireActor(req,['admin']))};});}
