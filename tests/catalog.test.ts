import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct,listProducts } from '../src/lib/catalog';
test('SKU retains zeros; admin moves one product and rejects invalid/duplicate SKU',()=>{
 const {admin,staff}=fixture();
 const id=saveProduct(admin,null,{sku:'001A',name:'Barang A',rack:1,shelf:'B',active:true});
 saveProduct(admin,id,{sku:'001A',name:'Barang A',rack:4,shelf:'F',active:true});
 expect(listProducts(staff)[0]).toMatchObject({sku:'001A',rack:4,shelf:'F'});
 expect(()=>saveProduct(staff,null,{sku:'B',name:'B',rack:1,shelf:'A',active:true})).toThrow();
 expect(()=>saveProduct(admin,null,{sku:'001A',name:'A',rack:1,shelf:'B',active:true})).toThrow();
 expect(()=>saveProduct(admin,null,{sku:'C',name:'C',rack:5,shelf:'A',active:true})).toThrow();
});
