# Website Stasiun Geofisika Deli Serdang (Vercel)

Satu proyek utuh: website publik (statis) + backend admin (satu folder `admin/`).

```
geofisika-deliserdang/
├─ src/                 Website publik
│  ├─ layout.html       Kerangka halaman
│  ├─ partials/         header.html · footer.html · sidebar.html  (dipakai semua halaman)
│  ├─ pages/            index.html · sejarah.html · buletin.html
│  └─ assets/           site.css (satu CSS untuk semua halaman) · site.js
├─ admin/               SEMUA yang berkaitan dengan admin
│  ├─ ui/index.html     Halaman admin (login, highlight, artikel, ShakeMap & IKM, buletin, akun)
│  └─ server/           handler.js (seluruh API admin) · auth.js · db.js
├─ api/                 Titik masuk Vercel: admin.js (→ admin/server) · public.js (data untuk website)
├─ build.js             Merakit src/ + admin/ui → dist/
└─ vercel.json · package.json · .env.example
```

## Cara deploy ke Vercel
1. Unggah folder ini ke GitHub (repo baru), lalu di vercel.com pilih **Add New → Project → Import** repo tersebut. Biarkan pengaturan build apa adanya (sudah diatur di `vercel.json`).
2. Di proyek Vercel, buka tab **Storage** dan tambahkan:
   - **Neon Postgres** (Marketplace) → mengisi `DATABASE_URL` otomatis.
   - **Blob** → mengisi `BLOB_READ_WRITE_TOKEN` otomatis. Pilih akses **Public**.
3. Di **Settings → Environment Variables** tambahkan:
   - `SESSION_SECRET` = teks acak minimal 32 karakter (wajib).
   - `SETUP_KEY` = kata sandi pembuka untuk membuat akun pertama (disarankan).
4. **Deploy** (atau Redeploy setelah menambah variabel).
5. Buka `https://domain-anda/admin`, buat akun admin pertama. Tabel database dibuat otomatis pada saat itu.

## Cara kerja
- Halaman publik dibuat statis saat build, sehingga cepat dan header/footer/sidebar hanya ada di satu tempat (`src/partials/`).
- Data (highlight, artikel, buletin, ShakeMap, IKM) disimpan di Postgres; file PDF dan gambar di Vercel Blob. Admin mengunggah file langsung dari browser ke Blob, jadi PDF besar (hingga 20 MB) aman.
- Login memakai cookie HttpOnly bertanda tangan; password di-hash dengan scrypt.

## Menjalankan di komputer sendiri
```
npm install
npm i -g vercel
vercel link && vercel env pull .env.local
vercel dev
```
Untuk melihat halaman publik saja: `node build.js`, lalu buka folder `dist/`.

## Mengubah isi
- Menu navbar: `src/partials/header.html` · Footer: `src/partials/footer.html`
- Teks sejarah dan daftar kepala stasiun: `src/pages/sejarah.html`
- Warna dan gaya: `src/assets/site.css`
- Halaman baru: salin `sejarah.html` di `src/pages/`, ubah baris `<!--meta ...-->` di baris pertama.
