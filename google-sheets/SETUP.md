# Integrasi Google Sheets JASTIPER

File ini menambahkan sinkronisasi checkout ke spreadsheet Google. Checkout tetap disimpan ke D1 terlebih dahulu. Jika Sheets gagal dihubungi, pesanan tetap berhasil di JASTIPER; respons checkout akan menandai `sheets_sync: "pending"` untuk diagnosis.

## A. Buat spreadsheet otomatis

1. Login ke akun Google yang akan memiliki spreadsheet.
2. Buka https://script.google.com/ lalu buat **New project**.
3. Ganti isi `Code.gs` dengan isi file `Code.gs` dari folder ini.
4. Buka **Project Settings** (ikon roda gigi) → **Script properties** → Add script property:
   - Property: `WEBHOOK_SECRET`
   - Value: buat token acak panjang (minimal 32 karakter). Jangan bagikan token ini.
5. Pilih fungsi `setup` di toolbar lalu klik **Run**. Berikan izin Google Sheets ketika diminta.
6. Buka **Execution log** untuk melihat URL spreadsheet yang dibuat. Spreadsheet memiliki tab `Pesanan`, `Detail Barang`, dan `Rekap Kategori`.

## B. Deploy endpoint Apps Script

1. Klik **Deploy** → **New deployment**.
2. Pilih tipe **Web app**.
3. **Execute as:** Me.
4. **Who has access:** Anyone. Endpoint tetap memvalidasi `WEBHOOK_SECRET`; rahasiakan URL dan token.
5. Klik Deploy dan salin URL Web app yang berakhiran `/exec`.

## C. Hubungkan ke Cloudflare Pages

Di project Cloudflare Pages `jastiper`, buka **Settings → Variables and Secrets** (atau gunakan Wrangler). Tambahkan sebagai **Secrets**, bukan vars biasa:

- `SHEETS_WEBHOOK_URL` = URL Web app `/exec`
- `SHEETS_WEBHOOK_SECRET` = nilai yang sama persis dengan `WEBHOOK_SECRET` di Script Properties

Pertahankan binding D1 `DB` yang sudah ada dan `SITE_ORIGIN` milik project aktif. Jangan membuat database baru.

## D. Deploy perubahan JASTIPER

Gunakan file backend yang sudah diperbarui dari ZIP ini, tetapi pastikan dahulu bahwa konfigurasi D1 mengarah ke database yang benar-benar dipakai project production. Jangan jalankan migrasi ulang terhadap database production tanpa memeriksa tabel yang sudah ada. Setelah deploy, lakukan satu order percobaan kecil dan periksa ketiga tab Sheets.

## Struktur sheet

- `Pesanan`: satu baris per nomor order.
- `Detail Barang`: satu baris per item dalam order.
- `Rekap Kategori`: ringkasan per kategori untuk tiap nomor order.

Apps Script mencegah nomor order yang sama ditambahkan dua kali bila permintaan yang sama diterima ulang. Jika respons `sheets_sync` menunjukkan `pending`, order tetap ada di D1 tetapi perlu diperiksa/sinkronkan ulang; versi ini belum menambahkan antrean retry otomatis di D1.
