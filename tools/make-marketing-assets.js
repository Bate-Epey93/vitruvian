#!/usr/bin/env node
/* Marketing-doc PNG assets in the EnsoKit idiom: brush enso rings
   (tapered, wobbling, open gap) rastered pure-Node, washi ground,
   ink stroke, vermillion seal. Reuses the raster approach from
   make-icons.js; encodePNG duplicated to stay dependency-free. */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "marketing", "assets");
fs.mkdirSync(OUT, { recursive: true });

// EnsoKit palette
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
/* brush enso ring: tapered width, wobble, open gap */
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
function save(name, c) { fs.writeFileSync(path.join(OUT, name), encodePNG(c)); console.log("wrote", name, c.w + "x" + c.h); }

// 1. Cover mark: large enso + precise teal square + vermillion seal, washi ground
{
  const c = canvas(900, 900, WASHI);
  const side = 380, x0 = (900 - side) / 2, y0 = 330;
  frame(c, x0, y0, side, 13, TEAL);
  enso(c, 450, 420, 265, 44, INK, { seed: 1.1 });
  disc(c, 665, 660, 26, VERMILLION);
  save("cover-mark.png", c);
}
// 2. Section divider: small enso, wide washi strip
{
  const c = canvas(1400, 140, WASHI);
  enso(c, 700, 70, 46, 10, INK, { seed: 2.3, gap: 1.1 });
  disc(c, 748, 104, 6, VERMILLION);
  save("divider.png", c);
}
// 3. Seal block: vermillion enso, small — for pull-quotes / verdict callouts
{
  const c = canvas(300, 300, WASHI);
  enso(c, 150, 150, 92, 20, VERMILLION, { seed: 3.7, gap: 0.7 });
  save("seal-enso.png", c);
}
// 4. Teal enso for pricing/product sections
{
  const c = canvas(300, 300, WASHI);
  enso(c, 150, 150, 92, 18, TEAL, { seed: 5.2, gap: 0.95 });
  save("teal-enso.png", c);
}
