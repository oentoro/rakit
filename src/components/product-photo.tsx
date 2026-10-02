"use client";
import { useId,useRef } from 'react';
import { Package,ZoomIn,X } from 'lucide-react';
import { Button } from './ui/button';
export function ProductPhoto({fileId,name,sku}:{fileId:string|null;name:string;sku:string}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 if(!fileId)return <div className="picking-photo"><Package className="size-9"/></div>;
 const src=`/api/files/${fileId}`;
 return <><button type="button" className="picking-photo photo-trigger" aria-label={`Perbesar foto ${name}`} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}><img src={src} alt={name}/><ZoomIn className="photo-zoom-icon size-4" aria-hidden="true"/></button><dialog ref={dialog} aria-labelledby={titleId} className="photo-preview" onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}><div className="photo-preview-content"><div className="flex items-start justify-between gap-4 p-4"><div><h2 id={titleId} className="font-semibold">{name}</h2><p className="mt-1 font-mono text-sm text-muted-foreground">{sku}</p></div><Button variant="outline" size="icon" aria-label="Tutup foto" onClick={()=>dialog.current?.close()}><X/></Button></div><img src={src} alt={name} className="photo-preview-image"/><p className="p-4 text-sm text-muted-foreground">Cocokkan bentuk, warna, dan detail barang sebelum packing.</p></div></dialog></>;
}
