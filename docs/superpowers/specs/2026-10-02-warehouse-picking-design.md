# Spesifikasi aplikasi picking gudang

Tanggal: 2026-10-02

## Tujuan dan ruang lingkup

Aplikasi web berbahasa Indonesia dengan UI shadcn/ui untuk satu gudang berisi empat rak. Setiap rak memiliki enam ambalan A–F. Admin memasukkan order; staff mengambil barang, mencetak resi, melakukan packing, dan menyelesaikan order melalui scan airway bill. Pengguna menyetujui alur dan aturan satu scan QR barang = satu unit.

Versi pertama mencakup autentikasi, dua peran, master barang dan lokasi, input order manual, ekstraksi PDF melalui API AI, picking dengan QR SKU, pencetakan PDF resi, dan penyelesaian packing dengan barcode resi. Pengelolaan stok, integrasi marketplace/kurir, pembuatan airway bill, multi-gudang, dan pengiriman otomatis tidak termasuk.

## Arsitektur

Satu aplikasi web dengan database relasional bersama. UI menggunakan shadcn/ui. Server menangani autentikasi, otorisasi, penyimpanan PDF/foto, permintaan AI, dan seluruh perubahan status. Browser tidak menerima API key AI. Data disimpan permanen; aplikasi bukan demo berbasis penyimpanan browser.

Provider AI, model, endpoint, dan kredensial ditetapkan melalui konfigurasi server. Adapter ekstraksi hanya mengirim dokumen dan meminta keluaran terstruktur yang dibutuhkan. Kegagalan konfigurasi, timeout, atau respons tidak valid tidak menghalangi input manual. Tidak ada retry otomatis yang menyebabkan order ganda.

## Peran

- Admin mengelola akun staff, barang, foto, lokasi, dan order; memeriksa hasil AI; memperbaiki order; serta dapat menjalankan alur staff.
- Staff melihat antrean dan detail order, mengambil pekerjaan, scan barang, mencetak resi, dan scan resi untuk menyelesaikan packing.
- Semua hak akses ditegakkan pada server, termasuk akses file. Staff tidak dapat mengubah akun, master barang, atau isi order melalui permintaan langsung.

## Data

- Pengguna: nama, identitas login, hash password, peran, status aktif.
- Lokasi: rak 1–4 dan ambalan A–F, membentuk 24 lokasi tetap. Beberapa SKU boleh menggunakan lokasi yang sama.
- Barang: SKU unik, nama, foto yang didaftarkan admin per SKU, lokasi rak/ambalan saat ini, status aktif. Foto terkait dengan SKU, bukan lokasi atau order. Admin dapat memindahkan SKU ke salah satu dari 24 lokasi melalui edit barang tanpa mengunggah ulang foto. QR fisik yang sudah ada berisi SKU; aplikasi tidak perlu membuat ulang QR ketika lokasi berubah.
- Order: nomor order unik, airway bill unik bila diisi, sumber manual/PDF, file PDF opsional, status, staff penanggung jawab, dan waktu perubahan status.
- Baris order: referensi barang, SKU/nama saat order dikonfirmasi, qty bilangan bulat positif, jumlah yang sudah diambil. SKU yang berulang digabung menjadi satu baris dengan qty total. Foto dan lokasi yang ditampilkan berasal dari master barang terbaru.
- Catatan aktivitas: order, pelaku, tindakan, waktu, dan SKU untuk scan barang.

Snapshot SKU/nama mempertahankan identitas barang pada order. Lokasi dan foto dibaca dari master barang agar staff mendapat petunjuk terbaru ketika barang dipindahkan. Perubahan lokasi berlaku pada seluruh order yang belum selesai saat detail dimuat ulang; UI menyediakan tombol muat ulang lokasi agar staff dapat memperbarui petunjuk sebelum mengambil barang. Pemindahan tidak mengubah qty, hasil picking, atau status order. Setiap SKU memiliki satu lokasi aktif pada versi pertama. Admin tetap dapat mengubah lokasi barang ketika ada order berjalan, tetapi hanya dapat mengubah isi order sebelum picking dimulai. Order dan barang yang telah digunakan tidak dihapus secara permanen melalui UI; barang dapat dinonaktifkan.

## Input order melalui PDF dan AI

