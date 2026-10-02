import Link from 'next/link';
import { MapPin,Package,Search } from 'lucide-react';
import { pageActor } from '@/lib/server-actor';
import { listProducts } from '@/lib/catalog';
import { ProductPhoto } from '@/components/product-photo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export default async function Products({searchParams}:{searchParams:Promise<{search?:string|string[]}>}){
 const actor=await pageActor(),params=await searchParams;
 const search=(typeof params.search==='string'?params.search:'').trim();
 const products=listProducts(actor).filter(product=>`${product.sku} ${product.name}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className="page-heading"><div><span className="eyebrow">KATALOG GUDANG</span><h1>Daftar produk</h1><p>Cari barang, lihat lokasi, dan ketuk foto untuk mencocokkan detail.</p></div></div><section className="surface"><div className="section-heading"><h2>Barang gudang</h2><span className="subtle-pill">{products.length} produk</span></div><form action="/products" className="flex flex-wrap items-center gap-3 p-4"><Input type="search" name="search" aria-label="Cari SKU atau nama barang" placeholder="Cari SKU atau nama barang…" defaultValue={search} className="min-w-40 flex-1"/><Button type="submit" aria-label="Cari produk"><Search className="size-4"/>Cari</Button>{search&&<Link href="/products" className="text-sm text-emerald-700 underline">Reset pencarian</Link>}</form><div className="divide-y">{products.length?products.map(product=><article key={product.id} className="picking-item"><ProductPhoto fileId={product.photoFileId} name={product.name} sku={product.sku}/><div className="min-w-0 flex-1"><span className="font-mono text-xs text-muted-foreground break-all">{product.sku}</span><h3 className="mt-1 font-semibold break-words">{product.name}</h3><div className="mt-3 flex flex-wrap gap-2"><span className="location-tag"><MapPin className="size-3"/>{product.rackName}</span><span className="location-tag">Ambalan {product.shelf}</span></div><span className={`mt-2 block text-xs ${product.active?'text-emerald-700':'text-muted-foreground'}`}>{product.active?'Aktif':'Nonaktif'}</span></div></article>):<div className="empty-state"><Package/><h3>{search?'Barang tidak ditemukan':'Belum ada produk'}</h3><p>{search?'Coba SKU atau nama barang lainnya.':'Admin dapat mendaftarkan barang melalui Barang & lokasi.'}</p></div>}</div></section></>;
}
