import Link from 'next/link';
import type { ProductPage } from '@/lib/types';
export function ProductPagination({result,basePath,search='',rack=null}:{result:Omit<ProductPage,'products'>;basePath:string;search?:string;rack?:number|null}){
 const {page,pageSize,total,totalPages}=result;
 if(!total)return null;
 function href(number:number){const query=new URLSearchParams();if(search)query.set('search',search);if(rack)query.set('rack',String(rack));query.set('page',String(number));return `${basePath}?${query}`;}
 return <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4"><p className="text-xs text-muted-foreground">Menampilkan {(page-1)*pageSize+1}–{Math.min(page*pageSize,total)} dari {total} produk</p><nav aria-label="Pagination produk" className="flex flex-wrap items-center gap-3">{page>1?<Link href={href(page-1)} prefetch={false} className="action-link secondary">Sebelumnya</Link>:<span aria-disabled="true" className="text-xs text-muted-foreground">Sebelumnya</span>}<span className="text-xs">Halaman {page} dari {totalPages}</span>{page<totalPages?<Link href={href(page+1)} prefetch={false} className="action-link secondary">Berikutnya</Link>:<span aria-disabled="true" className="text-xs text-muted-foreground">Berikutnya</span>}</nav></div>;
}
