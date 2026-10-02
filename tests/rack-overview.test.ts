import { expect,test } from 'vitest';
import { fixture } from './helpers';
import { saveProduct } from '../src/lib/catalog';
import { listRackOverview } from '../src/lib/racks';
test('rack overview counts all active SKUs and occupied shelves independently of product pages',()=>{
 const {admin,staff}=fixture();for(let i=0;i<25;i++)saveProduct(admin,null,{sku:`OVERVIEW-${i}`,name:'Product',active:true,locations:[{rack:1,shelf:'A',quantity:1},{rack:1,shelf:'B',quantity:2},{rack:3,shelf:'F',quantity:3}]});
 saveProduct(admin,null,{sku:'INACTIVE',name:'Inactive',rack:1,shelf:'C',active:false});
 const overview=listRackOverview(staff);expect(overview.find(r=>r.id===1)).toMatchObject({skuCount:25,occupiedShelves:['A','B']});expect(overview.find(r=>r.id===3)).toMatchObject({skuCount:25,occupiedShelves:['F']});expect(overview.find(r=>r.id===2)).toMatchObject({skuCount:0,occupiedShelves:[]});
});
