#!/usr/bin/env node
/* Share-page generator: for the root plus every library slug, emit
     share/<slug>.html  — og/twitter card tags + instant redirect into
                          the app at #/study/<slug> (crawlers read tags,
                          humans bounce straight into the reader)
     share/og/<slug>.png — 1200x630 brand card: washi ground, seeded ink
                          enso, teal square, vermillion seal. No text in
                          the image: og:title carries the words, per the
                          enso raster idiom of make-marketing-assets.js.
   Run after adding/renaming flagships: node tools/build-share-pages.js
   Slugs come from content.js (CONFIG.flagshipNames) — one source. */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
(0, eval)(fs.readFileSync(path.join(root, "content.js"), "utf8"));

const SITE = CONFIG.siteUrl;
const OUT = path.join(root, "share");
fs.mkdirSync(path.join(OUT, "og"), { recursive: true });

/* ── raster kit (same idiom as make-marketing-assets.js) ── */
const INK = [0x21, 0x1e, 0x19], WASHI = [0xf7, 0xf4, 0xed], VERMILLION = [0xd9, 0x5b, 0x31], TEAL = [0x0e, 0x7a, 0x63];
function canvas(w, hgt, bg) {
  const buf = Buffer.alloc(w * hgt * 4);
  for (let i = 0; i < w * hgt; i++) { buf[i*4]=bg[0]; buf[i*4+1]=bg[1]; buf[i*4+2]=bg[2]; buf[i*4+3]=255; }
  return { w, h: hgt, buf };
}
function px(c, x, y, col, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.buf[i]   = Math.round(c.buf[i]   * (1 - a) + col[0] * a);
  c.buf[i+1] = Math.round(c.buf[i+1] * (1 - a) + col[1] * a);
  c.buf[i+2] = Math.round(c.buf[i+2] * (1 - a) + col[2] * a);
}
function disc(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r - 0.6) px(c, x, y, col);
      else if (d <= r + 0.6) px(c, x, y, col, r + 0.6 - d);
    }
}
function enso(c, cx, cy, R, maxW, col, { rot = -Math.PI / 2 + 0.5, gap = 0.85, seed = 1 } = {}) {
  const span = Math.PI * 2 - gap, wob = R * 0.04;
  const lo = R - maxW, hi = R + maxW;
  for (let y = Math.floor(cy - hi - 2); y <= cy + hi + 2; y++) {
    for (let x = Math.floor(cx - hi - 2); x <= cx + hi + 2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < lo || d > hi) continue;
      let th = Math.atan2(dy, dx) - rot;
      th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (th > span) continue;
      const tt = th / span;
      const w = maxW * (0.35 + 0.65 * Math.pow(1 - tt, 1.2)) * Math.min(1, 0.2 + tt * 7);
      const rTh = R + Math.sin(tt * Math.PI * 2 + seed) * wob + Math.sin(tt * Math.PI * 5 + seed * 2.4) * wob * 0.4;
      const dist = Math.abs(d - rTh);
      if (dist <= w / 2 - 0.7) px(c, x, y, col);
      else if (dist <= w / 2 + 0.7) px(c, x, y, col, (w / 2 + 0.7 - dist) / 1.4);
    }
  }
}
function frame(c, x0, y0, side, t, col) {
  for (let y = y0; y < y0 + side; y++)
    for (let x = x0; x < x0 + side; x++) {
      const onEdge = x < x0 + t || x >= x0 + side - t || y < y0 + t || y >= y0 + side - t;
      if (onEdge) px(c, x, y, col);
    }
}
function encodePNG(c) {
  const stride = c.w * 4;
  const raw = Buffer.alloc((stride + 1) * c.h);
  for (let y = 0; y < c.h; y++) { raw[y * (stride + 1)] = 0; c.buf.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; t[n] = x >>> 0; } return t; })();
  const crc = b => { let x = 0xffffffff; for (const v of b) x = crcT[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* deterministic per-slug seed so each study's card is its own enso */
const seedOf = s => { let n = 0; for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) % 997; return 1 + (n / 997) * 8; };

function ogCard(slug) {
  const c = canvas(1200, 630, WASHI);
  const side = 250, x0 = 170, y0 = (630 - side) / 2;
  frame(c, x0, y0, side, 10, TEAL);
  enso(c, 295, 315, 180, 30, INK, { seed: seedOf(slug) });
  disc(c, 440, 470, 17, VERMILLION);
  // quiet echo right of centre — the deconstructed half
  enso(c, 880, 315, 130, 16, INK, { seed: seedOf(slug) * 2.1, gap: 1.6 });
  return c;
}

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function page(slug, title, desc) {
  const url = `${SITE}#/study/${slug}`;
  const img = `${SITE}share/og/${slug}.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}share/${slug}.html">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
<p><a href="${url}">Open this Deconstruct in Vitruvian →</a></p>
</body>
</html>
`;
}

// root card
fs.writeFileSync(path.join(OUT, "og", "vitruvian.png"), encodePNG(ogCard("vitruvian")));
console.log("wrote share/og/vitruvian.png");

for (const slug of CONFIG.flagshipNames) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, "flagships", slug + ".json"), "utf8"));
  const title = `${doc.meta.system}, deconstructed · Vitruvian`;
  const desc = `${doc.layers.length} layers, each born from a real failure. ` + doc.essence.text.split(". ")[0] + ".";
  fs.writeFileSync(path.join(OUT, slug + ".html"), page(slug, title, desc));
  fs.writeFileSync(path.join(OUT, "og", slug + ".png"), encodePNG(ogCard(slug)));
  console.log(`wrote share/${slug}.html + og/${slug}.png`);
}
