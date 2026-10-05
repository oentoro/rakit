// @vitest-environment jsdom
import React from 'react';
import { afterEach,expect,test,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { StocktakeWorkspace } from '../src/components/stocktake-workspace';
import type { Product } from '../src/lib/types';

vi.mock('next/navigation',()=>({useRouter:()=>({refresh:()=>{}})}));
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
const product:Product={id:'product',sku:'COUNT',name:'Barang dihitung',rack:1,rackName:'Rak 1',shelf:'A',photoFileId:null,active:true,totalQuantity:15,locations:[
 {id:'first',rack:1,rackName:'Rak 1',shelf:'A',quantity:10,reservedQuantity:0,availableQuantity:10,pickedQty:0},
 {id:'second',rack:2,rackName:'Rak 2',shelf:'B',quantity:5,reservedQuantity:0,availableQuantity:5,pickedQty:0}
]};
function show(item:Product=product){
 vi.stubGlobal('fetch',async()=>Response.json(item));
 render(<StocktakeWorkspace result={{products:[],total:0,totalPages:1,page:1,pageSize:20}} racks={[]} search="" rack={null}/>);
}
async function scan(code='COUNT'){
 fireEvent.change(screen.getByLabelText('Kode manual'),{target:{value:code}});fireEvent.click(screen.getByRole('button',{name:'Kirim kode'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Scan unit berikutnya'})).toBeTruthy());
}
test('scans fill and increment the physical count including a manually corrected count without clearing notes',async()=>{
 show({...product,locations:[product.locations[0]]});await scan();
 const quantity=screen.getByLabelText('Jumlah fisik') as HTMLInputElement;
 expect(quantity.value).toBe('1');fireEvent.change(screen.getByLabelText('Catatan'),{target:{value:'Rak diperiksa'}});
 await scan();expect(quantity.value).toBe('2');expect((screen.getByLabelText('Catatan') as HTMLTextAreaElement).value).toBe('Rak diperiksa');
 fireEvent.change(quantity,{target:{value:'7'}});await scan();expect(quantity.value).toBe('8');
});
test('the first unit belongs only to the chosen location; changing locations preserves separate counts',async()=>{
 show();await scan();expect(screen.queryByLabelText('Jumlah fisik')).toBeNull();
 await scan();expect(screen.getByRole('alert').textContent).toMatch(/Pilih rak/);
 const location=screen.getByLabelText('Lokasi opname COUNT');fireEvent.change(location,{target:{value:'first'}});
 expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('1');fireEvent.change(screen.getByLabelText('Catatan'),{target:{value:'Dihitung ulang di rak pertama'}});await scan();
 fireEvent.change(location,{target:{value:'second'}});expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('');await scan();
 expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('1');
 fireEvent.change(location,{target:{value:'first'}});expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('2');
 expect((screen.getByLabelText('Catatan') as HTMLTextAreaElement).value).toBe('Dihitung ulang di rak pertama');
 await scan('OTHER');expect(screen.getByRole('alert').textContent).toMatch(/Simpan hasil/);expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('2');
});
test('a failed initial lookup can be retried and counted once',async()=>{
 show({...product,locations:[product.locations[0]]});let fail=true;
 vi.stubGlobal('fetch',async()=>{if(fail){fail=false;throw new TypeError('network');}return Response.json({...product,locations:[product.locations[0]]});});
 fireEvent.change(screen.getByLabelText('Kode manual'),{target:{value:'COUNT'}});fireEvent.click(screen.getByRole('button',{name:'Kirim kode'}));
 fireEvent.click(await screen.findByRole('button',{name:'Coba ulang scan'}));
 await waitFor(()=>expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('1'));
});
test('counting cannot exceed safe numeric bounds or silently accept an invalid manual count',async()=>{
 show({...product,locations:[product.locations[0]]});await scan();const quantity=screen.getByLabelText('Jumlah fisik');
 fireEvent.change(quantity,{target:{value:String(Number.MAX_SAFE_INTEGER)}});await scan();expect(screen.getByRole('alert').textContent).toMatch(/Jumlah fisik/);expect((quantity as HTMLInputElement).value).toBe(String(Number.MAX_SAFE_INTEGER));
 fireEvent.change(quantity,{target:{value:'1.5'}});await scan();expect((quantity as HTMLInputElement).value).toBe('1.5');expect(screen.getByRole('alert').textContent).toMatch(/Jumlah fisik/);
});
test('scans during saving cannot add units that would be cleared by the pending save',async()=>{
 show({...product,locations:[product.locations[0]]});await scan();let complete!:(response:Response)=>void;
 vi.stubGlobal('fetch',async()=>new Promise<Response>(resolve=>{complete=resolve;}));
 fireEvent.submit(screen.getByRole('form',{name:'Opname hasil scan COUNT Rak 1 A'}));
 await scan();expect(screen.getByRole('alert').textContent).toMatch(/Tunggu penyimpanan/);expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('1');
 complete(Response.json({id:'saved'}));await waitFor(()=>expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe(''));
 await scan();expect((screen.getByLabelText('Jumlah fisik') as HTMLInputElement).value).toBe('1');
});
