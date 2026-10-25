# JASTIPER — Cloudflare Pages + Functions + D1

Project baru yang berdiri sendiri. Tidak memakai Supabase, framework berbayar, atau layanan berbayar. Deploy memakai Cloudflare Pages, Pages Functions, dan D1 Free sesuai kuota yang berlaku.

## Fitur
- Katalog publik, pencarian, kategori, detail produk
- Keranjang di browser dan checkout
- Stok dikurangi secara atomik saat order dibuat
- Pelacakan dengan nomor order + nomor WhatsApp, atau tracking code
- Login admin berbasis password, sesi server tersimpan di D1
- CRUD produk dan kategori dasar, pengelolaan status order, verifikasi pembayaran manual
- URL gambar eksternal (tidak upload file)
- Semua data bisnis disimpan di D1

## Struktur
- `public/` — frontend statis
- `functions/api/` — API Pages Functions
- `migrations/0001_init.sql` — skema D1
- `wrangler.toml` — binding D1
- `.dev.vars.example` — contoh variabel lokal (jangan commit `.dev.vars`)

## Deploy dari GitHub
1. Buat repository GitHub BARU, misalnya `jastiper-cloudflare`. Jangan gunakan repository project lama.
2. Upload semua isi folder ini ke root repository.
3. Di Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
4. Pilih repository baru. Build command kosong; Build output directory: `public`.
5. Setelah Pages project dibuat, buka Settings → Functions → D1 database bindings dan tambahkan:
   - Variable name: `DB`
   - D1 database: database baru bernama `jastiper-db`
6. Buat D1 database baru melalui Workers & Pages → D1 → Create database. Lalu jalankan migration:
   - Cara Dashboard: D1 → database `jastiper-db` → Console → jalankan isi `migrations/0001_init.sql`.
   - Atau CLI dari komputer: `npx wrangler d1 create jastiper-db`, update `database_id` di `wrangler.toml`, lalu `npx wrangler d1 migrations apply jastiper-db --remote`.
7. **Jangan jalankan SQL ke database/project lama.** Gunakan database baru khusus JASTIPER.
8. Di Cloudflare Pages project → Settings → Variables and Secrets, tambahkan secret:
   - `ADMIN_PASSWORD` = password admin panjang dan unik (minimal 16 karakter)
   - `SESSION_SECRET` = nilai acak panjang (minimal 32 karakter)
   - `SITE_ORIGIN` = URL Pages penuh, misalnya `https://jastiper.pages.dev`
   - `STORE_NAME` = `JASTIPER`
   Secrets bisa disetel tanpa mengaktifkan paket berbayar. Jangan simpan secret di GitHub.
9. Redeploy Pages setelah menambahkan binding dan secrets.
10. Buka `/api/health`. Hasil seharusnya `{"ok":true,...}`. Buka `/admin.html` untuk login.

## Membuat secret acak
Di terminal Mac/Linux:
- `openssl rand -hex 32`
Jalankan dua kali untuk menghasilkan `ADMIN_PASSWORD` dan `SESSION_SECRET` (untuk password admin, boleh gunakan password manager untuk membuat password yang bisa disimpan).

## Pengembangan lokal
1. Install Node.js LTS.
2. `npm install`
3. Salin `.dev.vars.example` menjadi `.dev.vars`, lalu isi nilai sendiri.
4. Buat database lokal/migrasi: `npx wrangler d1 migrations apply jastiper-db --local`
5. `npm run dev`
Jangan pernah commit `.dev.vars`.

## Catatan keamanan penting
- Password admin tunggal diatur melalui secret Cloudflare; tidak ada endpoint pendaftaran admin publik.
- Sesi disimpan di D1 dan cookie `HttpOnly`, `Secure` pada HTTPS, `SameSite=Strict`.
- Endpoint yang mengubah data membutuhkan sesi admin, token CSRF, dan pemeriksaan Origin.
- Endpoint checkout menghitung harga dari database, bukan harga yang dikirim browser, memvalidasi stok, mengunci/mengurangi stok dalam transaksi D1, dan menyimpan snapshot nama/harga.
- Tracking memerlukan nomor order dan nomor telepon normalisasi atau tracking code. Jangan bagikan tracking code ke publik.
- Foto hanya menerima URL HTTPS; sebaiknya gunakan host gambar tepercaya.
- Pembayaran masih manual. Jangan tandai pembayaran diverifikasi sebelum dana benar-benar diterima.
- Kuota gratis bisa berubah. Pantau pemakaian di Cloudflare. Jangan mengaktifkan add-on berbayar jika targetnya Rp0.
- Ini starter project yang perlu dites di staging sebelum dipakai menerima transaksi nyata. Untuk volume besar, pertimbangkan monitoring, backup, dan review keamanan independen.
