// @vitest-environment jsdom
import React from 'react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { fireEvent,render,screen,waitFor,cleanup } from '@testing-library/react';
import { CameraScanner } from '../src/components/camera-scanner';
const camera=vi.hoisted(()=>({callback:undefined as undefined|((result:{getText:()=>string})=>void),stop:vi.fn(),reject:false,defer:false,attachments:[] as MediaStream[],resolve:undefined as undefined|((stream:MediaStream)=>void)}));
vi.mock('@zxing/browser',()=>({BrowserMultiFormatReader:class{
 async decodeFromConstraints(constraints:MediaStreamConstraints,video:HTMLVideoElement,callback:typeof camera.callback){return this.decodeFromStream(await navigator.mediaDevices.getUserMedia(constraints),video,callback);}
 async decodeFromStream(stream:MediaStream,video:HTMLVideoElement,callback:typeof camera.callback){camera.attachments.push(stream);video.srcObject=stream;camera.callback=callback;return {stop:()=>{camera.stop();stream.getTracks().forEach(t=>t.stop());video.srcObject=null;}};}
}}));
beforeEach(()=>Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{if(camera.reject)throw new DOMException('Denied','NotAllowedError');if(camera.defer)return new Promise<MediaStream>(resolve=>{camera.resolve=resolve;});return {getTracks:()=>[{stop:vi.fn()}]} as unknown as MediaStream;}}}));
afterEach(()=>{cleanup();sessionStorage.clear();camera.callback=undefined;camera.stop.mockClear();camera.reject=false;camera.defer=false;camera.resolve=undefined;camera.attachments=[];});
test('consecutive frames count once; explicit rearm accepts same SKU as next unit',async()=>{
 let units=0;render(<CameraScanner kind="sku" onScan={async()=>{units++;return {message:`${units} unit diambil`};}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Aktifkan kamera'}));await waitFor(()=>expect(camera.callback).toBeDefined());
 camera.callback!({getText:()=> '001A'});camera.callback!({getText:()=> '001A'});
 await screen.findByText('1 unit diambil');expect(units).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'Scan unit berikutnya'}));camera.callback!({getText:()=> '001A'});await screen.findByText('2 unit diambil');expect(units).toBe(2);
});
test('camera denial keeps manual scan available and close stops scanner',async()=>{
 camera.reject=true;const {unmount}=render(<CameraScanner kind="airwayBill" onScan={async()=>({message:'Selesai'})}/>);
 fireEvent.click(screen.getByRole('button',{name:'Aktifkan kamera'}));await screen.findByText(/Izin kamera ditolak/);
 expect(screen.getByLabelText('Kode manual')).toBeTruthy();unmount();
 camera.reject=false;render(<CameraScanner kind="sku" onScan={async()=>({message:'OK'})}/>);fireEvent.click(screen.getByRole('button',{name:'Aktifkan kamera'}));await waitFor(()=>expect(camera.callback).toBeDefined());cleanup();expect(camera.stop).toHaveBeenCalled();
});
test('uncertain network retry retains request identity and recovers after remount',async()=>{
 const ids:string[]=[];let first=true;
 const onScan=async(_code:string,id:string)=>{ids.push(id);if(first){first=false;throw new TypeError('Network');}return {message:'Tersimpan'};};
 const view=render(<CameraScanner kind="sku" storageKey="order-test" onScan={onScan}/>);
 fireEvent.change(screen.getByLabelText('Kode manual'),{target:{value:'001A'}});fireEvent.click(screen.getByRole('button',{name:'Kirim kode'}));await screen.findByRole('button',{name:'Coba ulang scan'});
 view.unmount();render(<CameraScanner kind="sku" storageKey="order-test" onScan={onScan}/>);fireEvent.click(screen.getByRole('button',{name:'Coba ulang scan'}));await screen.findByText('Tersimpan');expect(ids[0]).toBe(ids[1]);
});

test('late camera permission after close never attaches stale stream or clears a reopened preview',async()=>{
 camera.defer=true;render(<CameraScanner kind="sku" onScan={async()=>({message:'OK'})}/>);fireEvent.click(screen.getByRole('button',{name:'Aktifkan kamera'}));await waitFor(()=>expect(camera.resolve).toBeDefined());const resolveOld=camera.resolve!;
 fireEvent.click(screen.getByRole('button',{name:'Tutup kamera'}));camera.defer=false;fireEvent.click(screen.getByRole('button',{name:'Aktifkan kamera'}));await waitFor(()=>expect(camera.callback).toBeDefined());const newStream=camera.attachments[0];
 const stop=vi.fn();const oldStream={getTracks:()=>[{stop}]} as unknown as MediaStream;resolveOld(oldStream);await waitFor(()=>expect(stop).toHaveBeenCalled());expect(camera.attachments).not.toContain(oldStream);expect((screen.getByLabelText('Pratinjau kamera') as HTMLVideoElement).srcObject).toBe(newStream);
});
