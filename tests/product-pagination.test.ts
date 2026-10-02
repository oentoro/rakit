import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct,paginateProducts } from '../src/lib/catalog';
import { setStaffActive } from '../src/lib/auth';
test('product pagination returns only 20 SKUs with complete locations and stable non-overlapping pages',()=>{
 const {admin,staff}=fixture();
 for(let i=0;i<23;i++)saveProduct(admin,null,{sku:`PAGE-${String(i).padStart(2,'0')}`,name:`Produk ${i}`,active:true,locations:i===0?[{rack:1,shelf:'A',quantity:2},{rack:3,shelf:'B',quantity:3}]:[{rack:1,shelf:'A',quantity:1}]});
 const first=paginateProducts(staff),second=paginateProducts(staff,{page:2});expect(first).toMatchObject({page:1,total:23,totalPages:2,pageSize:20});expect(first.products).toHaveLength(20);expect(first.products[0]).toMatchObject({sku:'PAGE-00',totalQuantity:5});expect(first.products[0].locations).toHaveLength(2);
 expect(second.products.map(p=>p.sku)).toEqual(['PAGE-20','PAGE-21','PAGE-22']);expect(second.products.some(p=>first.products.some(a=>a.id===p.id))).toBe(false);
});
test('search filters all matching products before pagination and literal wildcard characters are safe',()=>{
 const {admin,staff}=fixture();for(let i=0;i<22;i++)saveProduct(admin,null,{sku:`FIND-${String(i).padStart(2,'0')}`,name:'Barang dicari',rack:1,shelf:'A',quantity:1,active:true});
 saveProduct(admin,null,{sku:'OTHER',name:'100% benar_',rack:1,shelf:'A',active:true});
 const result=paginateProducts(staff,{search:'  BARANG dicari  ',page:2});expect(result).toMatchObject({total:22,totalPages:2,page:2});expect(result.products).toHaveLength(2);expect(paginateProducts(staff,{search:'find-21'}).products[0].sku).toBe('FIND-21');expect(paginateProducts(staff,{search:'%'}).total).toBe(1);expect(paginateProducts(staff,{search:'_'}).total).toBe(1);
});
test('invalid and excessive pages are normalized; empty results and inactive accounts are handled',()=>{
 const {admin,staff}=fixture();saveProduct(admin,null,{sku:'ONE',name:'One',rack:1,shelf:'A',active:true});
 for(const page of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,999])expect(paginateProducts(staff,{page})).toMatchObject({page:1,total:1,totalPages:1});
 expect(paginateProducts(staff,{search:'nothing',page:99})).toMatchObject({page:1,total:0,totalPages:1,products:[]});setStaffActive(admin,staff.id,false);expect(()=>paginateProducts(staff)).toThrow();
});

test('rack filtering includes secondary locations and counts each SKU only once',()=>{
 const {admin,staff}=fixture();for(let i=0;i<23;i++)saveProduct(admin,null,{sku:`RACK-${String(i).padStart(2,'0')}`,name:'Rak target',active:true,locations:[{rack:1,shelf:'A',quantity:2},{rack:3,shelf:'B',quantity:3},{rack:3,shelf:'C',quantity:4}]});
 saveProduct(admin,null,{sku:'OTHER',name:'Elsewhere',rack:2,shelf:'A',active:true});
 const result=paginateProducts(staff,{search:'rak target',rack:3,page:2});expect(result).toMatchObject({total:23,totalPages:2,page:2});expect(result.products).toHaveLength(3);expect(result.products.every(p=>p.locations.length===3)).toBe(true);expect(paginateProducts(staff,{rack:4}).total).toBe(0);
});
