import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { migrateRacks,migrateInventory } from './migrations';
const cache = globalThis as typeof globalThis & { warehouseDb?: {path:string;db:DatabaseSync} };
export function openDatabase(path:string):DatabaseSync {
  if(path!==':memory:') mkdirSync(dirname(resolve(path)),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(readFileSync(resolve('src/lib/schema.sql'),'utf8'));
  migrateRacks(db);
  migrateInventory(db);
  return db;
}
export function getDatabase():DatabaseSync {
  const path=process.env.DATABASE_PATH || resolve('data/warehouse.sqlite');
  if(cache.warehouseDb?.path!==path) {cache.warehouseDb?.db.close();cache.warehouseDb={path,db:openDatabase(path)};}
  return cache.warehouseDb.db;
}
export function inTransaction<T>(fn:()=>T):T {
  const db=getDatabase();db.exec('BEGIN IMMEDIATE');
  try { const result=fn();db.exec('COMMIT');return result;} catch(error) {db.exec('ROLLBACK');throw error;}
}
