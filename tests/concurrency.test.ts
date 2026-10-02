import { expect,test } from 'vitest';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers';
import { createStaff } from '../src/lib/auth';
import { saveProduct,listProducts } from '../src/lib/catalog';
import { createOrder,getOrder } from '../src/lib/orders';
function worker(input:unknown):Promise<{ok:boolean;status?:number}>{return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','tests/transaction-worker.ts',JSON.stringify(input)],{env:{...process.env}});let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('close',code=>{if(code)reject(new Error(error));else resolve(JSON.parse(output));});});}
test('two connections cannot claim the same order or overscan its qty',async()=>{
 const {admin,staff}=fixture(),other=createStaff(admin,{username:'other',name:'Other',password:'password123'});
 const productId=saveProduct(admin,null,{sku:'A',name:'A',rack:1,shelf:'A',quantity:10,active:true});const orderId=createOrder(admin,{orderNumber:'RACE',receiptPages:[],items:[{productId,qty:1}]});
 const claims=await Promise.all([staff,other].map(actor=>worker({action:'claim',actor,orderId})));expect(claims.filter(c=>c.ok)).toHaveLength(1);const winner=claims[0].ok?staff:other;
 const scans=await Promise.all([1,2].map(()=>worker({action:'scan',actor:winner,orderId,scan:{kind:'sku',code:'A',requestId:randomUUID()}})));expect(scans.filter(s=>s.ok)).toHaveLength(1);expect(getOrder(admin,orderId).items[0].pickedQty).toBe(1);
},15000);

test('two orders cannot reserve the same last unit on separate database connections',async()=>{
 const {admin,staff}=fixture();const productId=saveProduct(admin,null,{sku:'LAST',name:'Last',rack:1,shelf:'A',quantity:1,active:true});
 const ids=['FIRST','SECOND'].map(orderNumber=>createOrder(admin,{orderNumber,receiptPages:[],items:[{productId,qty:1}]}));
 await Promise.all(ids.map(orderId=>worker({action:'claim',actor:staff,orderId})));
 const scans=await Promise.all(ids.map(orderId=>worker({action:'scan',actor:staff,orderId,scan:{kind:'sku',code:'LAST',requestId:randomUUID()}})));
 expect(scans.filter(s=>s.ok)).toHaveLength(1);expect(ids.reduce((sum,id)=>sum+getOrder(admin,id).items[0].pickedQty,0)).toBe(1);
 expect(listProducts(admin)[0].locations[0]).toMatchObject({quantity:1,reservedQuantity:1,availableQuantity:0});
},15000);
