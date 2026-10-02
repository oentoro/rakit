import { authenticate } from '@/lib/auth';
import { handle,assertSameOrigin } from '@/lib/http';
import { z } from 'zod';
export const runtime='nodejs';
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);const data=z.object({username:z.string().max(100),password:z.string().max(128)}).parse(await req.json());const token=await authenticate(data.username,data.password);const secure=process.env.COOKIE_SECURE==='true'||process.env.APP_ORIGIN?.startsWith('https://');return Response.json({ok:true},{headers:{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure?'; Secure':''}`,'Cache-Control':'no-store'}});});}
