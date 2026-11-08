#!/usr/bin/env node
/* Builds the splash: the word VITRUVIAN as a small system diagram, nine
   sketched boxes on one lane, wired left to right, with a payload that runs
   along the boxes' edges to the end.

   The splash paints before any app script runs (the CSP bars inline
   scripts, and the deferred app has not booted yet), so it has to be static
   SVG and CSS. This script does the work offline instead: it runs the
   vendored rough.js with fixed seeds, so the boxes carry the diagram's
   hand-drawn wobble, and it bakes the payload's route into CSS keyframes.
   Same seeds, same output, every run.

   It rewrites two generated regions in place:
     index.html  between <!-- splash:begin --> and <!-- splash:end -->
     styles.css  between / * splash:begin * / and / * splash:end * /
   Edit this file, not those regions, then run:  node tools/make-splash.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const rough = vm.runInNewContext(fs.readFileSync(path.join(ROOT, "vendor/rough.js"), "utf8") + ";rough", {});
const gen = rough.generator();

/* ── geometry, in SVG user units ── */
const WORD = "VITRUVIAN".split("");
const BW = 24, BH = 28, R = 5, STEP = 34;     // box width, height, corner, pitch
const Y = 16;                                // box top
const MID = Y + BH / 2;                      // where the edges run
const LAST = (WORD.length - 1) * STEP + BW;  // right side of the last box
const IN = 14, OUT = 16;                     // entry and exit stubs
const VB = { x: -IN - 8, y: 0, w: LAST + IN + OUT + 16, h: 60 };

/* ── timing, in seconds ── */
const T = {
  box: i => 0.06 + i * 0.075,  // box i starts sketching
  boxDur: 0.3,
  settle: 0.42,                // after its start, the fresh accent settles to ink
  run: 0.42,                   // the payload sets off
  runDur: 2.1,                 // and takes this long to reach the end
};

/* The diagram's own sketch settings (renderer-diagram.js SKETCH), a touch
   rougher: at this size the diagram's 0.9 reads as almost clean. */
const SKETCH = { roughness: 1.25, bowing: 1.1, disableMultiStroke: true, preserveVertices: true };
const seedOf = id => {                       // FNV-1a, as the renderer does it
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 2147483647;
};
/* Rough returns one subpath per segment, each opening with a move to where
   the last one ended (preserveVertices pins them). SVG restarts the dash
   pattern at every subpath, so the draw-in would grow every side at once
   from its own corner. Dropping the moves that go nowhere makes the outline
   one stroke, drawn the way a pen goes round it. */
const joinSubpaths = d => {
  const parts = d.trim().split(/(?=M)/);
  let out = parts[0], end = null;
  const tail = p => { const n = p.match(/-?\d+(\.\d+)?/g); return n ? n.slice(-2).join(",") : null; };
  end = tail(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^M\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*/);
    out += (m && `${m[1]},${m[2]}` === end) ? " " + parts[i].slice(m[0].length) : " " + parts[i];
    end = tail(parts[i]);
  }
  return out.replace(/\s+/g, " ").trim();
};
const sketch = (d, id) => joinSubpaths(gen.toPaths(gen.path(d, Object.assign({ seed: seedOf(id) }, SKETCH))).map(p => p.d).join(" ")
  .replace(/-?\d+\.\d+/g, m => String(+(+m).toFixed(1))));   // a tenth of a unit is under a pixel
const f = n => +n.toFixed(2);
const s3 = n => n.toFixed(3).replace(/\.?0+$/, "") + "s";
const roundRectD = (x, y, w, h, r) =>
  `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r}` +
  ` h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
const LANE_STROKES = [0, 1, 2, 3, 4].map(k => `var(--lane${k}-stroke)`);

/* ── the payload's route: in along the entry stub, then over the top of
   every box (up its left side, across, down its right side), along each
   edge to the next, and out along the exit stub. Sampled densely enough at
   the corners that the dot stays on the rounded outline. ── */
const route = [[-IN, MID]];
const boxEnter = [], boxLeave = [];
const len = () => {
  let L = 0;
  for (let i = 1; i < route.length; i++) L += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return L;
};
const arc = (cx, cy, a0, a1) => {
  for (let k = 1; k <= 4; k++) {
    const a = a0 + (a1 - a0) * k / 4;
    route.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
};
WORD.forEach((_, i) => {
  const x = i * STEP;
  route.push([x, MID]);
  boxEnter.push(len());
  route.push([x, Y + R]);
  arc(x + R, Y + R, Math.PI, Math.PI * 1.5);
  route.push([x + BW - R, Y]);
  arc(x + BW - R, Y + R, Math.PI * 1.5, Math.PI * 2);
  route.push([x + BW, MID]);
  boxLeave.push(len());
});
route.push([LAST + OUT, MID]);
const TOTAL = len();
const at = d => T.run + T.runDur * d / TOTAL;   // when the payload is d along

let cum = 0;
const frames = route.map((p, i) => {
  if (i) cum += Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]);
  return `${f(100 * cum / TOTAL)}%{transform:translate(${f(p[0])}px,${f(p[1])}px)}`;
});
const END = route[route.length - 1];

/* ── markup ── */
const out = [];
out.push(`<svg class="sp-word" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" aria-hidden="true">`);
// the lane, as the diagram draws one: a faint band, dashed rules, a label
out.push(`<g class="sp-lane"><rect x="${VB.x}" y="4" width="${VB.w}" height="${VB.h - 8}" rx="3"/>` +
  `<path class="sp-rule" d="M ${VB.x} 4 H ${VB.x + VB.w} M ${VB.x} ${VB.h - 4} H ${VB.x + VB.w}"/>` +
  `<text x="${VB.x + 4}" y="11.5">SYSTEM</text></g>`);
