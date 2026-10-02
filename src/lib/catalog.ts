import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDatabase,inTransaction } from './db';
import { assertActiveActor } from './auth';
import { getFile } from './files';
import { databaseError,fail } from './errors';
import { productLocations } from './inventory';
import type { Actor,Product,ProductPage } from './types';
const locationSchema=z.object({id:z.string().uuid().optional(),rack:z.number().int().positive(),shelf:z.string().trim().regex(/^[A-Z]+$/),quantity:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),expectedQuantity:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional()});
const schema=z.object({sku:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),locations:z.array(locationSchema).min(1).max(100).optional(),rack:z.number().int().positive().optional(),shelf:z.string().trim().regex(/^[A-Z]+$/).optional(),quantity:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),photoFileId:z.string().uuid().optional(),active:z.boolean()});
export function saveProduct(actor:Actor,id:string|null,input:z.input<typeof schema>):string {
 return inTransaction(()=>{
  assertActiveActor(actor,['admin']);const data=schema.parse(input),db=getDatabase();
  const previous=id?db.prepare('SELECT * FROM products WHERE id=?').get(id):undefined;
  if(id&&!previous)fail(404,'Barang tidak ditemukan.');
  if(id&&previous?.sku!==data.sku&&db.prepare('SELECT order_id FROM order_items WHERE product_id=? LIMIT 1').get(id))fail(409,'SKU yang digunakan pada order tidak dapat diganti.');
  if(data.photoFileId)getFile(data.photoFileId,'photo');
  const existing=id?productLocations(id):[];
  // Keep single-location requests usable by scripts; multi-location clients send locations explicitly.
  const locations=data.locations??locationSchema.array().min(1).parse([{id:existing.length===1?existing[0].id:undefined,rack:data.rack,shelf:data.shelf,quantity:data.quantity===undefined?(existing.length===1?existing[0].quantity:null):data.quantity}]);
  if(!data.locations&&existing.length>1)fail(409,'Gunakan daftar lokasi untuk mengubah produk dengan beberapa lokasi.');
  const keys=new Set<string>(),ids=new Set<string>();let total=0;
  const desired=locations.map(location=>{
   const key=`${location.rack}:${location.shelf}`;
   if(keys.has(key))fail(422,'Rak dan ambalan yang sama tidak boleh dimasukkan dua kali.');keys.add(key);
   if(!db.prepare('SELECT 1 FROM rack_shelves WHERE rack=? AND shelf=?').get(location.rack,location.shelf))fail(422,'Rak atau ambalan tidak tersedia.');
   const old=location.id?existing.find(l=>l.id===location.id):existing.find(l=>l.rack===location.rack&&l.shelf===location.shelf);
   if(old&&location.expectedQuantity!==undefined&&old.quantity!==location.expectedQuantity)fail(409,'Quantity telah berubah sejak formulir dibuka. Muat ulang halaman dan periksa stok terbaru.');
   if(location.id&&!old)fail(422,'Lokasi tidak sesuai dengan produk.');
   const locationId=old?.id??randomUUID();if(ids.has(locationId))fail(422,'Lokasi duplikat.');ids.add(locationId);
   if(old?.reservedQuantity){
    if(old.rack!==location.rack||old.shelf!==location.shelf)fail(409,'Lokasi sedang digunakan picking. Selesaikan packing sebelum memindahkan lokasi.');
    if(location.quantity!==null&&location.quantity<old.reservedQuantity||location.quantity===null&&old.quantity!==null)fail(409,'Quantity tidak boleh lebih kecil daripada jumlah yang dicadangkan untuk picking.');
   }
   total+=location.quantity??0;if(!Number.isSafeInteger(total))fail(422,'Total quantity terlalu besar.');
   return {...location,id:locationId};
  });
  if(existing.some(l=>!ids.has(l.id)&&l.reservedQuantity>0))fail(409,'Lokasi sedang digunakan picking dan tidak dapat dihapus.');
  const productId=id||randomUUID(),first=desired[0];
  try{
   if(id)db.prepare('UPDATE products SET sku=?,name=?,rack=?,shelf=?,photo_file_id=?,active=? WHERE id=?').run(data.sku,data.name,first.rack,first.shelf,data.photoFileId??previous?.photo_file_id??null,data.active?1:0,id);
   else db.prepare('INSERT INTO products(id,sku,name,rack,shelf,photo_file_id,active) VALUES(?,?,?,?,?,?,?)').run(productId,data.sku,data.name,first.rack,first.shelf,data.photoFileId??null,data.active?1:0);
   for(const old of existing)if(!ids.has(old.id))db.prepare('DELETE FROM product_locations WHERE id=?').run(old.id);
   for(const location of desired)db.prepare('INSERT INTO product_locations(id,product_id,rack,shelf,quantity) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rack=excluded.rack,shelf=excluded.shelf,quantity=excluded.quantity').run(location.id,productId,location.rack,location.shelf,location.quantity);
  }catch(error){databaseError(error);}
  return productId;
 });
}
const productSelect='SELECT p.id,p.sku,p.name,p.rack,r.name AS rackName,p.shelf,p.photo_file_id AS photoFileId,p.active FROM products p JOIN racks r ON r.id=p.rack';
function hydrateProducts(rows:Record<string,unknown>[]):Product[]{
 return rows.map(row=>{
  const locations=productLocations(String(row.id));return {...row,active:!!row.active,locations,totalQuantity:locations.some(l=>l.quantity===null)?null:locations.reduce((sum,l)=>sum+(l.quantity??0),0)};
 }) as Product[];
}
export function listProducts(actor:Actor):Product[]{
 assertActiveActor(actor);return hydrateProducts(getDatabase().prepare(`${productSelect} ORDER BY p.sku`).all());
}
export function paginateProducts(actor:Actor,filter:{search?:string;page?:number;rack?:number|null}={}):ProductPage{
 assertActiveActor(actor);const db=getDatabase(),search=filter.search?.trim()||'',pageSize=20;
 const rack=Number.isSafeInteger(filter.rack)&&(filter.rack??0)>0?filter.rack!:null;
 const where="WHERE instr(lower(p.sku || ' ' || p.name),lower(?))>0 AND (? IS NULL OR EXISTS(SELECT 1 FROM product_locations l WHERE l.product_id=p.id AND l.rack=?))";
 const total=Number(db.prepare(`SELECT COUNT(*) AS total FROM products p ${where}`).get(search,rack,rack)?.total??0),totalPages=Math.max(1,Math.ceil(total/pageSize));
 const requested=Number.isSafeInteger(filter.page)&&filter.page!>0?filter.page!:1,page=Math.min(requested,totalPages);
 const rows=db.prepare(`${productSelect} ${where} ORDER BY p.sku,p.id LIMIT ? OFFSET ?`).all(search,rack,rack,pageSize,(page-1)*pageSize);
 return {products:hydrateProducts(rows),total,totalPages,page,pageSize};
}
