import { requireActor } from '@/lib/auth';
import { pullShopeeStock } from '@/lib/shopee';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return pullShopeeStock(requireActor(req,['admin']));});}
