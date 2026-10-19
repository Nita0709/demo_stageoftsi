// Hash password (scrypt bawaan Node) + sesi bertanda tangan HMAC di cookie HttpOnly.
import crypto from 'node:crypto';

const secret = () => {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 16) throw new Error('CFG:SESSION_SECRET belum diatur (minimal 16 karakter).');
  return s;
};
const mac = p => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

export function hash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verify(pw, stored) {
  const [, salt, h] = String(stored).split('$');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function sign(user) {
  const p = Buffer.from(JSON.stringify({ u: user, e: Date.now() + 7 * 864e5 })).toString('base64url');
  return `${p}.${mac(p)}`;
}
export function readSession(req) {
  const m = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '');
  if (!m || (process.env.SESSION_SECRET || '').length < 16) return null;
  const [p, sig] = m[1].split('.');
  if (!p || !sig) return null;
  const good = mac(p);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.e > Date.now() ? d.u : null; } catch { return null; }
}
export const cookie = v => `session=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`;
export const clearCookie = () => 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
