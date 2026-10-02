import { requireActor } from '@/lib/auth';
import { saveProduct } from '@/lib/catalog';
import { handle,assertSameOrigin } from '@/lib/http';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);return {id:saveProduct(actor,(await params).id,await req.json())};});}
