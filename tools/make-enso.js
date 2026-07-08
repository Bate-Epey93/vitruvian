#!/usr/bin/env node
/* Generate the app's enso stamps from EnsoKit's brush engine — the
   machine/human split: precision for the system (diagram), brushwork
   for the human moments (a gate earned, a study completed).
   Deterministic seeds → stable marks across rebuilds. */
const path = require("path");
const fs = require("fs");
const B = require(path.join(__dirname, "..", "..", "ensokit", "src", "brush.js"));

const OUT = path.join(__dirname, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });

const INK = "#141416", VERMILLION = "#D95B31";

// gate stamp: a single small open ring, ink — one stroke, one layer earned
const gate = B.svgWrap(
  B.motifSVGBody({ enso: { R: 34, w: 9, gap: 0.9 } }, "vitruvian-gate", INK),
  { size: 0 }
);
fs.writeFileSync(path.join(OUT, "enso-gate.svg"), gate);

// completion stamp: fuller ring + the vermillion seal dot (EnsoKit rule:
// seal sits bottom-right) — the whole study rebuilt
const complete = B.svgWrap(
  B.motifSVGBody({ enso: { R: 36, w: 11, gap: 0.6 } }, "vitruvian-complete", INK) +
  B.motifSVGBody({ d: [[72, 75, 5.5]] }, "vitruvian-seal", VERMILLION),
  { size: 0 }
);
fs.writeFileSync(path.join(OUT, "enso-complete.svg"), complete);

console.log("wrote assets/enso-gate.svg", gate.length, "bytes");
console.log("wrote assets/enso-complete.svg", complete.length, "bytes");
