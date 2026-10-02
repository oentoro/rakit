import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDatabase,inTransaction } from './db';
import { assertActiveActor } from './auth';
import { getFile } from './files';
import { databaseError,fail } from './errors';
import type { Actor,Product } from './types';
const schema=z.object({sku:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),rack:z.number().int().min(1),shelf:z.string().trim().regex(/^[A-Z]+$/),photoFileId:z.string().uuid().optional(),active:z.boolean()});
export function saveProduct(actor:Actor,id:string|null,input:z.input<typeof schema>):string {
  return inTransaction(()=>{assertActiveActor(actor,['admin']);const data=schema.parse(input);const db=getDatabase();
  if(!db.prepare('SELECT 1 FROM rack_shelves WHERE rack=? AND shelf=?').get(data.rack,data.shelf)) fail(422,'Rak atau ambalan tidak tersedia.');
  const previous=id?db.prepare('SELECT * FROM products WHERE id=?').get(id):undefined;
  if(id&&!previous) fail(404,'Barang tidak ditemukan.');
  if(id&&previous?.sku!==data.sku&&db.prepare('SELECT order_id FROM order_items WHERE product_id=? LIMIT 1').get(id)) fail(409,'SKU yang digunakan pada order tidak dapat diganti.');
  if(data.photoFileId) getFile(data.photoFileId,'photo');
  const productId=id||randomUUID();
  try {
    if(id) db.prepare('UPDATE products SET sku=?,name=?,rack=?,shelf=?,photo_file_id=?,active=? WHERE id=?').run(data.sku,data.name,data.rack,data.shelf,data.photoFileId??previous?.photo_file_id??null,data.active?1:0,id);
    else db.prepare('INSERT INTO products(id,sku,name,rack,shelf,photo_file_id,active) VALUES(?,?,?,?,?,?,?)').run(productId,data.sku,data.name,data.rack,data.shelf,data.photoFileId||null,data.active?1:0);
  } catch(error) {databaseError(error);}return productId;});
}
export function listProducts(actor:Actor):Product[] {
  assertActiveActor(actor);return getDatabase().prepare('SELECT p.id,p.sku,p.name,p.rack,r.name AS rackName,p.shelf,p.photo_file_id AS photoFileId,p.active FROM products p JOIN racks r ON r.id=p.rack ORDER BY p.rack,length(p.shelf),p.shelf,p.sku').all().map(row=>({...row,active:!!row.active})) as Product[];
}
