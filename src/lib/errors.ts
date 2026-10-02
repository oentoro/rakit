export class DomainError extends Error { constructor(public status:number, message:string) {super(message);} }
export function fail(status:number,message:string):never {throw new DomainError(status,message);}
export function databaseError(error:unknown):never {
  if(error instanceof Error && /UNIQUE constraint/.test(error.message)) fail(409,'Data sudah terdaftar. Periksa SKU, nomor order, atau resi duplikat.');
  throw error;
}
