# Investor Tracker Rocky Hijab — Admin Panel (Tahap 1)

## Cara Setup

1. **Jalankan SQL schema** — buka Supabase Dashboard project kamu (project yang sama dipakai `aplikasi_admin_only`, ref: `ismjupxoiywttkrekmfg`) → SQL Editor → paste isi `supabase_schema.sql` → Run.
   - Ini akan nambah kolom `is_investor`, `investor_batch_id`, `modal`, `harga_jual`, `persentase_keuntungan_investor` ke tabel `produk` yang sudah ada (AMAN, gak ngerusak data lama).
   - Bikin tabel baru: `investors`, `investment_batches`, `profit_distributions`.

2. **Ganti PIN admin** — buka `app.js`, cari baris:
   ```js
   const ADMIN_PIN = '1234'; // <-- GANTI PIN OWNER DI SINI
   ```
   Ganti ke PIN kamu sendiri sebelum deploy.

3. **Deploy** — upload folder ini (`admin.html`, `app.js`) ke GitHub Pages / hosting statis. Buka `admin.html`.

## File yang Diupdate di `aplikasi_admin_only`

File `js/app.js` di app `aplikasi_admin_only` sudah diupdate (folder `modified_admin_only` di zip ini):
- Halaman **Kelola Produk** sekarang punya toggle "Produk Investor" saat tambah/edit produk.
- Kalau dicentang, muncul field: **Batch Investasi**, **Modal/pcs**, **Harga Jual/pcs**, **Persentase Keuntungan Investor**.
- Tinggal timpa (replace) folder `js/` di `aplikasi_admin_only` kamu dengan yang ada di `modified_admin_only/js/`.
- **Tidak ada perubahan apapun** di `Aplikasi_KASIR_STAF_ROCKY` — kasir tetap jalan seperti biasa.

> Penting: karena "Kelola Produk" butuh daftar Batch Investasi (dropdown), **buat dulu minimal 1 investor + 1 batch** lewat Investor Tracker (`admin.html`) SEBELUM nambah produk investor di `aplikasi_admin_only`.

## Alur Kerja

1. Di **Investor Tracker → tab Investor**: tambah data investor (nama, HP, PIN login investor — dipakai nanti pas panel investor dibikin di tahap 2).
2. Di **Investor Tracker → tab Batch**: buat batch investasi (pilih investor, nama batch, dana yang masuk, status aktif).
3. Di **aplikasi_admin_only → Kelola Produk**: tambah/edit produk, centang "Produk Investor", pilih batch, isi modal & harga jual per pcs.
4. Kasir jualan seperti biasa (produk investor otomatis punya harga jual sendiri, dan berdasarkan aturan bisnis kamu, tidak dicampur dengan produk default dalam 1 transaksi).
5. Di **Investor Tracker → Dashboard**: klik **"Hitung"** untuk sinkron & hitung omzet, modal, profit bersih, dan bagian investor per batch (baca langsung dari tabel `transactions` di Supabase, parsing baris produk di `note`).
6. Kalau ada transaksi yang "harga_jual di sistem × qty" tidak cocok sama `amount` transaksi asli, sistem kasih flag "perlu dicek manual" — biasanya karena harga_jual baru diupdate belakangan sementara transaksi lama pakai harga lama.
7. Klik **"Cairkan Bagi Hasil"** di batch yang mau dibayar → tercatat di tab **Pencairan** → setelah transfer beneran, klik **"Tandai Sudah Dicairkan"**.

## Belum Termasuk (Tahap 2 — nanti)

- **Panel Investor** (read-only, login pakai PIN per investor yang sudah disiapkan di tabel `investors`) — investor bisa pantau batch, omzet, dan riwayat pencairan miliknya sendiri.
- Export laporan / cetak struk bagi hasil.

## Catatan Teknis

- Backend 100% Supabase (project sama dengan `aplikasi_admin_only`), gak ada Firebase di app ini.
- Perhitungan omzet per produk investor pakai `harga_jual` yang diisi manual di Kelola Produk (bukan dari `amount` transaksi mentah), supaya akurat walau 1 transaksi berisi beberapa produk investor sekaligus.
- Deteksi "transaksi ini investor atau bukan" pakai aturan: kalau baris pertama di `note` transaksi cocok nama produk investor, seluruh transaksi dianggap transaksi investor (sesuai aturan bisnis: produk investor gak pernah dicampur produk default dalam 1 struk).
