import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { shelfLabels } from './locations';
export function migrateRacks(db:DatabaseSync):void {
  if(Number(db.prepare('PRAGMA user_version').get()?.user_version)>=1)return;
  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try {
    if(Number(db.prepare('PRAGMA user_version').get()?.user_version)<1){
      for(let id=1;id<=4;id++){
        db.prepare('INSERT INTO racks(id,name,shelf_count) VALUES(?,?,6)').run(id,`Rak ${id}`);
        for(const shelf of shelfLabels(6))db.prepare('INSERT INTO rack_shelves(rack,shelf) VALUES(?,?)').run(id,shelf);
      }
      db.exec(`CREATE TABLE products_v2 (id TEXT PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, rack INTEGER NOT NULL, shelf TEXT NOT NULL, photo_file_id TEXT REFERENCES files(id), active INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(rack,shelf) REFERENCES rack_shelves(rack,shelf));
        INSERT INTO products_v2 SELECT * FROM products;
        DROP TABLE products;
        ALTER TABLE products_v2 RENAME TO products;`);
      if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Migrasi lokasi menghasilkan referensi tidak valid.');
      db.exec('PRAGMA user_version=1');
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  finally{db.exec('PRAGMA foreign_keys=ON');}
}

export function migrateInventory(db:DatabaseSync):void {
 if(Number(db.prepare('PRAGMA user_version').get()?.user_version)>=2)return;
 db.exec('BEGIN IMMEDIATE');
 try{
  if(Number(db.prepare('PRAGMA user_version').get()?.user_version)<2){
   for(const product of db.prepare('SELECT id,rack,shelf FROM products').all()){
    const locationId=randomUUID();
    db.prepare('INSERT INTO product_locations(id,product_id,rack,shelf,quantity) VALUES(?,?,?,?,NULL)').run(locationId,product.id,product.rack,product.shelf);
    for(const item of db.prepare("SELECT i.order_id,i.picked_qty FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND i.picked_qty>0 AND o.status IN ('picking','packing')").all(product.id)){
     db.prepare('INSERT INTO order_location_picks VALUES(?,?,?,?)').run(item.order_id,product.id,locationId,item.picked_qty);
    }
   }
   db.exec('ALTER TABLE scan_requests ADD COLUMN location_id TEXT; PRAGMA user_version=2');
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
