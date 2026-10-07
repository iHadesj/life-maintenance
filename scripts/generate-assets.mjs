// Generates PWA icons, the favicon and iOS launch screens from one SVG mark.
// Usage: npm run assets
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const INK = '#1a1b23';

/** Point on a circle: 0° = 12 o'clock, clockwise. */
const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};
const f = (n) => n.toFixed(1);
const arc = (cx, cy, r, from, to) => {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
};

/**
 * The mark: a ring that wears. It starts at a solid origin dot (the last
 * service), runs almost all the way around, and frays into fragments.
 */
function mark(cx, cy, r, stroke) {
  const [ox, oy] = polar(cx, cy, r, 205);
  return `
    <path d="${arc(cx, cy, r, 205, 445)}" stroke="url(#wear)" stroke-width="${stroke}" fill="none" stroke-linecap="round"/>
    <path d="${arc(cx, cy, r, 459, 472)}" stroke="#ff79c6" stroke-width="${stroke}" fill="none" stroke-linecap="round"/>
    <path d="${arc(cx, cy, r + stroke * 0.18, 485, 491)}" stroke="#ff79c6" stroke-opacity="0.75" stroke-width="${stroke * 0.8}" fill="none" stroke-linecap="round"/>
    <circle cx="${f(polar(cx, cy, r - stroke * 0.25, 503)[0])}" cy="${f(polar(cx, cy, r - stroke * 0.25, 503)[1])}" r="${f(stroke * 0.28)}" fill="#ff79c6" fill-opacity="0.6"/>
    <circle cx="${f(ox)}" cy="${f(oy)}" r="${f(stroke * 0.8)}" fill="#f8f8f2"/>
  `;
}

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="78%">
      <stop offset="0" stop-color="#2b2d3c"/>
      <stop offset="1" stop-color="#14151c"/>
    </radialGradient>
    <linearGradient id="wear" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#8be9fd"/>
      <stop offset="0.45" stop-color="#bd93f9"/>
      <stop offset="1" stop-color="#ff79c6"/>
    </linearGradient>
  </defs>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bg)"/>
  ${mark(256, 256, 146, 30)}
</svg>`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}
  <rect width="64" height="64" rx="14" fill="${INK}"/>
  ${mark(32, 32, 19, 5.5)}
</svg>`;

function splash(w, h) {
  const r = Math.round(w * 0.1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}
  <rect width="${w}" height="${h}" fill="${INK}"/>
  ${mark(w / 2, h * 0.47, r, Math.max(8, r * 0.2))}
</svg>`;
}

const ICONS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon-180.png', 180],
];

const SPLASHES = [
  [828, 1792], // iPhone 11 / XR
  [1242, 2688], // 11 Pro Max / XS Max
  [1125, 2436], // 11 Pro / X / XS / 12-13 mini
  [1170, 2532], // 12 / 13 / 14
  [1179, 2556], // 14 Pro / 15 / 16
  [1206, 2622], // 16 Pro
  [1284, 2778], // 12-13 Pro Max / 14 Plus
  [1290, 2796], // 14-15 Pro Max / 15-16 Plus
  [1320, 2868], // 16 Pro Max
  [750, 1334], // SE
];

await mkdir('public/icons', { recursive: true });
await mkdir('public/splash', { recursive: true });

await writeFile('public/favicon.svg', favicon.trim());
for (const [name, size] of ICONS) {
  await sharp(Buffer.from(icon)).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
}
for (const [w, h] of SPLASHES) {
  await sharp(Buffer.from(splash(w, h))).png({ compressionLevel: 9, palette: true }).toFile(`public/splash/splash-${w}x${h}.png`);
}
console.log(`generated ${ICONS.length} icons, favicon.svg and ${SPLASHES.length} launch screens`);
