#!/usr/bin/env node
/* Dependency-free PNG icon generator for System Deconstructor.
   Draws the brand mark — a teal drafting square holding a dot grid
   (the pinboard motif) — at every required size. Pure Node: builds
   an RGBA raster, then encodes PNG via zlib. */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "icons");

const INK = [0x14, 0x14, 0x16], PAPER = [0xf2, 0xf0, 0xea], TEAL = [0x0e, 0x7a, 0x63], PANEL = [0xfb, 0xfa, 0xf6];

function canvas(size, bg) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { buf[i*4]=bg[0]; buf[i*4+1]=bg[1]; buf[i*4+2]=bg[2]; buf[i*4+3]=255; }
  return { size, buf };
}
function px(c, x, y, col, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.buf[i]   = Math.round(c.buf[i]   * (1 - a) + col[0] * a);
  c.buf[i+1] = Math.round(c.buf[i+1] * (1 - a) + col[1] * a);
  c.buf[i+2] = Math.round(c.buf[i+2] * (1 - a) + col[2] * a);
}
function fillRect(c, x0, y0, w, hgt, col) {
  for (let y = y0; y < y0 + hgt; y++) for (let x = x0; x < x0 + w; x++) px(c, x, y, col);
}
// stroked square frame of given thickness
function frame(c, x0, y0, side, t, col) {
  fillRect(c, x0, y0, side, t, col);
  fillRect(c, x0, y0 + side - t, side, t, col);
  fillRect(c, x0, y0, t, side, col);
  fillRect(c, x0 + side - t, y0, t, side, col);
}
function disc(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r - 0.6) px(c, x, y, col);
      else if (d <= r + 0.6) px(c, x, y, col, r + 0.6 - d);   // cheap AA
    }
}

/* The Vitruvian mark: a precise square (the machine) overlapped by a
   hand-brushed open ring (the human) — Leonardo's circle-and-square,
   reduced to the app's thesis. The ring is drawn with a tapered,
   wobbling width and an open gap, enso-style, in raster. */
function drawMark(c, opts) {
  const s = c.size;
  const side = Math.round(s * 0.46);
  const x0 = Math.round((s - side) / 2);
  const y0 = Math.round(s * 0.335);                 // square sits low; ring rides high
  const t = Math.max(2, Math.round(s * 0.038));
  frame(c, x0, y0, side, t, opts.frameCol);

  // brush ring: for each pixel near radius R(θ), inside if |d-R(θ)| < W(θ)/2
  const cx = s / 2, cy = s * 0.465, R = s * 0.30;
  const rot = -Math.PI / 2 + 0.5;                   // gap ends up top-right
  const GAP = 0.85, span = Math.PI * 2 - GAP;
  const maxW = s * 0.052, wob = s * 0.012;
  const lo = R - maxW, hi = R + maxW;
  for (let y = Math.floor(cy - hi - 2); y <= cy + hi + 2; y++) {
    for (let x = Math.floor(cx - hi - 2); x <= cx + hi + 2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < lo || d > hi) continue;
      let th = Math.atan2(dy, dx) - rot;
      th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (th > span) continue;                      // the enso gap
      const tt = th / span;                         // 0 = stroke start, 1 = tail
      const w = maxW * (0.35 + 0.65 * Math.pow(1 - tt, 1.2)) * Math.min(1, 0.2 + tt * 7);
      const rTh = R + Math.sin(tt * Math.PI * 2 + 1.1) * wob + Math.sin(tt * Math.PI * 5 + 2.7) * wob * 0.4;
      const dist = Math.abs(d - rTh);
      if (dist <= w / 2 - 0.7) px(c, x, y, opts.dotCol);
      else if (dist <= w / 2 + 0.7) px(c, x, y, opts.dotCol, (w / 2 + 0.7 - dist) / 1.4);
    }
  }
}

function encodePNG(c) {
  const { size, buf } = c;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;                                // filter: none
    buf.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c2 = n; for (let k = 0; k < 8; k++) c2 = c2 & 1 ? 0xedb88320 ^ (c2 >>> 1) : c2 >>> 1; t[n] = c2 >>> 0; } return t; })();
  const crc = b => { let c2 = 0xffffffff; for (const x of b) c2 = crcTable[(c2 ^ x) & 0xff] ^ (c2 >>> 8); return (c2 ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))
  ]);
}

function write(name, size, { bg, frameCol, dotCol }) {
  const c = canvas(size, bg);
  drawMark(c, { frameCol, dotCol });
  fs.writeFileSync(path.join(OUT, name), encodePNG(c));
  console.log("wrote icons/" + name + " (" + size + "px)");
}

// regular: paper ground, teal frame, teal dots
write("icon-192.png", 192, { bg: PAPER, frameCol: TEAL, dotCol: TEAL });
write("icon-512.png", 512, { bg: PAPER, frameCol: TEAL, dotCol: TEAL });
write("apple-touch-icon.png", 180, { bg: PAPER, frameCol: TEAL, dotCol: TEAL });
// maskable: teal ground (survives circle/squircle masking), paper mark
write("icon-maskable-512.png", 512, { bg: TEAL, frameCol: PANEL, dotCol: PANEL });
