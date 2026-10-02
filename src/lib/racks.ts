import { z } from 'zod';
import { getDatabase,inTransaction } from './db';
import { assertActiveActor } from './auth';
import { databaseError,fail } from './errors';
import { shelfLabels } from './locations';
import type { Actor,Rack } from './types';
export { shelfLabels } from './locations';
const schema=z.object({name:z.string().trim().min(1).max(100),shelfCount:z.number().int().min(1).max(1000)});
export function listRacks(actor:Actor):Rack[]{
  assertActiveActor(actor);
  return getDatabase().prepare('SELECT id,name,shelf_count AS shelfCount FROM racks ORDER BY id').all().map(row=>({...row})) as Rack[];
}
export function saveRack(actor:Actor,id:number|null,input:z.input<typeof schema>):number {
  return inTransaction(()=>{
    assertActiveActor(actor,['admin']);const data=schema.parse(input),db=getDatabase(),labels=shelfLabels(data.shelfCount);
    if(id!==null&&!db.prepare('SELECT id FROM racks WHERE id=?').get(id))fail(404,'Rak tidak ditemukan.');
    if(id!==null){
      const occupied=db.prepare('SELECT sku,shelf FROM products WHERE rack=?').all(id).find(row=>!labels.includes(String(row.shelf)));
      if(occupied)fail(409,`Ambalan ${occupied.shelf} masih ditempati SKU ${occupied.sku}. Pindahkan barang sebelum mengurangi ambalan.`);
    }
    try{
      if(id===null)id=Number(db.prepare('INSERT INTO racks(name,shelf_count) VALUES(?,?)').run(data.name,data.shelfCount).lastInsertRowid);
      else db.prepare('UPDATE racks SET name=?,shelf_count=? WHERE id=?').run(data.name,data.shelfCount,id);
      for(const row of db.prepare('SELECT shelf FROM rack_shelves WHERE rack=?').all(id))if(!labels.includes(String(row.shelf)))db.prepare('DELETE FROM rack_shelves WHERE rack=? AND shelf=?').run(id,row.shelf);
      for(const shelf of labels)db.prepare('INSERT OR IGNORE INTO rack_shelves(rack,shelf) VALUES(?,?)').run(id,shelf);
    }catch(error){databaseError(error);}
    return id!;
  });
}
