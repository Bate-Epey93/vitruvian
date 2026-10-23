#!/usr/bin/env node
/* Validation harness: node tools/validate.js [file.json ...]
   No args = validate every flagship. Loads the app's own
   content.js + skill.js + schema.js so there is exactly one
   validator — the browser's. */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

// The app files are classic scripts declaring globals with `var`;
// indirect eval lands those on globalThis.
for (const f of ["content.js", "voice.js", "skill.js", "schema.js"]) {
  (0, eval)(fs.readFileSync(path.join(root, f), "utf8"));
}

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(path.join(root, "flagships")).filter(f => f.endsWith(".json")).map(f => path.join("flagships", f));

let failed = false;
for (const t of targets) {
  const p = path.isAbsolute(t) ? t : path.join(root, t);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { console.log(`✗ ${t}: unparseable JSON — ${e.message}`); failed = true; continue; }
  const res = Schema.validate(doc, { strict: true });   // flagships are held to the full generation-quality bar
  // ...and to the house voice: the same lint the app runs on generated text
  res.errors = res.errors || [];
  Voice.lintDoc(doc).forEach(v => res.errors.push(`voice (${v.issues.map(i => i.label).join(", ")}) at ${v.path.join(".")}: "${v.issues[0].match}"`));
  if (res.errors.length) res.ok = false;
  if (res.ok) {
    const nodes = doc.visual.nodes.length + doc.layers.reduce((n, L) => n + L.diff.add_nodes.length, 0);
    const edges = doc.visual.edges.length + doc.layers.reduce((n, L) => n + L.diff.add_edges.length, 0);
    console.log(`✓ ${t}: valid — ${doc.layers.length} layers, ${nodes} nodes, ${edges} edges`);
  } else {
    failed = true;
    console.log(`✗ ${t}: ${res.errors.length} error(s)`);
    res.errors.forEach(e => console.log(`   · ${e}`));
  }
}
process.exit(failed ? 1 : 0);
