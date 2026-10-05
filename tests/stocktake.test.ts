import { expect,test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers';
import { saveProduct,listProducts } from '../src/lib/catalog';
import * as stocktake from '../src/lib/stocktake';
import { getDatabase,openDatabase } from '../src/lib/db';
import { createOrder } from '../src/lib/orders';
import { claimOrder,scanOrder } from '../src/lib/picking';

function setup(quantity:number|null=10){
 const ctx=fixture();
 const id=saveProduct(ctx.admin,null,{sku:'COUNT',name:'Barang opname',active:true,locations:[{rack:1,shelf:'B',quantity},{rack:2,shelf:'C',quantity:5}]});
 const product=()=>listProducts(ctx.admin).find(p=>p.id===id)!;
 const location=product().locations[0];
 const input={locationId:location.id,expectedQuantity:quantity,expectedRack:1,expectedShelf:'B',quantity:8,note:'Selisih penghitungan'};
 return {...ctx,id,product,location,input};
}
test('stocktake updates one location with persistent history of quantity, note and actor',()=>{
 const {admin,product,input}=setup();
 stocktake.saveStocktake(admin,input);
 expect(product().locations.map(l=>l.quantity)).toEqual([8,5]);
 expect(stocktake.listStocktakes(admin)[0]).toMatchObject({sku:'COUNT',name:'Barang opname',rackName:'Rak 1',shelf:'B',beforeQuantity:10,quantity:8,note:'Selisih penghitungan',actorName:'Admin',actorId:admin.id});
 const db=openDatabase(process.env.DATABASE_PATH!);expect(db.prepare('SELECT COUNT(*) n FROM stocktakes').get()).toMatchObject({n:1});db.close();
});
test('stocktake can initialize unknown stock and record a count with no difference',()=>{
 const {admin,input,product}=setup(null);
 stocktake.saveStocktake(admin,{...input,quantity:0});
 expect(product().locations[0].quantity).toBe(0);
 expect(stocktake.listStocktakes(admin)[0].beforeQuantity).toBeNull();
 stocktake.saveStocktake(admin,{...input,expectedQuantity:0,quantity:0});
 expect(stocktake.listStocktakes(admin)).toHaveLength(2);
});
test('stale stocktake cannot overwrite a newer correction or a moved location',()=>{
 const {admin,input,product}=setup();
 stocktake.saveStocktake(admin,input);
 expect(()=>stocktake.saveStocktake(admin,{...input,quantity:12})).toThrow(/berubah/);
 getDatabase().prepare("UPDATE product_locations SET shelf='D' WHERE id=?").run(input.locationId);
 expect(()=>stocktake.saveStocktake(admin,{...input,expectedQuantity:8})).toThrow(/berubah/);
 expect(product().locations[0].quantity).toBe(8);
 expect(stocktake.listStocktakes(admin)).toHaveLength(1);
});
test('stocktake protects picking reservations and rolls back history on failure',()=>{
 const {admin,staff,id,input,product}=setup();
 const order=createOrder(admin,{orderNumber:'COUNT-ORDER',receiptPages:[],items:[{productId:id,qty:2}]});
 claimOrder(staff,order);scanOrder(staff,order,{kind:'sku',code:'COUNT',locationId:input.locationId,requestId:randomUUID()});
 expect(()=>stocktake.saveStocktake(admin,{...input,quantity:0})).toThrow(/dicadangkan/);
 expect(product().locations[0].quantity).toBe(10);expect(stocktake.listStocktakes(admin)).toHaveLength(0);
 stocktake.saveStocktake(admin,{...input,quantity:1});expect(product().locations[0].reservedQuantity).toBe(1);
});
test('stocktake rejects unauthorized actors, invalid counts and missing locations',()=>{
 const {admin,staff,input,product}=setup();
 expect(()=>stocktake.saveStocktake(staff,input)).toThrow();expect(()=>stocktake.listStocktakes(staff)).toThrow();
 for(const change of [{quantity:-1},{quantity:1.5},{quantity:Number.MAX_SAFE_INTEGER},{quantity:Number.MAX_SAFE_INTEGER+1},{quantity:null},{expectedQuantity:undefined},{note:'x'.repeat(501)},{locationId:randomUUID()}])expect(()=>stocktake.saveStocktake(admin,{...input,...change})).toThrow();
 expect(product().locations[0].quantity).toBe(10);expect(stocktake.listStocktakes(admin)).toHaveLength(0);
});
test('stock correction rolls back when recording its history fails',()=>{
 const {admin,input,product}=setup();
 getDatabase().exec("CREATE TRIGGER reject_stocktake BEFORE INSERT ON stocktakes BEGIN SELECT RAISE(ABORT,'history unavailable'); END");
 expect(()=>stocktake.saveStocktake(admin,input)).toThrow(/history unavailable/);
 expect(product().locations[0].quantity).toBe(10);expect(stocktake.listStocktakes(admin)).toHaveLength(0);
});
