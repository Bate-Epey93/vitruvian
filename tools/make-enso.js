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

/* ── Landing-card icons: four enso-brush marks, emitted as path-d arrays so
   content.js can inline them as currentColor SVG (themeable, no <img>). ── */
const ICONS = {
  // what it is — an enso opening up: bold ring, wide gap
  whatItIs: { enso: { R: 34, w: 11, gap: 1.25, rot: -1.1 } },
  // who it's for — a small cluster of people inside the ring
  whoFor: { enso: { R: 34, w: 8, gap: 0.8, rot: -1.4 }, d: [[39, 44, 5], [61, 44, 5], [50, 63, 5.5]] },
  // why it works — the struck insight: ring with a solid centre (◉)
  whyWorks: { enso: { R: 34, w: 9, gap: 0.65, rot: -1.2 }, d: [[50, 50, 7.5]] },
  // how to use it — a path/ascent brushed through the ring
  howTo: { enso: { R: 34, w: 8, gap: 0.9, rot: -1.3 }, s: [{ p: [[33, 63], [50, 50], [67, 37]], w: 6, taper: "both" }] }
};
const iconData = {};
for (const [k, motif] of Object.entries(ICONS)) {
  iconData[k] = B.motifContours(motif, "vitruvian-icon-" + k).map(B.toPathD);
}
fs.writeFileSync(path.join(OUT, "landing-icons.json"), JSON.stringify(iconData));
console.log("\n// paste into content.js as ENSO_ICONS:\nvar ENSO_ICONS = " + JSON.stringify(iconData) + ";");
