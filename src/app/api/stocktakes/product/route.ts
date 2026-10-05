import { z } from 'zod';
import { requireActor } from '@/lib/auth';
import { findProductBySku } from '@/lib/catalog';
import { fail } from '@/lib/errors';
import { handle } from '@/lib/http';

export async function GET(req:Request){return handle(()=>{
 const actor=requireActor(req,['admin']),sku=z.string().trim().min(1).max(100).parse(new URL(req.url).searchParams.get('sku'));
 const product=findProductBySku(actor,sku);if(!product)fail(404,'SKU tidak ditemukan. Periksa QR atau kode barang.');
 return product;
});}
