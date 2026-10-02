import { logout } from '@/lib/auth';
import { handle,assertSameOrigin } from '@/lib/http';
export async function POST(req:Request){return handle(()=>{assertSameOrigin(req);const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('session='))?.slice(8);if(token)logout(token);return Response.json({ok:true},{headers:{'Set-Cookie':'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}});});}
