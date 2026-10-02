import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { listRacks,saveRack,shelfLabels } from '../src/lib/racks';
import { saveProduct,listProducts } from '../src/lib/catalog';
import { createOrder,getOrder } from '../src/lib/orders';
import { claimOrder,scanOrder } from '../src/lib/picking';
import { getDatabase,openDatabase } from '../src/lib/db';
import { randomUUID } from 'node:crypto';

test('existing four racks default to six shelves; new rack accepts its own shelf count and SKU location',()=>{
  const {admin,staff}=fixture();
  expect(listRacks(staff).map(r=>({id:r.id,name:r.name,shelfCount:r.shelfCount}))).toEqual([1,2,3,4].map(id=>({id,name:`Rak ${id}`,shelfCount:6})));
  const id=saveRack(admin,null,{name:'Rak Utara',shelfCount:8});expect(id).toBe(5);
  saveProduct(admin,null,{sku:'NEW',name:'Baru',rack:id,shelf:'H',active:true});
  expect(listProducts(staff)[0]).toMatchObject({rack:5,rackName:'Rak Utara',shelf:'H'});
  expect(()=>saveProduct(admin,null,{sku:'INVALID',name:'Salah',rack:id,shelf:'I',active:true})).toThrow();
});

test('rack rename and shelf expansion update current order instructions without erasing picked qty',()=>{
  const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'A',name:'Barang',rack:1,shelf:'B',active:true});
  const orderId=createOrder(admin,{orderNumber:'LOCATION',receiptPages:[],items:[{productId,qty:2}]});claimOrder(staff,orderId);
  scanOrder(staff,orderId,{kind:'sku',code:'A',requestId:randomUUID()});
  saveRack(admin,1,{name:'Rak Depan',shelfCount:8});
  expect(getOrder(staff,orderId).items[0]).toMatchObject({rack:1,rackName:'Rak Depan',shelf:'B',pickedQty:1,qty:2});
  expect(shelfLabels(8)).toEqual(['A','B','C','D','E','F','G','H']);
});

test('occupied shelves including inactive SKUs cannot be removed; move items before shrinking',()=>{
  const {admin,staff}=fixture();const id=saveProduct(admin,null,{sku:'F',name:'Barang F',rack:1,shelf:'F',active:false});
  expect(()=>saveRack(admin,1,{name:'Tidak tersimpan',shelfCount:3})).toThrow();
  expect(listRacks(staff)[0]).toMatchObject({name:'Rak 1',shelfCount:6});
  saveProduct(admin,id,{sku:'F',name:'Barang F',rack:1,shelf:'C',active:false});saveRack(admin,1,{name:'Rak Pendek',shelfCount:3});
  expect(()=>saveProduct(admin,null,{sku:'BAD',name:'Bad',rack:1,shelf:'D',active:true})).toThrow();
  const reopened=openDatabase(process.env.DATABASE_PATH!);expect(reopened.prepare('SELECT shelf FROM rack_shelves WHERE rack=1 ORDER BY shelf').all().map(r=>r.shelf)).toEqual(['A','B','C']);reopened.close();
});

test('only admins edit racks; blank/duplicate names and invalid shelf counts are rejected',()=>{
  const {admin,staff}=fixture();expect(()=>saveRack(staff,null,{name:'No',shelfCount:6})).toThrow();
  for(const input of [{name:'',shelfCount:6},{name:'Rak 1',shelfCount:6},{name:'Zero',shelfCount:0},{name:'Fraction',shelfCount:1.5}])expect(()=>saveRack(admin,null,input)).toThrow();
  expect(()=>saveRack(admin,999,{name:'Missing',shelfCount:6})).toThrow();
  expect(shelfLabels(28).slice(-3)).toEqual(['Z','AA','AB']);
});

test('database itself rejects a location removed from a rack',()=>{
  const {admin}=fixture();saveRack(admin,1,{name:'Rak kecil',shelfCount:2});
  expect(()=>getDatabase().prepare('INSERT INTO products(id,sku,name,rack,shelf,active) VALUES(?,?,?,?,?,?)').run(randomUUID(),'BAD','Bad',1,'C',1)).toThrow();
});
