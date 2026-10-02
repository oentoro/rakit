import { requireActor,setStaffActive,resetPassword } from '@/lib/auth';
import { handle,assertSameOrigin } from '@/lib/http';
import { z } from 'zod';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);const data=z.object({active:z.boolean().optional(),password:z.string().min(10).max(128).optional()}).parse(await req.json());const id=(await params).id;if(data.password)resetPassword(actor,id,data.password);if(data.active!==undefined)setStaffActive(actor,id,data.active);return {ok:true};});}
