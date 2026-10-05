import { requireActor } from '@/lib/auth';
import { handle,assertSameOrigin } from '@/lib/http';
import { listStocktakes,saveStocktake } from '@/lib/stocktake';

export async function GET(req:Request){return handle(()=>listStocktakes(requireActor(req)));}
export async function POST(req:Request){return handle(async()=>{
 assertSameOrigin(req);const actor=requireActor(req);return {id:saveStocktake(actor,await req.json())};
});}
