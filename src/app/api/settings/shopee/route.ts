import { requireActor } from '@/lib/auth';
import { saveShopeeConfig } from '@/lib/shopee';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request){return handle(async()=>{assertSameOrigin(req);return saveShopeeConfig(requireActor(req,['admin']),await req.json());});}
