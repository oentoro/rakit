import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertActiveActor } from './auth';
import { getDatabase,inTransaction } from './db';
import { fail } from './errors';
import type { Actor,Stocktake } from './types';

const count=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const schema=z.object({locationId:z.string().uuid(),expectedQuantity:count.nullable(),expectedRack:z.number().int().positive(),expectedShelf:z.string().min(1).max(10),quantity:count,note:z.string().trim().max(500).default('')});

export function saveStocktake(actor:Actor,input:unknown):string {
 return inTransaction(()=>{
  const currentActor=assertActiveActor(actor,['admin']),data=schema.parse(input),db=getDatabase();
  const location=db.prepare(`SELECT l.quantity,l.rack,l.shelf,l.product_id AS productId,p.sku,p.name,r.name AS rackName,
   COALESCE((SELECT SUM(quantity) FROM order_location_picks WHERE location_id=l.id),0) AS reservedQuantity
   FROM product_locations l JOIN products p ON p.id=l.product_id JOIN racks r ON r.id=l.rack WHERE l.id=?`).get(data.locationId);
  if(!location)fail(404,'Lokasi barang tidak ditemukan. Muat ulang daftar barang.');
  if(location.quantity!==data.expectedQuantity||location.rack!==data.expectedRack||location.shelf!==data.expectedShelf)fail(409,'Stok atau lokasi telah berubah sejak formulir dibuka. Muat ulang halaman dan hitung ulang stok terbaru.');
  if(data.quantity<Number(location.reservedQuantity))fail(409,'Jumlah fisik tidak boleh lebih kecil daripada stok yang dicadangkan untuk picking.');
  const total=db.prepare('SELECT quantity FROM product_locations WHERE product_id=? AND id<>?').all(location.productId,data.locationId)
   .reduce((sum,row)=>sum+Number(row.quantity??0),data.quantity);
  if(!Number.isSafeInteger(total))fail(422,'Total quantity terlalu besar.');
  const id=randomUUID();
  db.prepare('UPDATE product_locations SET quantity=? WHERE id=?').run(data.quantity,data.locationId);
  db.prepare('INSERT INTO stocktakes(id,location_id,sku,name,rack_name,shelf,before_quantity,quantity,note,actor_id,actor_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
   .run(id,data.locationId,location.sku,location.name,location.rackName,location.shelf,location.quantity,data.quantity,data.note,currentActor.id,currentActor.name,Date.now());
  return id;
 });
}

export function listStocktakes(actor:Actor):Stocktake[] {
 assertActiveActor(actor,['admin']);
 return getDatabase().prepare(`SELECT id,location_id AS locationId,sku,name,rack_name AS rackName,shelf,
  before_quantity AS beforeQuantity,quantity,note,actor_id AS actorId,actor_name AS actorName,created_at AS createdAt
  FROM stocktakes ORDER BY created_at DESC,rowid DESC LIMIT 50`).all().map(row=>({...row})) as Stocktake[];
}
