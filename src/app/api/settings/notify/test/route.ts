import { requireActor } from '@/lib/auth';
import { sendTestNotification } from '@/lib/notify';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);return sendTestNotification(requireActor(req,['admin']));});}
