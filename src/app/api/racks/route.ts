import { requireActor } from '@/lib/auth';
import { saveRack,listRacks } from '@/lib/racks';
import { handle,assertSameOrigin } from '@/lib/http';
export async function GET(req:Request){return handle(()=>listRacks(requireActor(req)));}
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);return {id:saveRack(requireActor(req,['admin']),null,await req.json())};});}
