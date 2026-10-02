import { requireActor } from '@/lib/auth';
import { claimOrder } from '@/lib/picking';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);return claimOrder(requireActor(req),(await params).id);});}
