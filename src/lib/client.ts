export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export async function api<T=any>(path:string,options?:RequestInit):Promise<T> {
 const response=await fetch(path,{...options,headers:{...(options?.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options?.headers}});
  const data=await response.json();if(!response.ok) throw new ApiError(response.status,data.error||'Permintaan gagal.');return data;
}
export async function upload(file:File,kind:'photo'|'pdf'):Promise<{id:string;pageCount:number|null}> {const form=new FormData();form.set('file',file);form.set('kind',kind);return api('/api/files',{method:'POST',body:form});}
export const statusLabels={waiting:'Menunggu',picking:'Picking',packing:'Packing',completed:'Selesai'};