// entry and exit stubs, and the edge between each pair of boxes
const edge = (x1, x2, color, d, id) => {
  out.push(`<path class="sp-edge" pathLength="1" d="${sketch(`M ${x1} ${MID} L ${x2} ${MID}`, id)}" stroke="${color}" style="--d:${s3(d)}"/>`);
  out.push(`<path class="sp-chev" d="M ${x2 - 3.4} ${MID - 2.8} L ${x2} ${MID} L ${x2 - 3.4} ${MID + 2.8}" stroke="${color}" style="--d:${s3(d + 0.08)}"/>`);
};
edge(-IN, -1.5, "var(--diagram-ink)", 0.02, "sp-in");
for (let i = 1; i < WORD.length; i++) edge((i - 1) * STEP + BW + 1.5, i * STEP - 1.5, LANE_STROKES[(i - 1) % 5], T.box(i) - 0.03, "sp-e" + i);
edge(LAST + 1.5, LAST + OUT, "var(--accent)", T.box(WORD.length - 1) + 0.24, "sp-out");
// the boxes: a clean fill underneath, the sketched outline over it (the
// diagram splits them the same way), and the letter
WORD.forEach((ch, i) => {
  const x = i * STEP, d = T.box(i);
  const lit = at(boxEnter[i]);
  const last = i === WORD.length - 1;
  out.push(`<g class="sp-box${last ? " sp-last" : ""}" style="--d:${s3(d)};--sp-settle:${s3(d + T.settle)};--sp-pass:${s3(lit)}">` +
    `<rect class="sp-fill" x="${x}" y="${Y}" width="${BW}" height="${BH}" rx="${R}"/>` +
    `<path class="sp-shape" pathLength="1" d="${sketch(roundRectD(x, Y, BW, BH, R), "sp-box-" + i + ch)}"/>` +
    `<text class="sp-glyph" x="${x + BW / 2}" y="${MID + 0.6}">${ch}</text></g>`);
});
// the payload, and the ring it leaves when it arrives
out.push(`<circle class="sp-ping" r="3" cx="0" cy="0" style="--sp-pass:${s3(T.run + T.runDur)}"/>`);
out.push(`<circle class="sp-tok" r="2.6" cx="0" cy="0"/>`);
out.push(`</svg>`);
const markup = out.join("\n  ");

