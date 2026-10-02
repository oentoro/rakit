import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { getDatabase } from './db';
import { assertActiveActor } from './auth';
import { fail } from './errors';
import type { Actor } from './types';
export type StoredFile={id:string;owner_id:string;kind:'photo'|'pdf';name:string;mime_type:string;path:string;page_count:number|null};
export function getFile(id:string,kind?:'photo'|'pdf'):StoredFile {
  const file=getDatabase().prepare('SELECT * FROM files WHERE id=?').get(id) as StoredFile|undefined;
  if(!file||kind&&file.kind!==kind) fail(422,'File tidak ditemukan atau jenis file tidak sesuai.');return file;
}
export async function storeUpload(actor:Actor,file:File,kind:'photo'|'pdf'):Promise<{id:string;pageCount:number|null}> {
  assertActiveActor(actor,['admin']);
  const max=(kind==='pdf'?15:5)*1024*1024;
  if(!file.size||file.size>max) fail(422,`Ukuran file maksimal ${kind==='pdf'?15:5} MB dan tidak boleh kosong.`);
  const bytes=Buffer.from(await file.arrayBuffer());let mimeType:string;let pageCount:number|null=null;
  if(kind==='pdf') {
    if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) fail(422,'File harus berupa PDF valid.');
    try {pageCount=(await PDFDocument.load(bytes)).getPageCount();} catch {fail(422,'PDF rusak atau dilindungi password.');}
    if(!pageCount) fail(422,'PDF tidak memiliki halaman.');mimeType='application/pdf';
  } else {
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mimeType='image/png';
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) mimeType='image/jpeg';
    else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP') mimeType='image/webp';
    else fail(422,'Foto harus berformat PNG, JPEG, atau WebP.');
    if(file.type!==mimeType) fail(422,'Isi foto tidak sesuai dengan jenis file.');
  }
  const dir=resolve(process.env.UPLOAD_DIR||'data/uploads');mkdirSync(dir,{recursive:true});const id=randomUUID();const path=resolve(dir,id);writeFileSync(path,bytes,{flag:'wx'});
  getDatabase().prepare('INSERT INTO files(id,owner_id,kind,name,mime_type,path,page_count,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,actor.id,kind,file.name.slice(0,200),mimeType,path,pageCount,Date.now());
  return {id,pageCount};
}
export function readAuthorizedFile(actor:Actor,id:string):{bytes:Uint8Array;mimeType:string;name:string} {
  const current=assertActiveActor(actor);const file=getFile(id);const db=getDatabase();
  if(current.role!=='admin') {
    const linked=file.kind==='photo'?db.prepare('SELECT id FROM products WHERE photo_file_id=?').get(id):db.prepare('SELECT id FROM orders WHERE pdf_file_id=?').get(id);
    if(!linked) fail(403,'File belum terkait dengan barang atau order.');
  }
  return {bytes:readFileSync(file.path),mimeType:file.mime_type,name:file.name};
}
