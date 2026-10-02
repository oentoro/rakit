import { requireActor } from '@/lib/auth';
import { getFile,readAuthorizedFile } from '@/lib/files';
import { extractOrders } from '@/lib/ai';
import { handle,assertSameOrigin } from '@/lib/http';
import { DomainError } from '@/lib/errors';
import { z } from 'zod';
export async function POST(req:Request){return handle(async()=>{assertSameOrigin(req);const actor=requireActor(req,['admin']);const {fileId}=z.object({fileId:z.string().uuid()}).parse(await req.json());const file=getFile(fileId,'pdf');try{return {fileId,orders:await extractOrders(readAuthorizedFile(actor,fileId).bytes,file.page_count||0),error:null};}catch(error){if(error instanceof DomainError)return {fileId,orders:[],error:error.message};throw error;}});}
