import { z } from 'zod';
import { requireActor } from '@/lib/auth';
import { listModels } from '@/lib/ai';
import { aiProviders } from '@/lib/settings';
import { handle } from '@/lib/http';
export async function GET(req:Request){return handle(async()=>({models:await listModels(requireActor(req,['admin']),z.enum(aiProviders).parse(new URL(req.url).searchParams.get('provider')))}));}
