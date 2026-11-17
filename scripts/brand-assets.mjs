// One-time brand asset pipeline. Run with: node scripts/brand-assets.mjs
// Requires `sharp` (dev tool only, not needed for the app build).
// Source images live in design/brand-source/ and are used exactly as given:
// the bird-and-nest mark is cropped from the supplied mascot artwork and the
// white backdrop is made transparent; nothing is redrawn.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'design/brand-source/mascot-original.jpg';
const OUT = 'public/brand';
await mkdir(OUT, { recursive: true });

// Make near-white pixels transparent while keeping soft glows.
async function whiteToAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const minc = Math.min(r, g, b);
    const whiteness = minc / 255; // 1 = pure white
    let a = Math.round(Math.min(1, (1 - whiteness) * 3.2) * 255);
    if (a < 10) a = 0;
    if (a > 0 && a < 255) {
      // un-premultiply against white so edges are not washed out
      const af = a / 255;
      data[i] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - af)) / af)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - af)) / af)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - af)) / af)));
    }
    data[i + 3] = a;
  }
  return sharp(data, { raw: info }).png();
}

// Bird + nest only (no wordmark): logo-icon.png
const markRegion = { left: 520, top: 400, width: 1010, height: 960 };
const markJpg = await sharp(SRC).extract(markRegion).toBuffer();
const markPng = await (await whiteToAlpha(markJpg)).toBuffer();
await sharp(markPng).trim({ threshold: 1 }).png().toFile(`${OUT}/logo-icon-full.png`);
const trimmed = await sharp(markPng).trim({ threshold: 1 }).toBuffer();
await sharp(trimmed).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${OUT}/logo-icon.png`);
await sharp(trimmed).resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${OUT}/logo-icon-160.png`);

// Full logo with wordmark (light background version, transparent)
const full = await (await whiteToAlpha(await sharp(SRC).extract({ left: 300, top: 400, width: 1450, height: 1260 }).toBuffer())).toBuffer();
await sharp(full).trim({ threshold: 1 }).resize({ width: 640 }).png().toFile(`${OUT}/logo-full.png`);

// Demo feed image for the simulated phone (supplied demo asset)
await sharp('design/brand-source/demo-feed-original.jpg').extract({ left: 160, top: 360, width: 1240, height: 2150 })
  .resize({ width: 540 }).jpeg({ quality: 78, mozjpeg: true }).toFile('public/demo/feed.jpg');

console.log('Brand assets written to', OUT);
