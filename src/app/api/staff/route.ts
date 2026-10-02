import { requireActor,createStaff,listStaff } from '@/lib/auth';
import { handle,assertSameOrigin } from '@/lib/http';
export async function GET(req:Request){return handle(()=>listStaff(requireActor(req,['admin'])));}
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);return createStaff(actor,await req.json());});}