1. Admin upload PDF. Server memvalidasi jenis file dan batas ukuran, lalu menyimpannya dengan akses terautentikasi.
2. AI mengekstrak satu atau beberapa order: nomor order, airway bill, serta baris SKU, nama barang, dan qty. Format marketplace/kurir dapat berbeda; dokumen pindai didukung sejauh provider AI mampu membacanya.
3. Hasil tampil sebagai draf yang dapat diedit. Tidak ada order yang otomatis masuk antrean tanpa konfirmasi admin.
4. Admin memeriksa setiap order. SKU yang tidak dikenal harus dipetakan ke barang yang ada atau didaftarkan terlebih dahulu. Qty harus positif. Nomor order/resi duplikat ditolak; nilai yang hilang harus dilengkapi sebelum konfirmasi.
5. Jika AI gagal, aplikasi menampilkan kegagalan yang jelas dan menyediakan formulir manual dengan PDF tetap tersedia sebagai referensi.

PDF hasil upload digunakan sebagai dokumen resi yang dicetak. Untuk PDF berisi banyak order, admin memilih halaman resi untuk masing-masing order sebelum konfirmasi; pilihan ini disimpan dan pencetakan hanya memuat halaman tersebut. AI boleh menyarankan nomor halaman, tetapi admin memeriksanya.

## Input manual

Formulir manual meminta nomor order dan baris barang beserta qty. Airway bill dan PDF resi dapat ditambahkan saat input atau sebelum packing selesai. Formulir menggunakan validasi yang sama dengan hasil AI dan tidak bergantung pada ketersediaan API AI.

Aplikasi tidak menerbitkan resi kurir. Jika PDF belum tersedia, staff masih dapat picking, tetapi pencetakan resi membutuhkan PDF dan penyelesaian packing membutuhkan airway bill. Admin melengkapi kedua data tersebut tanpa mengubah baris order yang sedang berjalan.

## Picking dan packing

Status: Menunggu → Picking → Packing → Selesai.

1. Staff mengambil order dari antrean. Server menetapkan penanggung jawab secara atomik agar dua staff tidak mengambil order yang sama.
2. Detail menampilkan nomor order, SKU, nama, foto, lokasi rak/ambalan, qty diminta, dan qty diambil. Barang diurutkan berdasarkan rak dan ambalan.
3. Scanner menggunakan kamera HP melalui browser, untuk QR SKU barang maupun barcode airway bill. Aplikasi meminta izin kamera saat staff membuka scanner, mengutamakan kamera belakang, dan menghentikan kamera ketika scanner ditutup atau halaman ditinggalkan. Akses kamera membutuhkan HTTPS pada lingkungan penggunaan HP. Input ketik tersedia sebagai fallback jika izin ditolak, kamera tidak tersedia, atau kode tidak dapat dibaca.
4. Satu submit scan QR SKU yang valid menambah satu unit. SKU di luar order dan scan yang melebihi qty ditolak tanpa mengubah hitungan. SKU diperlakukan sebagai teks, mempertahankan nol awal dan kapitalisasi; whitespace di awal/akhir dihapus.
5. Setelah kamera membaca satu kode, scanner dijeda sampai server memberikan hasil. Kode yang tetap terlihat pada beberapa frame hanya menghasilkan satu scan. Untuk mengambil unit berikutnya, staff menekan tombol “Scan unit berikutnya”, yang mengaktifkan kamera kembali; kode SKU yang sama boleh dipindai lagi untuk unit fisik berikutnya. Setiap submit mendapat ID permintaan unik; pengiriman ulang permintaan yang sama tidak menggandakan jumlah. Scan berikutnya memakai ID baru dan tetap menambah satu unit. Satu scan menandakan satu unit sesuai tindakan staff; sistem tidak dapat membuktikan bahwa dua unit fisik berbeda telah diambil karena QR berisi SKU yang sama.
6. Setelah seluruh qty terpenuhi, server mengubah status ke Packing. Scan barang tidak dapat menambah qty lagi.
7. Staff mencetak PDF resi order melalui dialog cetak browser, menempelkan resi, dan menyelesaikan packing fisik. Membuka dialog cetak tidak dianggap bukti pencetakan berhasil.
8. Scan airway bill pada order berstatus Packing yang ditugaskan ke staff tersebut mengubah status ke Selesai. Resi salah, resi belum diisi, dan order belum lengkap ditolak. Scan ulang order selesai menampilkan bahwa order telah selesai tanpa menambah aktivitas penyelesaian.

