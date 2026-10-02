import { expect,test } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/lib/db';

test('legacy rack migration preserves products, photos, order items, picking progress and foreign keys',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'rack-migration-')),'legacy.sqlite');const old=new DatabaseSync(path);
  // Original schema fixture, deliberately retaining the legacy location constraints.
  old.exec(readFileSync('tests/fixtures/legacy-schema.sql','utf8'));
  old.exec("INSERT INTO users VALUES('admin','Admin','admin','hash','admin',1); INSERT INTO files VALUES('photo','admin','photo','photo.png','image/png','/tmp/photo',NULL,1); INSERT INTO products VALUES('product','SKU-A','A',4,'F','photo',1); INSERT INTO orders VALUES('order','ORD','AWB',NULL,'[]','picking','admin',1,1,NULL); INSERT INTO order_items VALUES('order','product','SKU-A','A',2,1); INSERT INTO activities VALUES('activity','order','admin','Barang diambil','SKU-A',1); INSERT INTO scan_requests VALUES('request','order','admin','sku','SKU-A','OK');");old.close();
  const db=openDatabase(path);
  expect(db.prepare('SELECT name,shelf_count FROM racks WHERE id=4').get()).toMatchObject({name:'Rak 4',shelf_count:6});
  expect(db.prepare('SELECT * FROM products').get()).toMatchObject({id:'product',rack:4,shelf:'F',photo_file_id:'photo'});
  expect(db.prepare('SELECT * FROM order_items').get()).toMatchObject({qty:2,picked_qty:1});
  expect(db.prepare('SELECT status FROM orders').get()).toMatchObject({status:'picking'});
  expect(db.prepare('SELECT result FROM scan_requests').get()).toMatchObject({result:'OK'});expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  db.close();const reopened=openDatabase(path);expect(reopened.prepare('SELECT COUNT(*) n FROM racks').get()).toMatchObject({n:4});expect(reopened.prepare('SELECT picked_qty FROM order_items').get()).toMatchObject({picked_qty:1});reopened.close();
});
