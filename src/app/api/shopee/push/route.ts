import { importShopeeOrders,readShopeePush } from '@/lib/shopee';
import { handle } from '@/lib/http';
// Shopee server-to-server push: no session or same-origin check; the HMAC signature authenticates it. Answer fast, import in the background.
export async function POST(req:Request){
  const body=await req.text();
  const response=await handle(async()=>{
    const sn=readShopeePush(body,req.headers.get('authorization')||'');
    if(sn) void importShopeeOrders([sn]).catch(error=>console.error(`Shopee push ${sn} gagal diimpor:`,(error as Error).message));
    return new Response(null,{status:200});
  });
  console.log(`Shopee push ${response.status}: ${body.slice(0,300)}`); // journalctl -u rakit shows every push Shopee sent
  return response;
}
