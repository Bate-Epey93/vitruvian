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

/* ── Repository lockstep checks (when invoked with no file arguments) ── */
if (process.argv.slice(2).length === 0) {
  const lockstepErrors = [];
  const swSrc = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const clSrc = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");

  // 1. Version lockstep across content.js, sw.js, CHANGELOG.md
  const swMatch = swSrc.match(/CACHE_VERSION\s*=\s*"vitruvian-v([^"]+)"/);
  const swVer = swMatch ? swMatch[1] : null;
  const clMatch = clSrc.match(/^##\s*\[([^\]]+)\]/m);
  const clVer = clMatch ? clMatch[1] : null;
  if (swVer !== CONFIG.appVersion)
    lockstepErrors.push(`sw.js CACHE_VERSION ("${swVer}") !== CONFIG.appVersion ("${CONFIG.appVersion}")`);
  if (clVer !== CONFIG.appVersion)
    lockstepErrors.push(`CHANGELOG.md top version ("${clVer}") !== CONFIG.appVersion ("${CONFIG.appVersion}")`);

  // 2. Flagships completeness across flagships/*.json, CONFIG.flagshipNames, sw.js SHELL, share/*.html
  const diskSlugs = fs.readdirSync(path.join(root, "flagships"))
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
  const cfgSlugs = new Set(CONFIG.flagshipNames);
  for (const s of diskSlugs) {
    if (!cfgSlugs.has(s)) lockstepErrors.push(`flagships/${s}.json is not listed in CONFIG.flagshipNames`);
    if (!swSrc.includes(`./flagships/${s}.json`)) lockstepErrors.push(`flagships/${s}.json is not precached in sw.js SHELL`);
    if (!fs.existsSync(path.join(root, "share", `${s}.html`))) lockstepErrors.push(`share/${s}.html is missing (run node tools/build-share-pages.js)`);
  }
  for (const s of cfgSlugs) {
    if (!diskSlugs.includes(s)) lockstepErrors.push(`CONFIG.flagshipNames entry "${s}" has no flagships/${s}.json`);
  }

  // 3. CSS custom property resolution across styles.css & lab/lab.css
  const cssFiles = ["styles.css", "lab/lab.css"];
  const defined = new Set(["--lane-c", "--pos", "--split-left", "--d", "--dx", "--dy"]);
  const cssContents = cssFiles.map(cssRel => ({
    cssRel,
    cssSrc: fs.readFileSync(path.join(root, cssRel), "utf8"),
  }));
  for (const { cssSrc } of cssContents) {
    for (const m of cssSrc.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1]);
  }
  for (const { cssRel, cssSrc } of cssContents) {
    for (const m of cssSrc.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)/g)) {
      if (!defined.has(m[1])) lockstepErrors.push(`${cssRel}: undefined CSS custom property ${m[1]}`);
    }
  }

  // 4. expands_to resolution summary across flagships
  const systemNames = new Set();
  const expandsTargets = [];
  for (const s of diskSlugs) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, "flagships", s + ".json"), "utf8"));
    systemNames.add(doc.meta.system.trim().toLowerCase());
    const allNodes = [...doc.visual.nodes, ...doc.layers.flatMap(L => L.diff.add_nodes)];
    for (const n of allNodes) {
      if (n.expands_to) expandsTargets.push({ from: s, node: n.id, target: n.expands_to });
    }
  }
  const resolvedCount = expandsTargets.filter(x => systemNames.has(x.target.trim().toLowerCase())).length;

  if (lockstepErrors.length) {
    failed = true;
    console.log(`✗ lockstep checks: ${lockstepErrors.length} error(s)`);
    lockstepErrors.forEach(e => console.log(`   · ${e}`));
  } else {
    console.log(`✓ lockstep: v${CONFIG.appVersion} synced, ${diskSlugs.length} flagships wired, CSS vars clean, ${resolvedCount}/${expandsTargets.length} expands_to resolve offline`);
  }
}

process.exit(failed ? 1 : 0);
