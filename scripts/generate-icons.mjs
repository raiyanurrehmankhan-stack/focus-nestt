// Generates every PWA icon and iOS splash screen from public/brand/*.
// Run with: node scripts/generate-icons.mjs   (needs `sharp`; dev-only tool)
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const MARK = 'public/brand/logo-icon.png';
const WORDMARK = 'public/brand/logo-full.png';
const BG_LIGHT = '#F5F8FA';
const BG_SOFT = '#E6F5F2';
await mkdir('public/icons', { recursive: true });
await mkdir('public/splash', { recursive: true });

const mark = (size) => sharp(MARK).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
const png = (s) => s.png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 });

async function icon(file, size, { bg = null, scale = 0.86, radius = 0 } = {}) {
  const inner = Math.round(size * scale);
  const base = bg
    ? sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  let buf = await base.composite([{ input: await mark(inner), gravity: 'centre' }]).png().toBuffer();
  if (radius) {
    const r = Math.round(size * radius);
    const maskSvg = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
    buf = await sharp(buf).composite([{ input: maskSvg, blend: 'dest-in' }]).png().toBuffer();
  }
  await png(sharp(buf)).toFile(file);
  return buf;
}

// Standard ("any") icons: transparent mark with a little padding
for (const s of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]) await icon(`public/icons/icon-${s}.png`, s, { scale: 0.9 });
// Maskable icons: full-bleed background, mark inside the 80% safe zone
for (const s of [192, 512]) await icon(`public/icons/maskable-${s}.png`, s, { bg: BG_SOFT, scale: 0.62 });
// Apple touch icon (iOS fills transparency with black, so use a solid background)
await icon('public/icons/apple-touch-icon.png', 180, { bg: '#FFFFFF', scale: 0.8 });
// Windows tile / monochrome-safe badge for notifications (white silhouette)
{
  const s = 96;
  const m = await mark(80);
  const { data, info } = await sharp(m).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = data[i + 3] > 200 ? 255 : 0; }
  const white = await sharp(data, { raw: info }).png().toBuffer();
  await sharp({ create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: white, gravity: 'centre' }]).png().toFile('public/icons/badge-96.png');
}
// Favicons
const fav16 = await icon('public/icons/favicon-16.png', 16, { scale: 1 });
const fav32 = await icon('public/icons/favicon-32.png', 32, { scale: 1 });
const fav48 = await sharp('public/icons/icon-48.png').toBuffer();
// favicon.ico containing PNG images (supported by all modern browsers)
{
  const imgs = [[16, fav16], [32, fav32], [48, fav48]];
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + dir.length;
  imgs.forEach(([s, b], i) => {
    const o = i * 16;
    dir.writeUInt8(s === 256 ? 0 : s, o); dir.writeUInt8(s === 256 ? 0 : s, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3); dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(b.length, o + 8); dir.writeUInt32LE(offset, o + 12); offset += b.length;
  });
  await writeFile('public/favicon.ico', Buffer.concat([header, dir, ...imgs.map((x) => x[1])]));
}

// Shortcut icons (Lucide-style glyphs on brand circles)
const glyphs = {
  focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/>',
  break: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  checkin: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  sleep: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};
const colors = { focus: '#2A9D8F', break: '#4F8EF7', checkin: '#3FB68B', sleep: '#334155' };
for (const [name, g] of Object.entries(glyphs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="${colors[name]}"/><g transform="translate(24 24) scale(2)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/shortcut-${name}.png`);
}

// iOS splash screens (portrait). [cssWidth, cssHeight, pixelRatio] — shared with the build script
const SPLASH = JSON.parse(await readFile('scripts/splash-sizes.json', 'utf8'));
const word = await sharp(WORDMARK).toBuffer();
for (const [w, h, r] of SPLASH) {
  const W = w * r, H = h * r;
  const logoW = Math.round(Math.min(W, H) * 0.46);
  const logo = await sharp(word).resize({ width: logoW }).toBuffer();
  const tag = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(H * 0.06)}"><text x="50%" y="60%" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${Math.round(Math.min(W, H) * 0.034)}" fill="#64748B">Track it. Control it. Replace it.</text></svg>`);
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: W, height: H, channels: 3, background: BG_LIGHT } })
    .composite([
      { input: logo, left: Math.round((W - meta.width) / 2), top: Math.round(H * 0.42 - meta.height / 2) },
      { input: tag, left: 0, top: Math.round(H * 0.42 + meta.height / 2 + H * 0.01) },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`public/splash/splash-${W}x${H}.jpg`);
}
console.log('Icons and splash screens generated');
