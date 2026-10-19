// Koneksi Postgres (Neon) lewat HTTP – cocok untuk serverless Vercel.
import { neon } from '@neondatabase/serverless';

let client;
export const sql = (...args) => {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('CFG:DATABASE_URL belum diatur. Tambahkan Neon Postgres di Vercel > Storage.');
    client = neon(process.env.DATABASE_URL);
  }
  return client(...args);
};

// Membuat tabel jika belum ada (dipanggil saat setup akun pertama).
export async function ensureSchema() {
  await sql`create table if not exists users (
    id serial primary key, username varchar(30) unique not null, password_hash text not null, created_at timestamptz default now())`;
  await sql`create table if not exists buletin (
    id serial primary key, tahun smallint not null, bulan smallint not null,
    pdf text not null default '', cover text not null default '', created_at timestamptz default now(), unique (tahun, bulan))`;
  await sql`create table if not exists highlight (
    id serial primary key, judul varchar(100) not null, deskripsi varchar(160) not null default '',
    gambar text not null, created_at timestamptz default now())`;
  await sql`create table if not exists artikel (
    id serial primary key, judul varchar(150) not null, tanggal date not null,
    tautan text not null default '', file text not null default '', created_at timestamptz default now())`;
  await sql`create table if not exists gambar_situs (nama varchar(30) primary key, path text not null)`;
}
