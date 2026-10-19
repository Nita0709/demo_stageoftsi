// Seluruh backend admin dalam SATU fungsi: /api/admin?action=...
import { sql, ensureSchema } from './db.js';
import { hash, verify, sign, readSession, cookie, clearCookie } from './auth.js';
import { del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';

const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
const USER = /^[A-Za-z0-9_]{3,30}$/;
const err = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const ok = (res, d = {}) => res.status(200).json({ ok: true, ...d });
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const blobUrl = v => { v = String(v || ''); return v === '' || BLOB.test(v) ? v : null; };
const rm = async u => { if (u && BLOB.test(u)) { try { await del(u); } catch { /* abaikan */ } } };
const pause = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query.action || '');
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (req.method === 'POST' && !/application\/json/i.test(req.headers['content-type'] || '')) return err(res, 415, 'Content-Type harus JSON.');
    const user = readSession(req);

    // ---------- tanpa login ----------
    if (a === 'status') {
      let hasUser = false;
      try { hasUser = (await sql`select 1 from users limit 1`).length > 0; } catch { /* tabel belum ada */ }
      return ok(res, { hasUser, user });
    }
    if (a === 'setup' && req.method === 'POST') {
      if (process.env.SETUP_KEY && b.key !== process.env.SETUP_KEY) return err(res, 403, 'Kunci setup salah.');
      await ensureSchema();
      if ((await sql`select 1 from users limit 1`).length) return err(res, 403, 'Akun admin sudah ada.');
      const u = str(b.username, 30), p = String(b.password || '');
      if (!USER.test(u)) return err(res, 400, 'Username 3–30 karakter: huruf, angka, atau garis bawah.');
      if (p.length < 8) return err(res, 400, 'Password minimal 8 karakter.');
      await sql`insert into users (username, password_hash) values (${u}, ${hash(p)})`;
      res.setHeader('Set-Cookie', cookie(sign(u)));
      return ok(res, { user: u });
    }
    if (a === 'login' && req.method === 'POST') {
      const rows = await sql`select password_hash from users where username = ${str(b.username, 30)}`;
      if (!rows.length || !verify(String(b.password || ''), rows[0].password_hash)) { await pause(800); return err(res, 401, 'Username atau password salah.'); }
      res.setHeader('Set-Cookie', cookie(sign(str(b.username, 30))));
      return ok(res, { user: str(b.username, 30) });
    }
    if (a === 'logout') { res.setHeader('Set-Cookie', clearCookie()); return ok(res); }

    // ---------- upload file ke Vercel Blob (token dibuat di sini, file langsung dari browser) ----------
    if (a === 'blob') {
      if (b.type !== 'blob.upload-completed' && !user) return err(res, 401, 'Belum login.');
      const out = await handleUpload({
        body: b, request: req,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true,
        }),
        onUploadCompleted: async () => {},
      });
      return res.status(200).json(out);
    }

    // ---------- wajib login ----------
    if (!user) return err(res, 401, 'Belum login.');
    if (a === 'users') return ok(res, { users: (await sql`select username from users order by id`).map(r => r.username) });
    if (req.method !== 'POST') return err(res, 405, 'Metode tidak diizinkan.');

    switch (a) {
      case 'user_add': {
        const u = str(b.username, 30), p = String(b.password || '');
        if (!USER.test(u)) return err(res, 400, 'Username 3–30 karakter: huruf, angka, atau garis bawah.');
        if (p.length < 8) return err(res, 400, 'Password minimal 8 karakter.');
        if ((await sql`select 1 from users where username = ${u}`).length) return err(res, 400, 'Username sudah dipakai.');
        await sql`insert into users (username, password_hash) values (${u}, ${hash(p)})`;
        return ok(res);
      }
      case 'user_pw': {
        const rows = await sql`select password_hash from users where username = ${user}`;
        if (!rows.length || !verify(String(b.old || ''), rows[0].password_hash)) return err(res, 400, 'Password lama salah.');
        if (String(b.new || '').length < 8) return err(res, 400, 'Password baru minimal 8 karakter.');
        await sql`update users set password_hash = ${hash(String(b.new))} where username = ${user}`;
        return ok(res);
      }
      case 'user_del': {
        const u = str(b.username, 30);
        if (u === user) return err(res, 400, 'Tidak bisa menghapus akun yang sedang dipakai.');
        await sql`delete from users where username = ${u}`;
        return ok(res);
      }
      case 'highlight_add': {
        const judul = str(b.judul, 100), gambar = blobUrl(b.gambar);
        if (!judul || !gambar) return err(res, 400, 'Judul dan gambar wajib diisi.');
        if ((await sql`select count(*)::int as n from highlight`)[0].n >= 8) return err(res, 400, 'Maksimal 8 highlight. Hapus salah satu dulu.');
        await sql`insert into highlight (judul, deskripsi, gambar) values (${judul}, ${str(b.deskripsi, 160)}, ${gambar})`;
        return ok(res);
      }
      case 'highlight_del': {
        const r = await sql`delete from highlight where id = ${Number(b.id) || 0} returning gambar`;
        if (r[0]) await rm(r[0].gambar);
        return ok(res);
      }
      case 'artikel_add': {
        const judul = str(b.judul, 150), tautan = str(b.tautan, 500), file = blobUrl(b.file);
        const tgl = /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal || '') ? b.tanggal : new Date().toISOString().slice(0, 10);
        if (!judul || file === null || (!tautan && !file)) return err(res, 400, 'Judul wajib, dan isi tautan atau unggah PDF.');
        if (tautan && !/^https?:\/\//i.test(tautan)) return err(res, 400, 'Tautan harus diawali http:// atau https://');
        await sql`insert into artikel (judul, tanggal, tautan, file) values (${judul}, ${tgl}, ${tautan}, ${file})`;
        return ok(res);
      }
      case 'artikel_del': {
        const r = await sql`delete from artikel where id = ${Number(b.id) || 0} returning file`;
        if (r[0]) await rm(r[0].file);
        return ok(res);
      }
      case 'buletin_save': {
        const y = Number(b.tahun), m = Number(b.bulan), pdf = blobUrl(b.pdf), cover = blobUrl(b.cover);
        if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || pdf === null || cover === null) return err(res, 400, 'Data tidak valid.');
        const old = (await sql`select pdf, cover from buletin where tahun = ${y} and bulan = ${m}`)[0];
        if (!old && !pdf) return err(res, 400, 'File PDF wajib diisi untuk edisi baru.');
        await sql`insert into buletin (tahun, bulan, pdf, cover) values (${y}, ${m}, ${pdf}, ${cover})
          on conflict (tahun, bulan) do update set
            pdf = case when ${pdf}::text <> '' then ${pdf}::text else buletin.pdf end,
            cover = case when ${cover}::text <> '' then ${cover}::text else buletin.cover end`;
        if (old) { if (pdf && old.pdf !== pdf) await rm(old.pdf); if (cover && old.cover !== cover) await rm(old.cover); }
        return ok(res);
      }
      case 'buletin_del': {
        const r = await sql`delete from buletin where id = ${Number(b.id) || 0} returning pdf, cover`;
        if (r[0]) { await rm(r[0].pdf); await rm(r[0].cover); }
        return ok(res);
      }
      case 'gambar_save': {
        const nama = b.nama, path = blobUrl(b.path);
        if (!['shakemap', 'ikm'].includes(nama) || !path) return err(res, 400, 'Data tidak valid.');
        const old = (await sql`select path from gambar_situs where nama = ${nama}`)[0];
        await sql`insert into gambar_situs (nama, path) values (${nama}, ${path}) on conflict (nama) do update set path = excluded.path`;
        if (old && old.path !== path) await rm(old.path);
        return ok(res);
      }
      case 'gambar_del': {
        if (!['shakemap', 'ikm'].includes(b.nama)) return err(res, 400, 'Data tidak valid.');
        const r = await sql`delete from gambar_situs where nama = ${b.nama} returning path`;
        if (r[0]) await rm(r[0].path);
        return ok(res);
      }
      default: return err(res, 404, 'Aksi tidak dikenal.');
    }
  } catch (e) {
    const cfg = String(e.message || '').startsWith('CFG:');
    if (!cfg) console.error(e);
    return err(res, 500, cfg ? e.message.slice(4) : 'Terjadi kesalahan di server.');
  }
}
