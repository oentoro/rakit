import { requireActor } from '@/lib/auth';
import { syncShopeeNow } from '@/lib/shopee';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return syncShopeeNow(requireActor(req,['admin']));});}