/* ── styles ── */
const css = `
/* each part's timing comes inline from the markup; these are the defaults */
.sp-word{--d:0s;--sp-settle:0s;--sp-pass:0s;width:min(92vw,480px);height:auto;overflow:visible;}
/* fill-opacity, not color-mix(): where color-mix is unknown (iOS before
   16.2) the whole fill is dropped and the band paints solid black */
.sp-lane rect{fill:var(--ink);fill-opacity:.03;opacity:0;animation:sp-fade .3s ease forwards;}
.sp-rule{fill:none;stroke:var(--line);stroke-width:.6;stroke-dasharray:2 4;opacity:0;animation:sp-fade .3s ease forwards;}
.sp-lane text{font:700 5px var(--mono);letter-spacing:.32em;fill:var(--muted);opacity:0;animation:sp-fade .3s ease .1s forwards;}
/* hidden until drawn as well as dashed off: a round cap on an undrawn
   dash still paints a dot at the path's start */
.sp-edge{fill:none;stroke-width:1.3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;opacity:0;animation:sp-draw .14s ease var(--d) forwards,sp-show 0s var(--d) forwards;}
.sp-chev{fill:none;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;opacity:0;animation:sp-fade .1s ease var(--d) forwards;}
.sp-fill{fill:var(--node-fill);opacity:0;animation:sp-fade .2s ease var(--d) forwards;}
/* drawn in the accent a new layer's parts get, then settled to ink; lit
   again as the payload runs over it */
.sp-shape{fill:none;stroke:var(--accent);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:1;stroke-dashoffset:1;opacity:0;
  animation:sp-draw ${T.boxDur}s cubic-bezier(.55,.12,.3,1) var(--d) forwards,sp-show 0s var(--d) forwards,sp-settle .4s ease var(--sp-settle) forwards,sp-lit .7s ease var(--sp-pass);}
.sp-last .sp-shape{animation:sp-draw ${T.boxDur}s cubic-bezier(.55,.12,.3,1) var(--d) forwards,sp-show 0s var(--d) forwards,sp-settle .4s ease var(--sp-settle) forwards,sp-arrive .5s ease var(--sp-pass) forwards;}
.sp-glyph{font:650 17px var(--display);fill:var(--diagram-ink);text-anchor:middle;dominant-baseline:central;opacity:0;animation:sp-fade .22s ease calc(var(--d) + .12s) forwards;}
.sp-tok{fill:var(--accent);opacity:0;transform:translate(${f(route[0][0])}px,${f(route[0][1])}px);
  animation:sp-fade .2s ease ${s3(T.run - 0.05)} forwards,sp-run ${T.runDur}s linear ${s3(T.run)} forwards;}
.sp-ping{fill:none;stroke:var(--accent);stroke-width:1;opacity:0;transform-box:fill-box;transform-origin:center;
  transform:translate(${f(END[0])}px,${f(END[1])}px);animation:sp-ping .55s ease-out var(--sp-pass);}
@keyframes sp-run{${frames.join("")}}
@keyframes sp-draw{to{stroke-dashoffset:0}}
@keyframes sp-fade{to{opacity:1}}
@keyframes sp-show{to{opacity:1}}
@keyframes sp-settle{to{stroke:var(--diagram-ink)}}
/* no 0% or 100%: it rises from, and returns to, whatever the box is doing.
   The first boxes are still settling from their fresh accent when the
   payload reaches them, and a stated 0% of ink snapped them dark for a frame. */
@keyframes sp-lit{18%,45%{stroke:var(--accent);stroke-width:1.9}}
@keyframes sp-arrive{to{stroke:var(--accent);stroke-width:1.9}}
@keyframes sp-ping{0%{opacity:.9;transform:translate(${f(END[0])}px,${f(END[1])}px) scale(1)}100%{opacity:0;transform:translate(${f(END[0])}px,${f(END[1])}px) scale(3.2)}}
@media (prefers-reduced-motion: reduce){
  .sp-lane rect,.sp-rule,.sp-lane text,.sp-chev,.sp-fill,.sp-glyph{animation:none;opacity:1;}
  .sp-edge,.sp-shape,.sp-last .sp-shape{animation:none;stroke-dashoffset:0;opacity:1;}
  .sp-shape{stroke:var(--diagram-ink);}
  .sp-last .sp-shape{stroke:var(--accent);stroke-width:1.9;}
  .sp-tok{animation:none;opacity:1;transform:translate(${f(END[0])}px,${f(END[1])}px);}
  .sp-ping{display:none;}
}`.trim();

/* ── write the regions ── */
const swap = (file, begin, end, body) => {
  const p = path.join(ROOT, file);
  const src = fs.readFileSync(p, "utf8");
  const a = src.indexOf(begin), b = src.indexOf(end);
  if (a < 0 || b < a) throw new Error(`${file}: markers not found (${begin} … ${end})`);
  fs.writeFileSync(p, src.slice(0, a + begin.length) + "\n" + body + "\n" + src.slice(b));
};
swap("index.html", "<!-- splash:begin (generated by tools/make-splash.js; edit that, not this) -->", "<!-- splash:end -->", "  " + markup + "\n  ");
swap("styles.css", "/* splash:begin (generated by tools/make-splash.js; edit that, not this) */", "/* splash:end */", css);

const runEnd = T.run + T.runDur;
console.log(`route ${TOTAL.toFixed(0)} units, ${(TOTAL / T.runDur).toFixed(0)} units/s; payload arrives at ${runEnd.toFixed(2)}s`);
console.log(`markup ${markup.length} B, css ${css.length} B`);
console.log(`keep dismissSplash's minShow at or above ${Math.ceil((runEnd + 0.3) * 20) * 50} ms`);
