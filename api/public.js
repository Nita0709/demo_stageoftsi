// API publik (hanya baca) untuk website: /api/public?type=content | buletin
import { sql } from '../admin/server/db.js';

export default async function handler(req, res) {
  const isBuletin = req.query.type === 'buletin';
  try {
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    if (isBuletin) {
      return res.status(200).json(await sql`select id, tahun, bulan, pdf, cover from buletin order by tahun desc, bulan desc`);
    }
    const [h, a, g] = await Promise.all([
      sql`select id, judul, deskripsi, gambar from highlight order by id`,
      sql`select id, judul, to_char(tanggal, 'YYYY-MM-DD') as tanggal, tautan, file from artikel order by tanggal desc, id desc limit 20`,
      sql`select nama, path from gambar_situs`,
    ]);
    const img = n => (g.find(x => x.nama === n) || {}).path || '';
    return res.status(200).json({
      highlight: h.map(x => ({ id: x.id, title: x.judul, desc: x.deskripsi, image: x.gambar })),
      artikel: a.map(x => ({ id: x.id, title: x.judul, date: x.tanggal, link: x.tautan, file: x.file })),
      shakemap: img('shakemap'), ikm: img('ikm'),
    });
  } catch {
    // Database belum disiapkan: kembalikan data kosong agar website tetap tampil
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(isBuletin ? [] : { highlight: [], artikel: [], shakemap: '', ikm: '' });
  }
}
