import { z } from 'zod';
import { getDatabase } from './db';
import { assertActiveActor } from './auth';
import { fail } from './errors';
import { isInstant } from './utils';
import type { Actor,OrderDetail } from './types';
const KEY='notify_target';
// WhatsApp chat id of the staff group, e.g. "120363012345678901@g.us"; empty disables notifications.
// A leading "whatsapp:" is accepted and dropped so Hermes-style targets can be pasted as-is.
const schema=z.object({target:z.string().trim().max(200).transform(t=>t.replace(/^whatsapp:/,'')).pipe(z.string().regex(/^([\w.+-]+@(g\.us|s\.whatsapp\.net))?$/,'Format: ID grup WhatsApp, contoh 120363012345678901@g.us'))});
export function notifyTarget():string{return String(getDatabase().prepare('SELECT value FROM settings WHERE key=?').get(KEY)?.value??'').replace(/^whatsapp:/,'');} // prefix: values saved before the bridge switch
export function notifyStatus(actor:Actor):{target:string}{assertActiveActor(actor,['admin']);return {target:notifyTarget()};}
export function saveNotifyTarget(actor:Actor,input:unknown):{target:string}{
  assertActiveActor(actor,['admin']);const {target}=schema.parse(input);
  getDatabase().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY,target);
  return {target};
}
export function orderMessage(order:OrderDetail):string{
  return [`${isInstant(order.airwayBill)?'⚡ ORDER INSTANT / SAMEDAY':'📦 Order baru'}: ${order.orderNumber}`,`Resi: ${order.airwayBill||'-'}`,...order.items.map(i=>`• ${i.qty}× ${i.sku} — ${i.name} (${i.rackName}/${i.shelf})`)].join('\n');
}
export type Send=(target:string,message:string)=>Promise<void>;
// Hermes' local WhatsApp bridge does the sending; `hermes send` cannot address group ids.
const bridgeSend:Send=async(target,message)=>{
  const response=await fetch(`${process.env.WHATSAPP_BRIDGE_URL||'http://127.0.0.1:3010'}/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:target,message}),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`WhatsApp bridge ${response.status}`);
};
/** Sends and reports failure to the caller; used by the settings test button. */
export async function sendTestNotification(actor:Actor,send:Send=bridgeSend):Promise<{ok:true}>{
  assertActiveActor(actor,['admin']);const target=notifyTarget();
  if(!target) fail(400,'Simpan target notifikasi terlebih dahulu.');
  // 424, not 502: a proxy in front (e.g. Cloudflare) may replace 502 bodies with its own HTML page.
  try{await send(target,'✅ Pesan uji dari Rakit. Notifikasi order baru aktif.');}catch{fail(424,'Pesan uji gagal dikirim. Periksa koneksi WhatsApp di Hermes dan ID grup.');}
  return {ok:true};
}
/** Never throws: a failed notification must not fail the order that was already saved. */
export async function notifyText(message:string,send:Send=bridgeSend):Promise<void>{
  const target=notifyTarget();if(!target)return;
  try{await send(target,message);}catch(error){console.error('Order notification failed:',error instanceof Error?error.message:'unknown');}
}
export async function notifyNewOrder(order:OrderDetail,send:Send=bridgeSend):Promise<void>{return notifyText(orderMessage(order),send);}
/** Instant/sameday order packed: tell the group it can be handed to the courier. Never throws. */
export async function notifyInstantReady(order:OrderDetail,send:Send=bridgeSend):Promise<void>{
  if(isInstant(order.airwayBill))return notifyText(`✅ ORDER INSTANT / SAMEDAY SIAP DIANTAR: ${order.orderNumber}\nKode pengambilan: ${order.airwayBill}`,send);
}
