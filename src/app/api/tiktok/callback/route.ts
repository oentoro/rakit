import { requireActor } from '@/lib/auth';
import { connectTiktok } from '@/lib/tiktok';
import { handle } from '@/lib/http';
// TikTok redirects the admin's browser here after authorization; the one-time state stored by /connect guards against forged callbacks.
export async function GET(req:Request){return handle(async()=>{
  const actor=requireActor(req,['admin']);const q=new URL(req.url).searchParams;
  await connectTiktok(actor,q.get('code')||q.get('auth_code')||'',q.get('state')||'');
  return new Response(null,{status:303,headers:{Location:'/admin/settings'}});
});}
