# Rakit — picking dan packing gudang

Aplikasi web berbahasa Indonesia dengan shadcn/ui, untuk satu gudang dengan rak dan jumlah ambalan yang dapat diatur admin. Konfigurasi awal: 4 rak, masing-masing 6 ambalan (A–F). Data disimpan di SQLite dan file privat di disk server.

## Menjalankan aplikasi

Gunakan Node.js 24 atau lebih baru (implementasi diverifikasi pada Node 26). Dari folder proyek:

```sh
npm install
cp .env.example .env.local
npm run admin:create
npm run dev
```

Perintah `admin:create` meminta nama, username, dan password awal. Password minimal 10 karakter. Tidak ada akun atau password bawaan. Buka http://localhost:3000 lalu login dengan akun yang Anda buat. Admin mendaftarkan SKU/foto/lokasi, membuat staff, dan memasukkan order.

Produksi:

```sh
npm run build
npm start
```

Next.js menjalankan backend dan frontend bersama. Script CLI memuat `.env.local`; Next.js memuatnya otomatis. Dependensi dikunci di `package-lock.json`; gunakan `npm ci` untuk instalasi berulang yang sama.

## Konfigurasi

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_PATH` | File SQLite permanen, default `./data/warehouse.sqlite` |
| `UPLOAD_DIR` | Direktori privat PDF/foto, default `./data/uploads` |
| `APP_ORIGIN` | Origin aplikasi persis tanpa slash akhir, misalnya `https://gudang.example.com` |
| `COOKIE_SECURE` | `true` saat menggunakan HTTPS; default `false` untuk localhost |
| `GEMINI_API_KEY` | API key Gemini di server, tidak dikirim ke browser |
| `GEMINI_MODEL` | ID model aktif yang mendukung PDF dan structured output |

