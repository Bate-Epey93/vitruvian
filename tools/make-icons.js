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

function drawMark(c, opts) {
  const s = c.size;
  const side = Math.round(s * 0.56);
  const x0 = Math.round((s - side) / 2), y0 = x0;
  const t = Math.max(2, Math.round(s * 0.045));
  frame(c, x0, y0, side, t, opts.frameCol);
  // 3x3 dot grid inside the frame
  const inset = t + Math.round(side * 0.14);
  const span = side - inset * 2;
  const step = span / 2;
  const r = Math.max(1.5, s * 0.022);
  for (let gy = 0; gy < 3; gy++)
    for (let gx = 0; gx < 3; gx++)
      disc(c, x0 + inset + gx * step, y0 + inset + gy * step, r, opts.dotCol);
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