Server memvalidasi status, peran, penanggung jawab, dan jumlah dalam transaksi database. Jumlah tidak boleh melebihi qty meskipun scan dikirim bersamaan. Admin dapat mengalihkan penanggung jawab saat diperlukan dan tindakan itu dicatat.

## Halaman utama

- Login.
- Dashboard/antrean: filter status, pencarian nomor order atau airway bill, ringkasan jumlah order.
- Detail pekerjaan staff: kartu barang dengan foto dan lokasi yang jelas, progres qty, input scan, pesan sukses/gagal, dan cetak resi.
- Admin order: daftar, input manual, upload PDF, pemeriksaan hasil AI, detail dan penugasan.
- Admin barang: SKU, nama, foto, dan pilihan rak/ambalan.
- Admin akun staff.

Layout responsif dengan alur staff diutamakan untuk layar HP; halaman admin nyaman digunakan di komputer maupun tablet. Scanner menampilkan pratinjau kamera, hasil scan terakhir, progres qty, tombol scan berikutnya yang mudah ditekan, dan akses input manual. Pesan scan menggunakan teks dan warna agar tidak bergantung pada warna saja. Label input, navigasi keyboard, dan status loading/error tersedia.

## Penanganan kegagalan

- AI gagal atau hasil tidak lengkap: simpan file, tampilkan alasan yang aman, lanjutkan manual/perbaikan draf.
- Koneksi scan gagal: jangan tampilkan keberhasilan sebelum server mengonfirmasi; retry menggunakan ID permintaan yang sama.
- Foto tidak tersedia: tampilkan placeholder dan SKU/nama/lokasi.
- PDF rusak atau halaman tidak valid: admin harus mengganti file atau memperbaiki pemilihan halaman.
- Staff tanpa penugasan atau akun nonaktif: server menolak mutasi.
- Kredensial tidak ditulis ke log atau respons klien.

## Kriteria penerimaan dan verifikasi

1. Admin dapat mendaftarkan SKU di Rak 1 / Ambalan B dengan foto dan membuat order manual.
2. PDF dengan format berbeda dapat dikirim ke provider AI; hasil terstruktur dapat diperiksa dan diperbaiki, termasuk pilihan halaman resi.
3. API AI yang gagal tidak menghalangi pembuatan order manual.
4. Staff melihat foto dan lokasi yang sesuai; tidak dapat mengubah barang atau order melalui UI maupun endpoint.
5. Order qty dua membutuhkan dua scan SKU; SKU salah dan scan ketiga ditolak.
6. Pengiriman ulang request scan tidak menggandakan hitungan; scan bersamaan tidak melampaui qty.
7. Dua staff tidak dapat mengambil order yang sama secara bersamaan.
8. Packing baru tersedia setelah seluruh qty terpenuhi. PDF resi yang sesuai dapat dicetak.
9. Resi yang salah atau status belum Packing tidak dapat menyelesaikan order. Resi benar menyimpan pelaku dan waktu selesai; scan ulang aman.
10. Data tetap tersedia setelah aplikasi dimulai ulang.
11. Kamera HP dapat membaca QR SKU dan barcode resi pada perangkat target melalui HTTPS. Kode yang tetap terlihat tidak menambah hitungan berulang; tombol scan berikutnya memungkinkan mengambil unit berikutnya dengan SKU yang sama. Penolakan izin kamera menyediakan fallback manual, dan kamera berhenti ketika scanner ditutup.
12. Admin dapat memindahkan SKU dari Rak 1 / Ambalan B ke Rak 4 / Ambalan F. Foto tetap terkait dengan SKU; order yang belum selesai menampilkan lokasi baru setelah detail dimuat ulang, tanpa mengubah qty atau progres picking. Staff tidak dapat mengubah lokasi.

Verifikasi implementasi mencakup pengujian integrasi otorisasi, validasi order, transisi status, scan dan konkurensi, ekstraksi AI dengan respons simulasi sukses/gagal, serta pemeriksaan alur UI dari input order hingga selesai. Scanner diuji terhadap QR SKU dan barcode resi, frame berulang, izin kamera ditolak, serta penutupan kamera. Pengujian perangkat nyata membutuhkan HP dan contoh kode/resi pengguna; uji AI nyata membutuhkan konfigurasi provider dan contoh PDF pengguna. Bila belum tersedia, batas verifikasi tersebut dilaporkan secara eksplisit.
