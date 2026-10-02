import { z } from 'zod';
import { assertActiveActor } from './auth';
import { getDatabase,inTransaction } from './db';
import { fail } from './errors';
import { getFile } from './files';
import { getOrder,recordActivity } from './orders';
import type { Actor,OrderDetail,ScanResult } from './types';
export function claimOrder(actor:Actor,id:string):OrderDetail {
  return inTransaction(()=>{assertActiveActor(actor);const order=getOrder(actor,id);
    if(order.assigneeId===actor.id&&order.status!=='completed') return order;
    if(order.status!=='waiting'||order.assigneeId) fail(409,'Order sudah diambil staff lain atau sudah selesai.');
    getDatabase().prepare("UPDATE orders SET status='picking',assignee_id=?,updated_at=? WHERE id=? AND status='waiting' AND assignee_id IS NULL").run(actor.id,Date.now(),id);
    recordActivity(actor,id,'Picking dimulai');return getOrder(actor,id);
  });
}
export function reassignOrder(actor:Actor,id:string,staffId:string):OrderDetail {
  return inTransaction(()=>{assertActiveActor(actor,['admin']);const order=getOrder(actor,id);
    if(order.status==='waiting'||order.status==='completed') fail(409,'Hanya order yang sedang berjalan dapat dialihkan.');
    const target=getDatabase().prepare('SELECT id,name FROM users WHERE id=? AND active=1').get(staffId);
    if(!target) fail(422,'Pilih akun aktif.');
    getDatabase().prepare('UPDATE orders SET assignee_id=?,updated_at=? WHERE id=?').run(staffId,Date.now(),id);recordActivity(actor,id,`Dialihkan ke ${target.name}`);return getOrder(actor,id);
  });
}
const scanSchema=z.object({kind:z.enum(['sku','airwayBill']),code:z.string().trim().min(1).max(100),requestId:z.string().uuid()});
export function scanOrder(actor:Actor,id:string,input:z.input<typeof scanSchema>):ScanResult {
  const data=scanSchema.parse(input);
  return inTransaction(()=>{
    assertActiveActor(actor);const db=getDatabase();const order=getOrder(actor,id);
    if(order.assigneeId!==actor.id) fail(403,'Order ini bukan penugasan Anda. Minta admin mengalihkan order bila diperlukan.');
    const prior=db.prepare('SELECT * FROM scan_requests WHERE request_id=?').get(data.requestId);
    if(prior) {
      if(prior.order_id!==id||prior.actor_id!==actor.id||prior.kind!==data.kind||prior.code!==data.code) fail(409,'ID scan telah digunakan untuk permintaan lain.');
      return {order,message:prior.result as string,replayed:true};
    }
    let message:string;let replayed=false;
    if(data.kind==='sku') {
      if(order.status!=='picking') fail(409,'Order tidak dalam proses picking.');
      const item=order.items.find(i=>i.sku===data.code);if(!item) fail(422,'SKU tidak sesuai dengan barang dalam order.');
      if(item.pickedQty>=item.qty) fail(409,'Jumlah barang ini sudah lengkap.');
      const changed=db.prepare('UPDATE order_items SET picked_qty=picked_qty+1 WHERE order_id=? AND product_id=? AND picked_qty<qty').run(id,item.productId);
      if(changed.changes!==1) fail(409,'Jumlah barang sudah lengkap. Muat ulang order.');
      const pending=db.prepare('SELECT COUNT(*) n FROM order_items WHERE order_id=? AND picked_qty<qty').get(id) as {n:number};
      if(!pending.n) db.prepare("UPDATE orders SET status='packing',updated_at=? WHERE id=?").run(Date.now(),id);
      recordActivity(actor,id,'Barang diambil',data.code);message=`${item.name}: +1 unit${!pending.n?' • Picking lengkap, lanjut packing.':''}`;
    } else {
      if(!order.airwayBill||data.code!==order.airwayBill) fail(422,'Nomor resi tidak sesuai dengan order.');
      if(order.status==='completed') {message='Order ini sudah selesai.';replayed=true;}
      else {
        if(order.status!=='packing'||order.items.some(i=>i.pickedQty!==i.qty)) fail(409,'Lengkapi picking sebelum scan resi.');
        if(!order.pdfFileId||!order.receiptPages.length) fail(422,'PDF resi belum lengkap. Minta admin melengkapinya.');
        getFile(order.pdfFileId,'pdf');const now=Date.now();
        db.prepare("UPDATE orders SET status='completed',completed_at=?,updated_at=? WHERE id=? AND status='packing'").run(now,now,id);
        recordActivity(actor,id,'Packing selesai');message='Packing selesai. Order siap dikirim.';
      }
    }
    db.prepare('INSERT INTO scan_requests VALUES(?,?,?,?,?,?)').run(data.requestId,id,actor.id,data.kind,data.code,message);
    return {order:getOrder(actor,id),message,replayed};
  });
}
