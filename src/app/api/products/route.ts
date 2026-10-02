import { requireActor } from '@/lib/auth';
import { saveProduct,listProducts } from '@/lib/catalog';
import { handle,assertSameOrigin } from '@/lib/http';
export async function GET(req:Request){return handle(()=>listProducts(requireActor(req)));}
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);return {id:saveProduct(actor,null,await req.json())};});}
