import { requireActor } from '@/lib/auth';
import { createOrder,listOrders } from '@/lib/orders';
import { handle,assertSameOrigin } from '@/lib/http';
import { z } from 'zod';
export async function GET(req:Request){return handle(()=>{const params=new URL(req.url).searchParams;const status=z.enum(['waiting','picking','packing','completed']).optional().parse(params.get('status')||undefined);return listOrders(requireActor(req),{status,search:params.get('search')||''});});}
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);return {id:createOrder(actor,await req.json())};});}