Untuk membaca PDF dengan AI, isi `GEMINI_API_KEY` dan `GEMINI_MODEL`, lalu mulai ulang server. Pilih model yang tersedia pada akun Anda melalui [dokumentasi Gemini](https://ai.google.dev/gemini-api/docs/document-processing) dan [structured output](https://ai.google.dev/gemini-api/docs/structured-output). API request dilakukan melalui REST dari server dengan timeout 60 detik. PDF upload akan dikirim ke Gemini hanya saat admin menekan tombol pembacaan AI. Tanpa konfigurasi, seluruh input manual, picking, packing, dan scan tetap berjalan.

## Alur kerja

1. Admin mendaftarkan SKU, nama, foto, rak 1–4, dan ambalan A–F. Beberapa SKU boleh berada di satu lokasi. Satu SKU memiliki satu lokasi aktif.
2. Admin membuat order manual atau upload PDF. Hasil AI adalah draf: admin memeriksa nomor order/resi, memetakan SKU, mengoreksi qty, dan memilih halaman resi sebelum menyimpan. Satu PDF dapat berisi beberapa order.
3. Saat pembacaan AI gagal, PDF tetap tersedia untuk diisi secara manual. Resi/PDF boleh dilengkapi kemudian pada order manual.
4. Staff mengambil order yang menunggu. Penugasan mencegah dua staff mengambil order yang sama.
5. Staff melihat foto dan lokasi, memilih rak/ambalan asal bila SKU memiliki beberapa lokasi, mengambil satu unit, lalu scan QR berisi SKU. Unit yang diambil dicadangkan agar order lain tidak menggunakan stok yang sama. Kode salah dan qty berlebih ditolak. Setelah scan, tekan **Scan unit berikutnya** untuk rearm kamera. QR yang terus terlihat tidak dihitung berulang.
6. Seluruh qty lengkap mengubah status menjadi Packing. Buka/cetak PDF resi, tempelkan pada paket, lalu scan barcode airway bill untuk menyelesaikan. Quantity stok setiap lokasi asal baru dikurangi pada tahap ini, dalam transaksi yang sama.
7. Server mencatat pelaku/waktu dan aktivitas. Admin bisa mengalihkan penanggung jawab. Perubahan lokasi SKU ditampilkan setelah staff memuat ulang lokasi, tanpa mengubah progres.

Foto terkait dengan SKU, bukan order/rak. Gambar tersedia lewat endpoint terautentikasi. PDF maksimal 15 MB; foto JPEG/PNG/WebP maksimal 5 MB. Nomor order, airway bill, dan SKU unik; nol awal dan kapitalisasi kode dipertahankan.

## Daftar produk

Admin dan staff dapat membuka **Daftar produk** untuk mencari SKU atau nama barang, melihat lokasi rak/ambalan, dan status aktif. Ketuk foto untuk melihat gambar besar beserta nama dan SKU guna mencocokkan barang. Pengelolaan produk tetap dilakukan admin melalui **Barang & lokasi**.

## Quantity dan beberapa lokasi per SKU

Pada **Barang & lokasi**, admin mengisi quantity fisik untuk setiap rak/ambalan. Gunakan **Tambah lokasi** untuk menyimpan SKU yang sama di beberapa tempat. SKU, nama, foto, dan QR tetap satu; setiap lokasi memiliki quantity sendiri. Daftar produk menampilkan quantity per lokasi, total, serta jumlah tersedia dan dicadangkan.

**Scan SKU** mencatat satu unit dari lokasi asal dan mencadangkannya; quantity belum berkurang. Untuk SKU dengan beberapa lokasi, staff memilih lokasi pengambilan sebelum scan. **Scan resi untuk menyelesaikan packing** mengurangi quantity sesuai jumlah unit yang diambil dari setiap lokasi dan melepas cadangan. Retry scan atau pemindaian resi ulang tidak mengurangi stok dua kali. Order menunggu belum mencadangkan stok; ketersediaan diperiksa per unit saat picking.

Admin dapat mengoreksi quantity, tetapi tidak boleh menguranginya di bawah jumlah yang dicadangkan. Lokasi yang sedang digunakan picking tidak dapat dipindahkan/dihapus sampai packing selesai. Formulir admin yang memakai quantity lama akan ditolak jika stok sudah berubah; muat ulang sebelum mengedit kembali. Penyesuaian stok oleh admin harus mengikuti stok fisik, termasuk unit yang sudah dipicking dan belum selesai packing.

Migrasi otomatis mempertahankan lokasi lama, foto, order, dan progres picking. **Quantity barang lama ditandai belum diisi**, karena aplikasi sebelumnya tidak mencatat stok. Admin perlu mengisi quantity fisik per lokasi sebelum scan berikutnya atau menyelesaikan packing order lama. Unit yang telah dipicking pada order lama yang belum selesai ikut dicadangkan di lokasi lama; order yang sudah selesai tidak dipotong kembali.

## Pengaturan rak

Buka **Barang & lokasi → Kelola rak** untuk menambah rak atau mengedit nama dan jumlah ambalan (1–1000). Label ambalan dibuat otomatis: A–Z, lalu AA, AB, dan seterusnya. Pilihan lokasi barang dan ringkasan gudang mengikuti konfigurasi terbaru.

Pengurangan ambalan ditolak apabila ambalan yang akan dihapus masih ditempati SKU, termasuk SKU nonaktif. Pindahkan lokasi SKU terlebih dahulu, lalu simpan jumlah ambalan baru. Nama rak dapat diganti tanpa mengubah QR SKU atau progres order. Staff melihat perubahan setelah memuat ulang lokasi.

## Kamera HP dan cetak resi

Kamera berjalan langsung di browser HP dengan izin kamera dan mengutamakan kamera belakang. Gunakan **HTTPS** untuk akses lewat HP; HTTP alamat IP LAN tidak memberikan akses kamera. HTTP `localhost` hanya untuk browser pada mesin yang menjalankan server. Decoder mendukung QR dan sejumlah barcode umum; perlu uji airway bill aktual untuk memastikan formatnya terbaca.

Pasang reverse proxy HTTPS di depan satu server Node, atur `APP_ORIGIN` ke origin HTTPS tersebut dan `COOKIE_SECURE=true`. Buka alamat itu di HP. Saat mengganti domain/port, perbarui origin; server menolak mutasi dari origin lain. Aplikasi tidak memerlukan akses internet pada HP untuk decoding, tetapi membutuhkan koneksi ke server dan koneksi internet server untuk panggilan AI.

**Buka / cetak resi** membuka PDF berisi hanya halaman yang dipilih untuk order tersebut. Gunakan menu cetak atau bagikan PDF browser ke printer yang didukung HP. Browser tidak menjamin dukungan printer thermal langsung; komputer packing dapat membuka order yang sama untuk mencetak. Membuka PDF tidak otomatis menyelesaikan order.

Input kode manual tersedia jika kamera gagal. Jika koneksi putus setelah scan, **Coba ulang scan** menggunakan ID request yang sama agar qty tidak bertambah dua kali. Request yang belum terkonfirmasi disimpan per order di sessionStorage tab dan dipulihkan saat halaman dimuat ulang.

## Data dan deployment

Versi ini memakai satu proses aplikasi dengan SQLite dan upload lokal. Gunakan server/volume permanen; penyimpanan ephemeral/serverless tanpa volume tidak sesuai. Database memakai transaksi, foreign key, WAL, dan batas qty pada database. Ini cocok untuk tim gudang kecil; scale-out membutuhkan database/file storage bersama.

Backup paling sederhana: hentikan server, salin direktori `data/` lengkap (termasuk SQLite dan file WAL/SHM jika ada), lalu mulai kembali. Jika menggunakan path terpisah, salin database dan seluruh `UPLOAD_DIR` bersama. Pulihkan keduanya ke lokasi yang sama karena metadata menyimpan path file absolut. Rahasiakan backup karena berisi order dan sesi login. Jangan menaruh upload di direktori `public/`.

Tidak mencakup pembelian/penerimaan stok otomatis, pembuatan resi kurir, integrasi marketplace, atau multi-gudang. Migrasi rak berjalan otomatis saat aplikasi membuka database. Data SKU, foto, order, dan progres picking lama dipertahankan.

## Data contoh opsional

Jalankan hanya pada database pengembangan, setelah menentukan password sendiri:

```sh
DEMO_PASSWORD='password-contoh-anda' npm run seed:demo
```

Akun `admin.demo` dan `staff.demo` menggunakan password tersebut. Seeder menambahkan SKU-A/SKU-B dan order DEMO-001 tanpa menimpa data yang sudah ada. PDF yang dibuat hanya contoh internal, bukan resi kurir. Untuk order itu, QR SKU berisi `SKU-A`, dua unit, dan resinya `AWB-DEMO-001`. QR fisik produk asli dibuat di luar aplikasi dan harus berisi SKU yang sama persis.

## Verifikasi

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run test:e2e -- --config playwright.production.config.ts
```

Unit/integration tests menggunakan SQLite/file sementara; menguji akses, input, AI dengan HTTP simulasi, transaksi/konkurensi, halaman PDF, dan lifecycle kamera dengan decoder simulasi. E2E menjalankan server sementara di port 3010 dan menggunakan Chrome terpasang pada macOS. Untuk lingkungan lain, atur `PLAYWRIGHT_CHROME` ke path browser Chromium/Chrome. Database E2E selalu terpisah dan key AI dikosongkan agar tes tidak melakukan panggilan berbayar.

E2E kamera memakai decoder asli dengan QR pada video canvas simulasi: frame berulang hanya menghitung satu unit, lalu rearm menghitung unit berikutnya. Konfigurasi produksi menjalankan ketiga alur E2E pada hasil build, termasuk admin dan packing staff. Pengujian kamera HP, barcode resi fisik, printer, dan AI dengan dokumen gudang nyata tetap membutuhkan perangkat, PDF contoh, dan kredensial. Jangan menyamakan pengujian video simulasi dengan verifikasi kamera fisik.

Spesifikasi: [rancangan](docs/superpowers/specs/2026-10-02-warehouse-picking-design.md). Rencana: [implementasi](docs/superpowers/plans/2026-10-02-warehouse-picking.md).
