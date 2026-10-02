import { test,expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/lib/db';
import { shelfLabels } from '../src/lib/locations';
test('v1 data keeps photo, rack configuration and progress; unknown stock is never invented',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'inventory-migration-')),'v1.sqlite'),old=new DatabaseSync(path);old.exec(readFileSync('tests/fixtures/rack-schema.sql','utf8'));
 old.prepare('INSERT INTO racks(id,name,shelf_count) VALUES(7,?,8)').run('Rak Utara');for(const shelf of shelfLabels(8))old.prepare('INSERT INTO rack_shelves VALUES(7,?)').run(shelf);
 old.exec("INSERT INTO users VALUES('admin','Admin','admin','hash','admin',1); INSERT INTO files VALUES('photo','admin','photo','photo.png','image/png','/tmp/photo',NULL,1); INSERT INTO products VALUES('product','SKU-A','A',7,'H','photo',1); INSERT INTO orders VALUES('pending','ORD','AWB',NULL,'[]','packing','admin',1,1,NULL); INSERT INTO order_items VALUES('pending','product','SKU-A','A',2,2); INSERT INTO orders VALUES('done','DONE','DONE-AWB',NULL,'[]','completed','admin',1,1,1); INSERT INTO order_items VALUES('done','product','SKU-A','A',3,3); INSERT INTO scan_requests VALUES('request','pending','admin','sku','SKU-A','OK'); PRAGMA user_version=1;");old.close();
 const db=openDatabase(path);expect(db.prepare('PRAGMA user_version').get()).toMatchObject({user_version:2});expect(db.prepare('SELECT * FROM products').get()).toMatchObject({id:'product',photo_file_id:'photo',rack:7,shelf:'H'});
 expect(db.prepare('SELECT * FROM product_locations').get()).toMatchObject({product_id:'product',rack:7,shelf:'H',quantity:null});expect(db.prepare('SELECT * FROM order_location_picks').all()).toHaveLength(1);expect(db.prepare('SELECT * FROM order_location_picks').get()).toMatchObject({order_id:'pending',quantity:2});
 expect(db.prepare('SELECT * FROM scan_requests').get()).toMatchObject({request_id:'request',result:'OK',location_id:null});expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);db.close();
 const reopened=openDatabase(path);expect(reopened.prepare('SELECT COUNT(*) n FROM product_locations').get()).toMatchObject({n:1});expect(reopened.prepare('SELECT COUNT(*) n FROM order_location_picks').get()).toMatchObject({n:1});reopened.close();
});
