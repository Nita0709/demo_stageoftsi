// Build statis: menggabungkan layout + header/footer/sidebar + halaman menjadi HTML jadi di folder dist/.
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd(), SRC = path.join(R, 'src'), OUT = path.join(R, 'dist');
const rd = (...p) => fs.readFileSync(path.join(...p), 'utf8');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(R, 'admin', 'ui'), path.join(OUT, 'admin'), { recursive: true });

const layout = rd(SRC, 'layout.html'), part = n => rd(SRC, 'partials', n + '.html');
const header = part('header'), footer = part('footer'), sidebar = part('sidebar');
const year = String(new Date().getFullYear());

for (const file of fs.readdirSync(path.join(SRC, 'pages')).filter(f => f.endsWith('.html'))) {
  let src = rd(SRC, 'pages', file);
  const m = /^<!--meta (.*?)-->\n?/.exec(src);
  const meta = {};
  if (m) { for (const [, k, v] of m[1].matchAll(/(\w+)="([^"]*)"/g)) meta[k] = v; src = src.slice(m[0].length); }
  const hero = meta.hero
    ? `<section class="hero"><div class="wrap"><div class="crumb">${meta.crumb || ''}</div><h1>${meta.hero}</h1></div></section>` : '';
  const html = layout
    .replace('{{header}}', () => header).replace('{{hero}}', () => hero).replace('{{footer}}', () => footer)
    .replace('{{content}}', () => src.replace('{{sidebar}}', () => sidebar))
    .replaceAll('{{title}}', meta.title || 'Beranda').replaceAll('{{page}}', meta.page || 'umum').replaceAll('{{year}}', year);
  fs.writeFileSync(path.join(OUT, file), html);
  console.log('dibuat:', file);
}
