import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import { assertActiveActor } from './auth';
import { getDatabase,inTransaction } from './db';
import { getFile,readAuthorizedFile } from './files';
import { databaseError,fail } from './errors';
import type { Actor,OrderInput,OrderDetail,Status } from './types';
export const orderSchema=z.object({orderNumber:z.string().trim().min(1).max(100),airwayBill:z.string().trim().max(100).optional(),pdfFileId:z.string().uuid().optional(),receiptPages:z.array(z.number().int().positive()).max(1000),items:z.array(z.object({productId:z.string().uuid(),qty:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)})).min(1).max(500)});
function validated(input:OrderInput,existing?:OrderDetail) {
  const parsed=orderSchema.parse(input);const db=getDatabase();const grouped=new Map<string,number>();
  for(const item of parsed.items) {const qty=(grouped.get(item.productId)||0)+item.qty;if(!Number.isSafeInteger(qty)) fail(422,'Jumlah barang terlalu besar.');grouped.set(item.productId,qty);}
  const items=Array.from(grouped,([productId,qty])=>{
    const product=db.prepare('SELECT sku,name,active FROM products WHERE id=?').get(productId);
    if(!product||!product.active&&!existing?.items.some(item=>item.productId===productId)) fail(422,'Barang belum terdaftar atau tidak aktif.');return {productId,qty,sku:product.sku as string,name:product.name as string};
  });
  const pages=parsed.receiptPages;
  if(parsed.pdfFileId) {const file=getFile(parsed.pdfFileId,'pdf');if(!pages.length||pages.some(p=>p>(file.page_count||0))||new Set(pages).size!==pages.length) fail(422,'Pilih halaman resi yang valid tanpa duplikat.');}
  else if(pages.length) fail(422,'Upload PDF sebelum memilih halaman resi.');
  return {...parsed,receiptPages:[...pages].sort((a,b)=>a-b),items};
}
export function recordActivity(actor:Actor,orderId:string,action:string,sku:string|null=null):void {getDatabase().prepare('INSERT INTO activities VALUES(?,?,?,?,?,?)').run(randomUUID(),orderId,actor.id,action,sku,Date.now());}
export function createOrder(actor:Actor,input:OrderInput):string {
  try {return inTransaction(()=>{
    assertActiveActor(actor,['admin']);const data=validated(input);const id=randomUUID();const db=getDatabase();const now=Date.now();
    db.prepare('INSERT INTO orders(id,order_number,airway_bill,pdf_file_id,receipt_pages,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,data.orderNumber,data.airwayBill||null,data.pdfFileId||null,JSON.stringify(data.receiptPages),now,now);
    for(const item of data.items) db.prepare('INSERT INTO order_items(order_id,product_id,sku,name,qty) VALUES(?,?,?,?,?)').run(id,item.productId,item.sku,item.name,item.qty);
    recordActivity(actor,id,'Order dibuat');return id;
  });} catch(error) {databaseError(error);}
}
export function updateOrder(actor:Actor,id:string,input:OrderInput):void {
  try {inTransaction(()=>{
    assertActiveActor(actor,['admin']);const current=getOrder(actor,id);if(current.status==='completed') fail(409,'Order selesai tidak dapat diubah.');
    const data=validated(input,current.status==='waiting'?undefined:current);const db=getDatabase();
    if(current.status!=='waiting') {
      if(current.orderNumber!==data.orderNumber||current.items.length!==data.items.length||data.items.some(item=>!current.items.some(existing=>existing.productId===item.productId&&existing.qty===item.qty))) fail(409,'Isi order yang sudah dimulai tidak dapat diubah.');
    } else {
      db.prepare('DELETE FROM order_items WHERE order_id=?').run(id);
      for(const item of data.items) db.prepare('INSERT INTO order_items(order_id,product_id,sku,name,qty) VALUES(?,?,?,?,?)').run(id,item.productId,item.sku,item.name,item.qty);
    }
    db.prepare('UPDATE orders SET order_number=?,airway_bill=?,pdf_file_id=?,receipt_pages=?,updated_at=? WHERE id=?').run(data.orderNumber,data.airwayBill||null,data.pdfFileId||null,JSON.stringify(data.receiptPages),Date.now(),id);
    recordActivity(actor,id,'Order diperbarui');
  });} catch(error) {databaseError(error);}
}
export function getOrder(actor:Actor,id:string):OrderDetail {
  assertActiveActor(actor);const db=getDatabase();
  const row=db.prepare('SELECT o.id,o.order_number AS orderNumber,o.airway_bill AS airwayBill,o.status,o.assignee_id AS assigneeId,u.name AS assigneeName,o.pdf_file_id AS pdfFileId,o.receipt_pages AS receiptPages,o.created_at AS createdAt,o.completed_at AS completedAt FROM orders o LEFT JOIN users u ON u.id=o.assignee_id WHERE o.id=?').get(id);
  if(!row) fail(404,'Order tidak ditemukan.');
  const items=db.prepare('SELECT i.product_id AS productId,i.sku,i.name,i.qty,i.picked_qty AS pickedQty,p.rack,r.name AS rackName,p.shelf,p.photo_file_id AS photoFileId FROM order_items i JOIN products p ON p.id=i.product_id JOIN racks r ON r.id=p.rack WHERE i.order_id=? ORDER BY p.rack,length(p.shelf),p.shelf,i.sku').all(id);
  return {...row,receiptPages:JSON.parse(row.receiptPages as string),items:items.map(item=>({...item}))} as OrderDetail;
}
export function listOrders(actor:Actor,filter:{status?:Status;search?:string}={}):OrderDetail[] {
  assertActiveActor(actor);const query=filter.search?.trim()||'';
  const rows=getDatabase().prepare("SELECT id FROM orders WHERE (?='' OR status=?) AND (?='' OR instr(lower(order_number),lower(?))>0 OR instr(lower(COALESCE(airway_bill,'')),lower(?))>0) ORDER BY created_at DESC").all(filter.status||'',filter.status||'',query,query,query);
  return rows.map(row=>getOrder(actor,row.id as string));
}
export async function buildReceipt(actor:Actor,orderId:string):Promise<Uint8Array> {
  const order=getOrder(actor,orderId);if(!order.pdfFileId||!order.receiptPages.length) fail(422,'PDF resi belum tersedia. Minta admin melengkapinya.');
  const source=await PDFDocument.load(readAuthorizedFile(actor,order.pdfFileId).bytes);const result=await PDFDocument.create();
  for(const page of await result.copyPages(source,order.receiptPages.map(p=>p-1))) result.addPage(page);return result.save();
}
export function listActivities(actor:Actor,id:string) {getOrder(actor,id);return getDatabase().prepare('SELECT a.action,a.sku,a.created_at AS createdAt,u.name AS actorName FROM activities a JOIN users u ON u.id=a.actor_id WHERE a.order_id=? ORDER BY a.created_at DESC LIMIT 100').all(id).map(row=>({...row}));}
