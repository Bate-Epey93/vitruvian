/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — ENGINE (§11)
   ───────────────────────────────────────────────────────────────
   App state, navigation, and the five surfaces: Library, Reader,
   Generation, Models index, Settings (+ the Studio bridge).
   Copy lives in content.js; storage in storage.js; rendering of
   breakdown documents in renderer-doc.js / renderer-diagram.js.
   All user/generated content goes through textContent — never
   innerHTML (§13).
   ═══════════════════════════════════════════════════════════════ */

/* ── tiny DOM helpers (shared grammar with renderer-doc) ── */
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function $(id) { return document.getElementById(id); }

/* Build an enso brush icon (inline currentColor SVG, so it themes light/dark)
   from ENSO_ICONS path data. CSP-safe: constructed via DOM, no innerHTML. */
function ensoIcon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  (ENSO_ICONS[name] || []).forEach(d => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
  });
  return svg;
}

let meta = {};                    // cached meta map
let currentView = null;           // DocView instance when reading
let currentRec = null;            // open breakdown record

// The reader mutates currentRec in place (attempts/progress) and debounces the
// IndexedDB write. On teardown — pagehide, tab background, PWA update reload —
// flush the live record so an answer typed within the debounce window survives.
async function flushSaves() {
  if (currentRec) await Store.saveBreakdownLight(currentRec);
}
window.addEventListener("pagehide", () => { flushSaves(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSaves(); });

/* ═══ Theme (light / dark toggle) ═══ */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("vitruvian_theme", t); } catch (e) {}   // splash.js reads this pre-paint on the next launch
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#0d0d10" : "#141416");
  const btn = $("themeBtn");
  if (btn) { btn.textContent = t === "dark" ? "☀" : "☾"; btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode"); }
}
async function toggleTheme() {
  const next = (document.documentElement.dataset.theme === "dark") ? "light" : "dark";
  applyTheme(next);
  meta.theme = next;
  await Store.saveMeta({ theme: next });
}

/* ═══ Screen switching ═══ */
const SCREENS = ["landing", "library", "reader", "generate", "models", "drill", "tutorial", "whatif", "settings"];
function show(screen) {
  SCREENS.forEach(s => { $("screen-" + s).hidden = s !== screen; });
  document.body.classList.toggle("reading", screen === "reader");   // frees topbar room for the audience switch
  $("audSwitch").hidden = screen !== "reader";
  $("readerMenuBtn").hidden = screen !== "reader";
  $("backBtn").hidden = screen === "library" || screen === "landing";
  $("menuPop").hidden = true;
  if (screen !== "reader") {
    if (currentView) currentView.destroy();   // cancel any pending debounce timer
    currentView = null; currentRec = null;
  }
}

/* ═══ Boot ═══ */
async function boot() {
  meta = await Store.init();
  // v1.3 migration: gates are now opt-in. Existing installs saved the old
  // default (true) at first run; flip them once to the new full-deconstruct
  // default. Deliberate re-enabling afterwards persists normally.
  if (!meta.challengeDefaultV2) {
    meta.challengeModeDefault = false;
    meta.challengeDefaultV2 = true;
    await Store.saveMeta({ challengeModeDefault: false, challengeDefaultV2: true });
  }
  // theme: saved choice wins; otherwise follow the OS on first run
  const initialTheme = meta.theme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme);
  await seedFlagships();
  wireTopbar();
  renderAudSwitch();
  // deep link: #/study/<slug> opens a library Deconstruct directly (share pages
  // land here). Only library studies have stable ids on every device.
  const deep = location.hash.match(/^#\/study\/([a-z0-9-]+)/);
  const deepRec = deep && (await Store.getBreakdown("flagship-" + deep[1]).catch(() => null));
  if (deepRec) {
    await renderLibrary();                // back button needs a library behind it
    openReader(deepRec.id);
  } else if (!meta.landingSeen) {
    renderLanding();
    show("landing");
  } else {
    await renderLibrary();
    show("library");
  }
  dismissSplash();
  window.dispatchEvent(new Event("sdc:ready"));
}

/* The splash (static HTML in index.html) stays up until the first screen has
   rendered, but never less than long enough for the enso stroke + seal to
   land — and reduced-motion users aren't made to wait for choreography. */
function dismissSplash() {
  const sp = document.getElementById("splash");
  if (!sp) return;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const minShow = reduced ? 300 : 1350;
  setTimeout(() => {
    sp.classList.add("splash-hide");
    setTimeout(() => sp.remove(), 450);
  }, Math.max(0, minShow - performance.now()));
}

async function seedFlagships() {
  // Re-seed whenever the shipped flagship content version changes, so existing
  // installs receive updated flagships — preserving each one's attempts/progress.
  if (meta.flagshipVersion === CONFIG.flagshipVersion) return;
  const names = CONFIG.flagshipNames;
  const prev = {};
  (await Store.getBreakdowns()).forEach(b => { if (b.source === "flagship") prev[b.id] = b; });
  let okCount = 0;
  for (const n of names) {
    try {
      const res = await fetch("flagships/" + n + ".json", { cache: "no-cache" });  // revalidate: pick up content updates
      if (!res.ok) continue;
      const doc = await res.json();
      if (!Schema.validate(doc).ok) continue;
      const id = "flagship-" + n, was = prev[id];
      await Store.saveBreakdown({
        id, system: doc.meta.system, source: "flagship", schemaVersion: 1, doc,
        created: was ? was.created : Date.now(),
        lastOpen: was ? was.lastOpen : undefined,
        challengeMode: was ? was.challengeMode : undefined,
        attempts: was ? was.attempts : {},
        progress: was ? was.progress : { layersRead: 0, gatesAnswered: 0, position: 0 }
      });
      okCount++;
    } catch (e) { /* offline first-open of a partial cache: retry next boot */ }
  }
  // Only advance the version when ALL flagships seeded — a partial seed (e.g. one
  // fetch dropped) must retry next boot, not strand a missing/stale flagship.
  if (okCount === names.length) {
    meta.flagshipVersion = CONFIG.flagshipVersion;
    meta.flagshipsSeeded = true;
    await Store.saveMeta({ flagshipVersion: CONFIG.flagshipVersion, flagshipsSeeded: true });
  }
}

/* ═══ Topbar ═══ */
function wireTopbar() {
  $("brand").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("backBtn").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("modelsBtn").onclick = () => { renderModels(); show("models"); };
  $("drillBtn").onclick = () => { renderDrill(); show("drill"); };
  $("settingsBtn").onclick = () => { renderSettings(); show("settings"); };
  $("themeBtn").onclick = () => toggleTheme();
  $("readerMenuBtn").onclick = e => { e.stopPropagation(); $("menuPop").hidden = !$("menuPop").hidden; };
  document.addEventListener("click", () => { $("menuPop").hidden = true; });
}

function renderAudSwitch() {
  const box = $("audSwitch");
  box.textContent = "";
  COPY.audienceModes.forEach(m => {
    const b = h("button", meta.audienceMode === m.id ? "on" : "");
    b.append(h("span", "aud-full", m.label), h("span", "aud-abbr", m.label[0]));  // full text ↔ single letter on mobile
    b.setAttribute("aria-label", m.label);
    b.onclick = async () => {
      meta.audienceMode = m.id;
      await Store.saveMeta({ audienceMode: m.id });
      renderAudSwitch();
      if (currentView) currentView.setAudience(m.id);
    };
    box.appendChild(b);
  });
}

/* ═══ Landing (first-run explainer, §value-add) ═══ */

/* Deconstructed enso — the landing's living background. The brush ring is
   taken apart: its arcs drift out from the centre, the Vitruvian square
   splits into corner brackets, one vermillion dot holds still. Motion is a
   slow rotation of the exploded parts (the app's own idea: separation you
   can see), disabled under prefers-reduced-motion. Pure decoration:
   aria-hidden, pointer-events none, behind the copy. */
function landingMotif() {
  const arc = (cx, cy, r, a0, a1, w, spread) => {
    // arc of a circle, its midpoint pushed OUT from the centre by `spread`
    const mid = ((a0 + a1) / 2) * Math.PI / 180;
    const ox = Math.cos(mid) * spread, oy = Math.sin(mid) * spread;
    const p0 = [cx + ox + r * Math.cos(a0 * Math.PI / 180), cy + oy + r * Math.sin(a0 * Math.PI / 180)];
    const p1 = [cx + ox + r * Math.cos(a1 * Math.PI / 180), cy + oy + r * Math.sin(a1 * Math.PI / 180)];
    const path = svgNS("path", {
      d: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1[0]} ${p1[1]}`,
      fill: "none", "stroke-width": w, "stroke-linecap": "round"
    });
    path.style.stroke = "currentColor";
    return path;
  };
  const bracket = (x, y, len, dx, dy) => {           // one pulled-apart square corner
    const b = svgNS("path", { d: `M ${x + dx * len} ${y + dy} H ${x + dx} V ${y + dy * len}`, fill: "none", "stroke-width": 7, "stroke-linecap": "square" });
    b.style.stroke = "currentColor";
    return b;
  };
  const svg = svgNS("svg", { class: "landing-motif", viewBox: "0 0 1000 1000", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" });

  const big = svgNS("g", { class: "lm-spin" });      // exploded enso, upper right
  big.appendChild(arc(780, 210, 190, -50, 75, 24, 0));
  big.appendChild(arc(780, 210, 190, 95, 195, 15, 22));
  big.appendChild(arc(780, 210, 190, 215, 285, 9, 44));
  svg.appendChild(big);

  const sq = svgNS("g", { class: "lm-float" });      // the square, split at its corners
  sq.appendChild(bracket(700, 130, 46, 1, 1));
  sq.appendChild(bracket(900, 130, 46, -1, 1));
  sq.appendChild(bracket(700, 330, 46, 1, -1));
  sq.appendChild(bracket(900, 330, 46, -1, -1));
  svg.appendChild(sq);

  const seal = svgNS("circle", { cx: 892, cy: 372, r: 11, class: "lm-seal" });
  svg.appendChild(seal);

  const small = svgNS("g", { class: "lm-spin-counter" });   // quieter echo, lower left
  small.appendChild(arc(120, 840, 110, 30, 165, 13, 0));
  small.appendChild(arc(120, 840, 110, 190, 300, 8, 18));
  svg.appendChild(small);

  return svg;
}

function renderLanding() {
  const root = $("screen-landing").firstElementChild;
  root.textContent = "";
  const L = COPY.landing;
  root.appendChild(landingMotif());
  root.appendChild(h("div", "kicker", L.kicker));
  const head = h("h1", "landing-head");
  L.headline.split("\n").forEach((line, i) => { if (i) head.appendChild(document.createElement("br")); head.appendChild(document.createTextNode(line)); });
  root.appendChild(head);
  root.appendChild(h("p", "landing-lede", L.lede));

  const grid = h("div", "landing-grid");
  L.sections.forEach(s => {
    const card = h("div", "landing-card");
    const hd = h("div", "lc-head");
    const ic = h("span", "lc-icon");
    ic.appendChild(ensoIcon(s.icon));
    hd.appendChild(ic);
    hd.appendChild(h("span", "lc-title", s.title));
    card.appendChild(hd);
    card.appendChild(h("p", null, s.body));
    grid.appendChild(card);
  });
  root.appendChild(grid);

  const cta = h("button", "big-btn landing-cta", L.cta);
  cta.onclick = async () => {
    await Store.saveMeta({ landingSeen: true });
    meta.landingSeen = true;
    await renderLibrary();
    show("library");
  };
  root.appendChild(cta);
  const learn = h("button", "gbtn", "How to read a Deconstruct →");
  learn.style.marginLeft = "8px";
  learn.onclick = () => { renderTutorial("landing"); show("tutorial"); };
  cta.after(learn);
  root.appendChild(h("p", "landing-foot", L.footnote));
}

/* ═══ Tutorial — 'How to read a study' (visitable anytime) ═══ */
function svgNS(tag, attrs) {
  const NS = "http://www.w3.org/2000/svg";
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function nodeSwatch(kind) {                       // mini shape echoing the diagram's node kinds
  const s = svgNS("svg", { viewBox: "0 0 46 30", class: "tut-swatch" });
  const stroke = "#2f6f5e";
  if (kind === "actor") { const c = svgNS("circle", { cx: 23, cy: 15, r: 10, fill: "var(--node-fill)" }); c.style.stroke = stroke; c.style.strokeWidth = 1.6; s.appendChild(c); }
  else if (kind === "store") {
    s.appendChild(svgNS("rect", { x: 7, y: 6, width: 32, height: 18, fill: "var(--node-fill)", stroke: "none" }));
    const p = svgNS("path", { d: "M7 6 L7 24 L39 24 L39 6", fill: "none" }); p.style.stroke = stroke; p.style.strokeWidth = 1.6; s.appendChild(p);
  } else if (kind === "channel") { const r = svgNS("rect", { x: 7, y: 6, width: 32, height: 18, rx: 9, fill: "var(--node-fill)" }); r.style.stroke = stroke; r.style.strokeWidth = 1.6; s.appendChild(r); }
  else { const r = svgNS("rect", { x: 7, y: 6, width: 32, height: 18, rx: 2, fill: "var(--node-fill)" }); r.style.stroke = stroke; r.style.strokeWidth = 1.6; s.appendChild(r); }
  return s;
}
function edgeSwatch(kind) {                       // mini arrow echoing the diagram's edge kinds
  const s = svgNS("svg", { viewBox: "0 0 50 16", class: "tut-swatch tut-swatch-edge" });
  const color = kind === "money" ? "#9a6212" : kind === "control" ? "#141416" : "#2f6f5e";
  const dash = kind === "money" ? "1.5 3.5" : kind === "control" ? "5 4" : "0";
  const ln = svgNS("line", { x1: 3, y1: 8, x2: 40, y2: 8 });
  ln.style.stroke = color; ln.style.strokeWidth = kind === "payload" ? 2.2 : 1.6; if (dash !== "0") ln.style.strokeDasharray = dash;
  s.appendChild(ln);
  const head = svgNS("path", { d: "M40 8 L34 5 L34 11 Z", fill: color });
  s.appendChild(head);
  return s;
}
function renderTutorial(from) {
  // capture the return target NOW — show("tutorial") will null currentRec
  const returnId = (from === "reader" && currentRec) ? currentRec.id : null;
  const root = $("screen-tutorial").firstElementChild;
  root.textContent = "";
  const T = COPY.tutorial;
  const back = h("button", "gbtn", returnId ? "‹ Back to the Deconstruct" : "‹ Back");
  back.onclick = () => {
    if (returnId) { openReader(returnId); }
    else if (from === "landing") { renderLanding(); show("landing"); }
    else { renderSettings(); show("settings"); }
  };
  root.appendChild(back);
  root.appendChild(h("div", "kicker", T.kicker));
  root.appendChild(h("h1", "title", T.headline));
  root.appendChild(h("p", "subtitle", T.lede));

  // The path
  root.appendChild(h("h2", "section-head", T.reading.title));
  const steps = h("div", "principles");
  T.reading.steps.forEach(([name, desc]) => {
    const row = h("div", "principle");
    const b = h("span"); b.appendChild(h("b", null, name + ": ")); b.appendChild(document.createTextNode(desc));
    row.appendChild(b);
    steps.appendChild(row);
  });
  root.appendChild(steps);

  // The cards
  root.appendChild(h("h2", "section-head", T.cards.title));
  root.appendChild(h("p", "lib-note", T.cards.note));
  T.cards.items.forEach(([key, title, desc]) => {
    const row = h("div", "tut-row");
    row.appendChild(h("span", "tut-chip tut-chip-" + key));
    const tx = h("div");
    tx.appendChild(h("div", "tut-row-title", title));
    tx.appendChild(h("p", "tut-row-desc", desc));
    row.appendChild(tx);
    root.appendChild(row);
  });

  // The diagram legend
  root.appendChild(h("h2", "section-head", T.diagram.title));
  root.appendChild(h("p", "lib-note", T.diagram.intro));
  const nodeLeg = h("div", "tut-legend");
  T.diagram.nodeKinds.forEach(([kind, name, desc]) => {
    const item = h("div", "tut-legend-item");
    item.appendChild(nodeSwatch(kind));
    const tx = h("div"); tx.appendChild(h("b", null, name)); tx.appendChild(document.createTextNode(": " + desc));
    item.appendChild(tx);
    nodeLeg.appendChild(item);
  });
  root.appendChild(nodeLeg);
  const edgeLeg = h("div", "tut-legend");
  T.diagram.edgeKinds.forEach(([kind, name, desc]) => {
    const item = h("div", "tut-legend-item");
    item.appendChild(edgeSwatch(kind));
    const tx = h("div"); tx.appendChild(h("b", null, name)); tx.appendChild(document.createTextNode(": " + desc));
    item.appendChild(tx);
    edgeLeg.appendChild(item);
  });
  root.appendChild(edgeLeg);
  T.diagram.extra.forEach(([name, desc]) => {
    const row = h("div", "tut-row");
    const tx = h("div"); tx.appendChild(h("div", "tut-row-title", name)); tx.appendChild(h("p", "tut-row-desc", desc));
    row.appendChild(tx);
    root.appendChild(row);
  });

  // Controls
  root.appendChild(h("h2", "section-head", T.controls.title));
  T.controls.items.forEach(([name, desc]) => {
    const row = h("div", "tut-row");
    const tx = h("div"); tx.appendChild(h("div", "tut-row-title", name)); tx.appendChild(h("p", "tut-row-desc", desc));
    row.appendChild(tx);
    root.appendChild(row);
  });

  // For developers
  const dev = h("div", "dev-box");
  dev.style.marginTop = "26px";
  dev.appendChild(h("div", "db-label", T.forDev.title));
  dev.appendChild(h("p", "tut-dev-intro", T.forDev.intro));
  T.forDev.map.forEach(([from2, to2]) => {
    const row = h("div", "dev-map");
    row.appendChild(h("span", "dm-mech", from2));
    row.appendChild(h("span", "dm-arrow", "→"));
    row.appendChild(h("span", "dm-sw", to2));
    dev.appendChild(row);
  });
  root.appendChild(dev);

  const cta = h("button", "big-btn", T.cta);
  cta.style.marginTop = "24px";
  cta.onclick = back.onclick;
  root.appendChild(cta);
}

/* ═══ Library ═══ */
function sectionHead(title, sub) {
  const wrap = h("div", "lib-section-head");
  wrap.appendChild(h("h2", "lib-section-title", title));
  if (sub) wrap.appendChild(h("span", "lib-section-sub", sub));
  return wrap;
}
function cardGrid(recs) {
  const grid = h("div", "card-grid");
  recs.forEach(rec => {
    const card = h("button", "bd-card");
    card.appendChild(h("div", "bd-name", rec.system));
    const metaRow = h("div", "bd-meta");
    const chipCls = rec.source === "flagship" ? " flagship" : (rec.source === "design" ? " design" : "");
    const chipLabel = rec.source === "flagship" ? "sample" : (rec.source === "design" ? "your design" : "your deconstruct");
    metaRow.appendChild(h("span", "chip" + chipCls, chipLabel));
    metaRow.appendChild(h("span", "chip", rec.doc.layers.length + " layers"));
    card.appendChild(metaRow);
    const foot = h("div", "bd-foot");
    const n = rec.doc.layers.length;
    const done = rec.doc.layers.filter(L => rec.attempts[L.index] && rec.attempts[L.index].revealed).length;
    const pct = Math.round(100 * done / n);
    foot.appendChild(h("span", "bd-last", rec.lastOpen ? "opened " + timeAgo(rec.lastOpen) : "new"));
    if (pct === 100) {
      const stamp = h("img", "enso-stamp card-stamp");
      stamp.src = "assets/enso-complete.svg";
      stamp.alt = "Deconstruct complete";
      foot.appendChild(stamp);
    } else {
      const ring = h("div", "ring");
      ring.style.background = `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--line-soft) 0deg)`;
      ring.appendChild(h("span", null, pct + ""));
      foot.appendChild(ring);
    }
    card.appendChild(foot);
    card.onclick = () => openReader(rec.id);
    grid.appendChild(card);
  });
  return grid;
}

async function renderLibrary() {
  const root = $("screen-library").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", CONFIG.tagline));
  root.appendChild(h("h1", "title", "What do you want to understand?"));

  const bar = h("div", "deconstruct-bar");
  const input = h("input");
  input.id = "deconInput";
  input.placeholder = COPY.deconstructPlaceholder;
  input.maxLength = 120;
  const go = h("button", "big-btn", COPY.deconstructBtn);
  const launch = () => {
    const name = input.value.trim();
    if (!name) return;
    if (!meta.apiKey) {
      renderSettings("Add your Anthropic API key to generate Deconstructs.");
      show("settings");
      return;
    }
    renderGenerate(name);
    show("generate");
  };
  go.onclick = launch;
  input.onkeydown = e => { if (e.key === "Enter") launch(); };
  bar.append(input, go);
  root.appendChild(bar);

  // second path: deconstruct a design you're building (not a known system)
  const ownLink = h("button", "gbtn own-design-btn", COPY.ownDesignLink);
  ownLink.onclick = () => {
    if (!meta.apiKey) { renderSettings("Add your Anthropic API key to generate Deconstructs."); show("settings"); return; }
    renderGenerate("", "design");
    show("generate");
  };
  root.appendChild(ownLink);

  const all = (await Store.getBreakdowns()).sort((a, b) => (b.lastOpen || b.created) - (a.lastOpen || a.created));
  const flagships = all.filter(b => b.source === "flagship");
  const yours = all.filter(b => b.source !== "flagship");

  // Your own studies first (once you have any), then the samples below.
  if (yours.length) {
    root.appendChild(sectionHead(COPY.yoursHeading, yours.length + " stud" + (yours.length > 1 ? "ies" : "y")));
    root.appendChild(cardGrid(yours));
  }
  root.appendChild(sectionHead(COPY.sampleHeading, null));
  root.appendChild(h("p", "lib-note", COPY.sampleNote));
  root.appendChild(cardGrid(flagships));
  if (!yours.length) {
    const empty = h("div", "empty-panel");
    empty.appendChild(h("div", "mono-label", COPY.yoursHeading));
    empty.appendChild(h("p", null, COPY.yoursEmpty));
    root.appendChild(empty);
  }

  // quiet foundation of future sharing: single-breakdown import
  const importRow = h("div", "gate-actions");
  importRow.style.marginTop = "26px";
  const imp = h("button", "gbtn", "Import a Deconstruct (.json)");
  imp.onclick = () => pickFile(async file => {
    try {
      const doc = JSON.parse(await file.text());
      const res = Schema.validate(doc);
      if (!res.ok) { alert("Not a valid Deconstruct:\n" + res.errors.slice(0, 6).join("\n")); return; }
      await Store.saveBreakdown({
        id: "imp_" + Date.now(), system: doc.meta.system, created: Date.now(),
        source: "generated", schemaVersion: 1, doc,
        attempts: {}, progress: { layersRead: 0, gatesAnswered: 0, position: 0 }
      });
      await renderLibrary();
      toast("Imported: " + doc.meta.system);
    } catch (e) { alert("Could not import: " + e.message); }
  });
  importRow.appendChild(imp);
  const about = h("button", "gbtn", "About Vitruvian");
  about.onclick = () => { renderLanding(); show("landing"); };
  importRow.appendChild(about);
  /* Request-a-system link hidden for now — restore by re-appending req.
  const req = h("a", "gbtn", COPY.requestLink);   // demand signal, no backend: a GitHub issue
  req.href = CONFIG.repoUrl + "/issues/new?template=request-a-system.md&title=Deconstruct%3A+";
  req.target = "_blank";
  req.rel = "noopener";
  importRow.appendChild(req);
  */
  root.appendChild(importRow);
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 3600e3) return Math.max(1, Math.round(d / 60e3)) + "m ago";
  if (d < 86400e3) return Math.round(d / 3600e3) + "h ago";
  return Math.round(d / 86400e3) + "d ago";
}
function pickFile(onFile) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.onchange = () => { if (inp.files[0]) onFile(inp.files[0]); };
  inp.click();
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function toast(msg) {
  const t = $("saveToast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ═══ Reader ═══ */
async function openReader(id, layerIndex) {
  const rec = await Store.getBreakdown(id);
  if (!rec) return;
  if (currentView) currentView.destroy();   // re-open (e.g. from Models index) skips show()'s teardown
  currentRec = rec;
  rec.lastOpen = Date.now();
  await Store.saveBreakdownLight(rec);
  await Store.saveMeta({ lastOpenBreakdown: id });
  meta.lastOpenBreakdown = id;

  const pane = $("screen-reader");
  pane.textContent = "";
  const wrap = h("div", "reader");
  const dpane = h("div", "diagram-pane");
  const dscroll = h("div", "diagram-scroll");
  const dcap = h("div", "diagram-cap");
  const capState = h("span", "diagram-cap-state", "");
  const capToggle = h("button", "gbtn", "hide");
  capToggle.style.padding = "2px 9px";
  capToggle.onclick = () => {
    dpane.classList.toggle("collapsed");
    capToggle.textContent = dpane.classList.contains("collapsed") ? "show" : "hide";
  };
  const playBtn = h("button", "gbtn sim-btn", "▶ pulse");
  const loadBtn = h("button", "gbtn sim-btn", "◉ load");
  const replayBtn = h("button", "gbtn sim-btn", "⟲ replay");
  const raceBtn = h("button", "gbtn sim-btn", "⇉ races");
  raceBtn.title = "Highlight nodes with two or more concurrent writers — where races can happen";
  loadBtn.hidden = true;
  dcap.append(capState, playBtn, loadBtn, replayBtn, raceBtn, capToggle);
  const scrubEl = h("div", "scrub-wrap");
  const caption = h("div", "dg-caption");
  caption.hidden = true;
  // live HUD: throughput / in-flight / crashed while the sim runs
  const hud = h("div", "dg-hud");
  hud.hidden = true;
  const hudRate = h("span", "hud-stat"), hudFlight = h("span", "hud-stat"), hudCrash = h("span", "hud-stat crash"), hudHint = h("span", "hud-hint", "tap any node to kill it");
  hud.append(hudRate, hudFlight, hudCrash, hudHint);
  dpane.append(dscroll, hud, caption, Diagram.legend(), scrubEl, dcap);   // legend: the tutorial's grammar, always in view
  const docPane = h("div", "doc-pane");
  wrap.append(dpane, docPane);
  pane.appendChild(wrap);

  const diagram = Diagram.mount(dscroll, rec.doc);

  /* flow simulation controls — instant response on press; any state change
     stops the sim (via diagram.show) and this resets the buttons */
  let captionTimer = null;
  const resetSimUI = () => {
    playBtn.textContent = "▶ pulse";
    loadBtn.hidden = true;
    loadBtn.classList.remove("on");
    hud.hidden = true;
  };
  diagram.sim.onStop(resetSimUI);
  diagram.sim.onStats(s => {
    hudRate.textContent = "▸ " + s.perMin + "/min";
    hudFlight.textContent = "◦ " + s.inFlight + " in flight";
    hudCrash.textContent = "✕ " + s.crashed + (s.faults ? " · ☠ " + s.faults + " down" : "");
    hudCrash.classList.toggle("lit", s.crashed > 0);
  });
  if (!diagram.sim.available) { playBtn.hidden = true; replayBtn.hidden = true; }   // prefers-reduced-motion
  playBtn.onclick = () => {
    if (diagram.sim.running) { diagram.sim.stop(); }
    else if (diagram.sim.start()) {
      playBtn.textContent = "⏸ rest";
      loadBtn.hidden = false;
      hud.hidden = false;
    }
  };
  loadBtn.onclick = () => {
    loadBtn.classList.toggle("on", diagram.sim.toggleLoad());
  };
  // race spotlight: ring nodes with ≥2 concurrent payload writers (contention
  // points). Structural — works standing still; under ◉ load you watch tokens
  // actually collide there. Toggle off clears the rings.
  let raceOn = false;
  raceBtn.onclick = () => {
    raceOn = !raceOn;
    const n = diagram.raceSpotlight(raceOn);
    raceBtn.classList.toggle("race-on", raceOn);
    if (raceOn) toast(n ? `${n} contention point${n > 1 ? "s" : ""} — ≥2 concurrent writers` : "No contention at this state — one writer per node");
  };
  // scripted incident: two tokens run into the gate's failure, seconds apart.
  // The caption tells the reader what history they just watched.
  diagram.sim.onReplayCrash(() => {
    const p = currentView ? currentView.position : 0;
    const L = rec.doc.layers[p - 1];
    let text = "The failure, replayed — the second arrival meets the first.";
    if (L && L.problem && L.problem.statement) {
      const s = L.problem.statement.split(". ")[0];
      text = (s.length > 150 ? s.slice(0, 147) + "…" : s) + (s.endsWith(".") ? "" : ".");
    }
    caption.textContent = text;
    caption.hidden = false;
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { caption.hidden = true; }, 7000);
  });
  replayBtn.onclick = () => {
    if (diagram.sim.running) diagram.sim.stop();
    caption.hidden = true;
    // rewind to the moment before this layer's fix: pre-state + its failure
    // lit red — then send history's two payloads into it
    const p = currentView ? currentView.position : 0;
    const L = rec.doc.layers[p - 1];
    if (!L || !L.diff.highlight.length) { toast("No failure at this position — step into a rebuild layer"); return; }
    diagram.show(p - 1, { highlight: L.diff.highlight });
    capState.textContent = `Before layer ${p} · the failure, replayed`;
    if (!diagram.sim.replay()) {
      currentView.goToLayer(p);
      toast("No payload path reaches this failure");
    } else { playBtn.textContent = "⏸ rest"; hud.hidden = false; }
  };

  // gates are opt-in: on only if this breakdown enabled them, or the user set the default on
  const challengeOn = rec.challengeMode != null ? rec.challengeMode : meta.challengeModeDefault === true;

  currentView = DocView.mount({
    docPane, diagram, rec, scrubEl,
    audience: meta.audienceMode || "enthusiast",
    challenge: challengeOn,
    onSave(r) { Store.saveBreakdownLight(r); },
    canCompare() {
      if (!navigator.onLine) return { ok: false, reason: "You're offline. " + COPY.gateCompareOffline };
      if (!meta.apiKey) return { ok: false, reason: "No API key set. " + COPY.gateCompareOffline };
      return { ok: true };
    },
    onCompare(layer, attempt) {
      return Generator.compare({ apiKey: meta.apiKey, modelId: meta.modelId, layer, attempt });
    },
    onAsk(layer, question) {
      return Generator.ask({ apiKey: meta.apiKey, modelId: meta.modelId, doc: rec.doc, layer, question });
    }
  });

  buildReaderMenu(rec, challengeOn);
  show("reader");
  if (layerIndex != null) currentView.goToLayer(layerIndex);
}

/* ═══ Branded diagram export: current diagram state → PNG with the Vitruvian
   mark and URL in a footer bar, so every shared screenshot carries the brand.
   The SVG's classed styles live in styles.css, which a serialized SVG can't
   see — so computed styles are inlined onto a clone first. Fonts inside an
   SVG-as-image never load; labels get a system mono stack instead. ═══ */
async function exportDiagramPNG(rec) {
  const svgEl = document.querySelector("#screen-reader .dg-svg");
  if (!svgEl) { toast("Open the diagram first"); return; }
  const clone = svgEl.cloneNode(true);
  const src = [svgEl, ...svgEl.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  const PROPS = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "fill", "fill-opacity", "opacity", "font-size", "font-weight", "letter-spacing", "paint-order"];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v); });
    if (el.tagName === "text" || el.tagName === "tspan")
      dst[i].style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.width = ""; clone.style.minWidth = "";

  const vb = svgEl.viewBox.baseVal;
  const SCALE = 2, FOOT = 30 * SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = vb.width * SCALE;
  canvas.height = vb.height * SCALE + FOOT;
  const ctx = canvas.getContext("2d");
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#f7f4ed";
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#211e19";
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const svgData = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, vb.height * SCALE); resolve(); };
    img.onerror = reject;
    img.src = svgData;
  }).catch(() => { toast("Export failed. Try again"); });

  // footer: hairline, the circle-and-square mark, system name + URL
  const fy = vb.height * SCALE;
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.25; ctx.lineWidth = SCALE;
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(canvas.width, fy); ctx.stroke();
  ctx.globalAlpha = 1;
  const mS = 13 * SCALE, mX = 10 * SCALE, mY = fy + (FOOT - mS) / 2;
  ctx.lineWidth = 1.6 * SCALE; ctx.strokeStyle = "#0e7a63";
  ctx.strokeRect(mX, mY, mS, mS);
  ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.arc(mX + mS / 2, mY + mS / 2, mS * 0.62, -0.6 * Math.PI, 1.15 * Math.PI); ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `${10 * SCALE}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(rec.system.toUpperCase() + " · VITRUVIAN · " + CONFIG.siteUrl.replace(/^https:\/\//, "").replace(/\/$/, ""), mX + mS + 8 * SCALE, fy + FOOT / 2);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = rec.system.replace(/\W+/g, "-").toLowerCase() + "-diagram.png";
  a.click();
  toast("Diagram exported");
}

/* ═══ Sequence view: the diagram's behavioural companion — the current state's
   interactions ordered top-to-bottom (who sends what, in what order). Opens as
   a dismissible overlay so it never disturbs the structural diagram. ═══ */
function openSequence(rec) {
  const N = rec.doc.layers.length;
  // mirror EXACTLY what the diagram is showing — shownUpto is gate-aware
  // (pos-1 for an un-revealed challenge layer), so the sequence can't spoil a gate
  const shown = currentView && currentView.shownUpto != null ? currentView.shownUpto : (currentView ? currentView.position : 0);
  const upto = Math.max(0, Math.min(shown, N));
  const label = upto === 0 ? "Baseline — the naive system" : upto >= N ? "Final system · after every layer" : `After layer ${upto} of ${N}`;

  const ov = h("div", "seq-overlay");
  const bar = h("div", "seq-bar");
  const titleWrap = h("div");
  titleWrap.appendChild(h("h2", null, "Sequence — " + rec.system));
  titleWrap.appendChild(h("div", "seq-sub", label + " · order flows top to bottom"));
  const close = h("button", "gbtn seq-close", "✕ close");
  bar.append(titleWrap, close);
  const scroll = h("div", "seq-scroll");
  scroll.appendChild(Diagram.sequence(rec.doc, upto));
  ov.append(bar, scroll);
  document.body.appendChild(ov);

  const dismiss = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") dismiss(); };
  close.onclick = dismiss;
  ov.addEventListener("click", e => { if (e.target === ov) dismiss(); });
  document.addEventListener("keydown", onKey);
}

function buildReaderMenu(rec, challengeOn) {
  const pop = $("menuPop");
  pop.textContent = "";
  const add = (label, fn, cls) => {
    const b = h("button", cls || "", label);
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    pop.appendChild(b);
  };
  add(COPY.whatifMenu, () => { renderWhatif(rec); show("whatif"); });
  add("Sequence view (interaction order)", () => openSequence(rec));
  add("How to read a Deconstruct", () => { renderTutorial("reader"); show("tutorial"); });
  add((challengeOn ? "✓ " : "") + "Challenge mode (gates)", async () => {
    rec.challengeMode = !challengeOn;
    await Store.saveBreakdownLight(rec);
    openReader(rec.id);
  });
  pop.appendChild(h("div", "menu-sep"));
  add(COPY.shareMenu, async () => {
    if (rec.source !== "flagship") { toast(COPY.shareLocalNote); return; }
    const url = CONFIG.siteUrl + "#/study/" + rec.id.replace("flagship-", "");
    try { await navigator.clipboard.writeText(url); toast(COPY.shareCopied); }
    catch (e) { prompt("Copy this link:", url); }
  });
  add(COPY.exportPngMenu, () => exportDiagramPNG(rec));
  add("Export Deconstruct .json", () => {
    download(rec.system.replace(/\W+/g, "-").toLowerCase() + ".json", JSON.stringify(rec.doc, null, 2));
  });
  add("Use as reference in UX-First Studio", async () => {
    try {
      await navigator.clipboard.writeText(bridgeNotes(rec.doc));
      toast(COPY.bridgeToast);
    } catch (e) { alert("Clipboard unavailable. Export the .json instead."); }
  });
  pop.appendChild(h("div", "menu-sep"));
  add("Delete this Deconstruct", async () => {
    if (!confirm(`Delete "${rec.system}" and its attempts? This cannot be undone.`)) return;
    await Store.deleteBreakdown(rec.id);
    await renderLibrary();
    show("library");
  }, "danger");
}

/* ═══ What-if — propose a change; verdict + ghosted architecture (§value-add) ═══ */
function renderWhatif(rec, opts = {}) {
  const root = $("screen-whatif").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", COPY.whatifKicker + " · " + rec.system));
  root.appendChild(h("h1", "title", "Propose a change"));
  root.appendChild(h("p", "subtitle", COPY.whatifLede));

  const backRow = h("div", "gate-actions");
  const backBtn2 = h("button", "gbtn", "‹ Back to the Deconstruct");
  backBtn2.onclick = () => openReader(rec.id);
  backRow.appendChild(backBtn2);
  root.appendChild(backRow);

  const compose = h("div", "whatif-compose");
  const ta = h("textarea", "design-input");
  ta.placeholder = COPY.whatifPlaceholder;
  ta.maxLength = 280;
  ta.style.minHeight = "70px";
  if (opts.prefill) ta.value = opts.prefill;
  const runBtn = h("button", "big-btn", COPY.whatifBtn);
  compose.append(ta, runBtn);
  root.appendChild(compose);

  const resultEl = h("div", "whatif-result");
  root.appendChild(resultEl);
  const savedWrap = h("div", "whatif-saved");
  root.appendChild(savedWrap);

  function renderSaved() {
    savedWrap.textContent = "";
    const list = rec.whatifs || [];
    if (!list.length) return;
    savedWrap.appendChild(h("div", "mono-label", "Earlier grafts"));
    list.slice().reverse().forEach((wi, i) => {
      const row = h("button", "whatif-saved-row");
      row.appendChild(h("span", "ws-dot verdict-" + wi.result.verdict));
      row.appendChild(h("span", "ws-change", wi.change));
      row.onclick = () => { showResult(wi.result, wi.change); resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); };
      savedWrap.appendChild(row);
    });
  }

  function showResult(w, change) {
    resultEl.textContent = "";
    // ghost diagram: the study's final state + the proposal as one extra layer
    const tempDoc = { ...rec.doc, layers: [...rec.doc.layers, {
      index: rec.doc.layers.length + 1, name: w.name || "Proposed change",
      diff: { add_nodes: w.diff.add_nodes, add_edges: w.diff.add_edges, highlight: [], remove: [] }
    }] };
    const dpane = h("div", "whatif-diagram");
    const dscroll = h("div", "diagram-scroll");
    dpane.appendChild(dscroll);
    resultEl.appendChild(dpane);
    const dg = Diagram.mount(dscroll, tempDoc);
    const ghostIds = [...w.diff.add_nodes.map(n => n.id), ...w.diff.add_edges.map(e => e.id)];
    const showGraft = on => {
      if (on) dg.show(tempDoc.layers.length, { ghost: ghostIds, stress: w.diff.highlight });
      else dg.show(rec.doc.layers.length);
    };
    showGraft(true);
    setTimeout(() => dg.focus(ghostIds.length ? ghostIds : w.diff.highlight), 60);

    // live graft: A/B the proposal on and off; pulse tokens THROUGH it —
    // proposed payload edges are part of the shown state, so they carry flow
    const ctl = h("div", "whatif-sim-row");
    const abBtn = h("button", "gbtn sim-btn on", "graft: on");
    let graftOn = true;
    abBtn.onclick = () => {
      graftOn = !graftOn;
      abBtn.textContent = "graft: " + (graftOn ? "on" : "off");
      abBtn.classList.toggle("on", graftOn);
      showGraft(graftOn);
    };
    ctl.appendChild(abBtn);
    if (dg.sim.available) {
      const wp = h("button", "gbtn sim-btn", "▶ pulse");
      const wl = h("button", "gbtn sim-btn", "◉ load");
      wl.hidden = true;
      dg.sim.onStop(() => { wp.textContent = "▶ pulse"; wl.hidden = true; wl.classList.remove("on"); });
      wp.onclick = () => {
        if (dg.sim.running) dg.sim.stop();
        else if (dg.sim.start()) { wp.textContent = "⏸ rest"; wl.hidden = false; }
      };
      wl.onclick = () => wl.classList.toggle("on", dg.sim.toggleLoad());
      ctl.append(wp, wl);
    }
    dpane.appendChild(ctl);

    resultEl.appendChild(verdictCard(w, rec.doc, {
      onAlt: a => {
        ta.value = a.name + " — " + a.note;
        ta.focus();
        compose.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }));
  }

  renderSaved();
  if (opts.result) showResult(opts.result, opts.change);

  runBtn.onclick = async () => {
    const change = ta.value.trim();
    if (change.length < 4) { ta.focus(); return; }
    if (!meta.apiKey) { renderSettings("Add your Anthropic API key to run grafts."); show("settings"); return; }
    if (!navigator.onLine) { toast("A graft needs a connection"); return; }
    runBtn.disabled = true;
    ta.disabled = true;
    resultEl.textContent = "";
    resultEl.appendChild(h("div", "gen-phase", COPY.whatifThinking));
    try {
      const w = await Generator.whatif({ apiKey: meta.apiKey, modelId: meta.modelId, doc: rec.doc, change, speed: meta.genSpeed || "balanced" });
      (rec.whatifs = rec.whatifs || []).push({ change, result: w, ts: Date.now() });
      await Store.saveBreakdownLight(rec);
      showResult(w, change);
      renderSaved();
    } catch (e) {
      resultEl.textContent = "";
      const box = h("div", "gen-error");
      box.appendChild(h("h3", null, e.kind === "key" ? "Invalid API key" : "Graft failed"));
      box.appendChild(h("p", null, e.message));
      resultEl.appendChild(box);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = COPY.whatifBtn;
      ta.disabled = false;
    }
  };
}

function verdictCard(w, doc, opts = {}) {
  const invById = {};
  doc.strip_down.invariants.forEach((iv, i) => { invById[iv.id] = { n: i + 1, text: iv.text }; });
  const card = h("div", "verdict-full verdict-" + w.verdict);
  const head = h("div", "vf-head");
  head.appendChild(h("span", "vf-badge", COPY.whatifVerdicts[w.verdict] || w.verdict));
  const stamp = h("img", "enso-stamp vf-stamp vf-stamp-in");   // presses in on reveal
  stamp.src = "assets/enso-gate.svg";
  stamp.alt = "";
  head.appendChild(stamp);
  card.appendChild(head);
  if (w.name) card.appendChild(h("div", "vf-name", w.name));
  card.appendChild(h("p", "vf-assessment", w.assessment));
  if (w.gain) { const g = h("p", "vf-line"); g.appendChild(h("b", null, "Gains: ")); g.appendChild(document.createTextNode(w.gain)); card.appendChild(g); }

  if (w.stresses && w.stresses.length) {
    const r = h("div", "defends-row");
    r.appendChild(h("span", "mono-label", "Threatens"));
    w.stresses.forEach(id => r.appendChild(h("span", "inv-badge stress", "INV " + (invById[id] ? invById[id].n : "?"))));
    card.appendChild(r);
    w.stresses.forEach(id => { if (invById[id]) card.appendChild(h("div", "vf-inv stress", invById[id].text)); });
  }
  if (w.defends && w.defends.length) {
    const r = h("div", "defends-row");
    r.appendChild(h("span", "mono-label", "Strengthens"));
    w.defends.forEach(id => {
      const chip = h("button", "inv-badge inv-tap", "INV " + (invById[id] ? invById[id].n : "?"));
      chip.onclick = () => {                     // tap: reveal the invariant being defended
        const open = chip._line;
        if (open) { open.remove(); chip._line = null; return; }
        if (invById[id]) { chip._line = h("div", "vf-inv", invById[id].text); r.after(chip._line); }
      };
      r.appendChild(chip);
    });
    card.appendChild(r);
  }
  if (w.tradeoff) card.appendChild(h("div", "tradeoff-band", w.tradeoff));
  if (w.at_scale) {
    const s = h("div", "scale-band");
    s.appendChild(h("div", "sb-label", "Under load · how it scales"));
    s.appendChild(h("p", null, w.at_scale));
    card.appendChild(s);
  }
  if (w.alternatives && w.alternatives.length) {
    card.appendChild(h("h2", "section-head", "Cleaner ways to get there"));
    w.alternatives.forEach(a => {
      const row = h(opts.onAlt ? "button" : "div", "alt-row" + (opts.onAlt ? " alt-tap" : ""));
      row.appendChild(h("div", "alt-name", a.name));
      row.appendChild(h("div", "alt-note", a.note));
      if (opts.onAlt) {
        row.appendChild(h("div", "alt-go", "graft this instead →"));
        row.onclick = () => opts.onAlt(a);
      }
      card.appendChild(row);
    });
  }
  return card;
}

/* ── the Studio bridge: clipboard reference notes (§11.5) ── */
function bridgeNotes(doc) {
  const lines = [];
  lines.push(`REFERENCE SYSTEM: ${doc.meta.system}`);
  lines.push(`(from Vitruvian. Paste into UX-First Studio › Structure It)`);
  lines.push("");
  lines.push(`ESSENCE: ${doc.essence.text}`);
  lines.push("");
  lines.push("INVARIANTS (what must never be false):");
  doc.strip_down.invariants.forEach((iv, i) => lines.push(`${i + 1}. ${iv.text}`));
  lines.push("");
  lines.push("TRANSFERABLE PRINCIPLES:");
  doc.transfer.principles.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("");
  lines.push("MECHANISM MAPPINGS:");
  doc.transfer.mappings.forEach(m => lines.push(`- ${m.mechanism} → ${m.elsewhere}`));
  lines.push("");
  lines.push(`Studio: ${COPY.studioUrl}`);
  return lines.join("\n");
}

/* ═══ Generation screen (§8, §11.3) ═══ */
function renderGenerate(systemName, mode) {
  const design = mode === "design";
  const root = $("screen-generate").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", design ? COPY.ownDesignKicker : "New Deconstruct"));
  root.appendChild(h("h1", "title", design ? COPY.ownDesignTitle : systemName));

  let designInput = null, focus = null;
  if (design) {
    root.appendChild(h("p", "subtitle", COPY.ownDesignLede));
    designInput = h("textarea", "design-input");
    designInput.placeholder = COPY.ownDesignPlaceholder;
    designInput.value = systemName || "";
    designInput.maxLength = 1400;
    root.appendChild(designInput);
  } else {
    const focusRow = h("div", "focus-row");
    focus = h("input");
    focus.placeholder = "Optional focus, e.g. \"emphasize the payments part\"";
    focus.maxLength = 200;
    focusRow.appendChild(focus);
    root.appendChild(focusRow);
  }
  root.appendChild(h("p", "lib-note", `Model: ${meta.modelId} · ${COPY.costNote}`));

  const startBtn = h("button", "big-btn", design ? COPY.ownDesignBtn : "Generate (1–3 minutes)");
  root.appendChild(startBtn);
  const prog = h("div", "gen-progress");
  root.appendChild(prog);

  startBtn.onclick = async () => {
    const subject = design ? designInput.value.trim() : systemName;
    if (design && subject.length < 12) { designInput.focus(); toast("Describe your design a little more"); return; }
    startBtn.disabled = true;
    if (designInput) designInput.disabled = true;
    if (focus) focus.disabled = true;
    prog.textContent = "";
    const phaseEl = h("div", "gen-phase", COPY.genPhases.start);
    const barEl = h("div", "gen-bar");
    const fill = h("div");
    barEl.appendChild(fill);
    const tok = h("div", "gen-tokens", "");
    prog.append(phaseEl, barEl, tok);

    const PHASE_PCT = { start: 4, strip_down: 18, visual: 30, layers: 42, stress: 78, transfer: 90, repair: 95 };
    try {
      const { doc, repaired } = await Generator.generate({
        apiKey: meta.apiKey, modelId: meta.modelId,
        system: subject, focus: focus ? focus.value.trim() : "", mode,
        speed: meta.genSpeed || "balanced",
        onProgress(p) {
          if (p.phase) {
            phaseEl.textContent = p.phase === "repair" ? "Repairing validation errors…" : (COPY.genPhases[p.phase] || phaseEl.textContent);
            fill.style.width = (PHASE_PCT[p.phase] || 0) + "%";
          }
          if (p.tokens) tok.textContent = "~" + p.tokens.toLocaleString() + " tokens";
        }
      });
      fill.style.width = "100%";
      const rec = {
        id: "gen_" + Date.now(), system: doc.meta.system, created: Date.now(),
        source: design ? "design" : "generated", schemaVersion: 1, doc,
        attempts: {}, progress: { layersRead: 0, gatesAnswered: 0, position: 0 }
      };
      await Store.saveBreakdown(rec);
      if (repaired) toast("Validated after one repair pass");
      openReader(rec.id);
    } catch (e) {
      prog.textContent = "";
      const box = h("div", "gen-error");
      const titles = {
        key: "Invalid API key", rate: "Rate limited", overloaded: "Anthropic is overloaded",
        offline: "You're offline", toobig: "Too large", invalid: "The model returned an invalid document",
        http: "API error", refusal: "The model declined"
      };
      box.appendChild(h("h3", null, titles[e.kind] || "Generation failed"));
      box.appendChild(h("p", null, e.message));
      if (Array.isArray(e.errors) && e.errors.length) {
        const ul = h("ul", "gen-error-list");
        e.errors.slice(0, 4).forEach(msg => ul.appendChild(h("li", null, msg)));
        if (e.errors.length > 4) ul.appendChild(h("li", null, `…and ${e.errors.length - 4} more`));
        box.appendChild(ul);
      }
      const row = h("div", "gate-actions");
      if (e.kind === "key") {
        const b = h("button", "gbtn", "Open Settings");
        b.onclick = () => { renderSettings(); show("settings"); };
        row.appendChild(b);
      }
      if (e.kind === "overloaded" || e.kind === "rate" || e.kind === "offline" || e.kind === "http") {
        const b = h("button", "gbtn primary", "Retry");
        b.onclick = () => { startBtn.disabled = false; if (focus) focus.disabled = false; if (designInput) designInput.disabled = false; prog.textContent = ""; startBtn.click(); };
        row.appendChild(b);
      }
      if (e.raw) {
        const b = h("button", "gbtn", "Download raw output");
        b.onclick = () => download("raw-deconstruct.txt", e.raw);
        row.appendChild(b);
      }
      box.appendChild(row);
      prog.appendChild(box);
      startBtn.disabled = false;
      if (focus) focus.disabled = false;
      if (designInput) designInput.disabled = false;
    }
  };
}

/* ═══ Models index (§11.4) ═══ */
async function renderModels(detailId) {
  const root = $("screen-models").firstElementChild;
  root.textContent = "";
  const index = await Store.getModelIndex();
  const byId = {};
  index.forEach(r => { byId[r.modelId] = r.uses; });
  const recs = await Store.getBreakdowns();
  const recById = {};
  recs.forEach(r => { recById[r.id] = r; });

  if (detailId) {
    const m = MODEL_LIBRARY.find(x => x.id === detailId);
    const back = h("button", "gbtn", "‹ All models");
    back.onclick = () => renderModels();
    root.appendChild(back);
    root.appendChild(h("h1", "title", m.name));
    root.appendChild(h("p", "subtitle", m.one_liner));
    const det = h("div", "ml-detail");
    det.appendChild(h("p", "desc", m.description));
    root.appendChild(det);
    root.appendChild(h("h2", "section-head", "Where it appears in your library"));
    const uses = byId[detailId] || [];
    if (!uses.length) root.appendChild(h("p", "lib-note", "No layer in your library uses this model yet."));
    uses.forEach(u => {
      const rec = recById[u.breakdownId];
      if (!rec) return;
      const L = rec.doc.layers.find(x => x.index === u.layerIndex);
      const row = h("button", "ml-use");
      const left = h("div");
      left.appendChild(h("div", "mu-sys", rec.system));
      left.appendChild(h("div", "mu-layer", "Layer " + u.layerIndex + " · " + (L ? L.name : "")));
      row.appendChild(left);
      row.appendChild(h("span", "mr-arrow", "›"));
      row.onclick = () => openReader(rec.id, u.layerIndex);
      root.appendChild(row);
    });
    return;
  }

  root.appendChild(h("div", "kicker", "Cross-system pattern recognition"));
  root.appendChild(h("h1", "title", "The 14 thinking models"));
  root.appendChild(h("p", "subtitle", "Every layer names the model that cracks its problem. Tap one to see it recur across systems."));
  const grid = h("div", "model-grid");
  MODEL_LIBRARY.forEach(m => {
    const uses = byId[m.id] || [];
    const card = h("button", "ml-card");
    card.appendChild(h("div", "ml-name", m.name));
    card.appendChild(h("div", "ml-one", m.one_liner));
    card.appendChild(h("div", "ml-count", uses.length ? uses.length + " layer" + (uses.length > 1 ? "s" : "") + " · " + new Set(uses.map(u => u.breakdownId)).size + " system(s)" : "not yet used"));
    card.onclick = () => renderModels(m.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

/* ═══ Drill mode — re-earn what you've read (§value-add) ═══
   Gates you have revealed become drillable, oldest practice first;
   interview probes from revealed layers deal as a cross-library deck.
   Fully offline; grades write back to the attempt record. */
let drillState = null;

async function renderDrill(keep) {
  const root = $("screen-drill").firstElementChild;
  root.textContent = "";
  const recs = await Store.getBreakdowns();
  const gates = [], probes = [];
  recs.forEach(rec => {
    rec.doc.layers.forEach(L => {
      const a = rec.attempts[L.index];
      if (a && a.revealed) {
        gates.push({ rec, L, a });
        L.developer.interview_probes.forEach(p => probes.push({ rec, L, p }));
      }
    });
  });
  gates.sort((x, y) => (x.a.lastDrill || x.a.ts || 0) - (y.a.lastDrill || y.a.ts || 0));
  if (!drillState || !keep) drillState = { tab: "gates", gi: 0, done: 0 };
  drillState.gates = gates;
  drillState.probes = probes;

  root.appendChild(h("div", "kicker", "Practice: re-earn what you've read"));
  root.appendChild(h("h1", "title", "Drill"));

  const seg = h("div", "seg");
  [["gates", "Gates · " + gates.length], ["probes", "Probes · " + probes.length]].forEach(([id, label]) => {
    const b = h("button", drillState.tab === id ? "on" : "", label);
    b.onclick = () => { drillState.tab = id; drillState.gi = 0; renderDrill(true); };
    seg.appendChild(b);
  });
  root.appendChild(seg);

  const body = h("div");
  body.style.marginTop = "22px";
  root.appendChild(body);

  if (drillState.tab === "gates") renderGateDrill(body);
  else renderProbeDrill(body);
}

function renderGateDrill(body) {
  const { gates } = drillState;
  if (!gates.length) {
    body.appendChild(h("p", "lib-note", "Nothing to drill yet. Reveal some gates in a Deconstruct first; drills re-test what you've earned."));
    return;
  }
  const item = gates[drillState.gi % gates.length];
  const { rec, L, a } = item;

  body.appendChild(h("p", "mono-label", `card ${(drillState.gi % gates.length) + 1} / ${gates.length} · ${drillState.done} graded this session`));

  const card = h("div", "gate-card");
  const metaRow = h("div", "bd-meta");
  metaRow.style.marginBottom = "10px";
  metaRow.appendChild(h("span", "chip flagship", rec.system));
  metaRow.appendChild(h("span", "chip", "layer " + L.index));
  metaRow.appendChild(h("span", "chip", a.lastDrill ? "last drilled " + timeAgo(a.lastDrill) : "never drilled"));
  card.appendChild(metaRow);

  card.appendChild(h("p", "st-scenario", L.problem.statement));
  card.appendChild(h("div", "gate-q", L.gate.question));
  const ta = h("textarea");
  ta.placeholder = "Answer from memory, then check yourself.";
  card.appendChild(ta);

  const actions = h("div", "gate-actions");
  const revealBtn = h("button", "gbtn primary", "Check my answer");
  actions.appendChild(revealBtn);
  const skipBtn = h("button", "gbtn", "Skip ›");
  skipBtn.onclick = () => { drillState.gi++; renderDrill(true); };
  actions.appendChild(skipBtn);
  card.appendChild(actions);

  revealBtn.onclick = () => {
    actions.remove();
    const sol = h("div", "solution-card");
    sol.appendChild(h("div", "sc-label", "The canonical solution"));
    sol.appendChild(h("p", null, L.solution));
    card.appendChild(sol);
    if (a.answer && a.answer.trim()) {
      const ya = h("div", "your-answer");
      ya.appendChild(h("div", "ya-label", "Your original gate answer"));
      ya.appendChild(h("p", null, a.answer));
      card.appendChild(ya);
    }
    const grade = h("div", "gate-actions");
    const good = h("button", "gbtn primary", "✓ Got it");
    const again = h("button", "gbtn", "↻ Again soon");
    const finish = ok => {
      a.lastDrill = Date.now();
      a.drillGrade = ok ? "good" : "again";
      Store.saveBreakdownLight(rec);
      drillState.gi++;
      drillState.done++;
      renderDrill(true);
    };
    good.onclick = () => finish(true);
    again.onclick = () => finish(false);
    grade.append(good, again);
    card.appendChild(grade);
  };

  body.appendChild(card);
}

function renderProbeDrill(body) {
  const { probes } = drillState;
  if (!probes.length) {
    body.appendChild(h("p", "lib-note", "No probes yet. They unlock as you reveal layers."));
    return;
  }
  probes.forEach(({ rec, L, p }) => {
    const card = h("div", "stress-card");
    card.appendChild(h("div", "st-scenario", p));
    const reveal = h("div", "st-reveal");
    reveal.hidden = true;
    reveal.appendChild(h("p", null, L.tech_lens.principle));
    const open = h("button", "gbtn", `Open ${rec.system} · layer ${L.index}`);
    open.style.marginTop = "8px";
    open.onclick = () => openReader(rec.id, L.index);
    reveal.appendChild(open);
    const btn = h("button", "gbtn", "What is it probing?");
    btn.onclick = () => { reveal.hidden = false; btn.remove(); };
    card.appendChild(btn);
    card.appendChild(reveal);
    body.appendChild(card);
  });
}

/* ═══ Settings (§11.5) ═══ */
function renderSettings(banner) {
  const root = $("screen-settings").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "Settings"));
  root.appendChild(h("h1", "title", "Keys, defaults, backups"));
  if (banner) root.appendChild(h("div", "narrowing-note", banner));

  /* About / how it works → landing + tutorial */
  const ab = h("div", "set-block");
  ab.appendChild(h("h3", null, "About & guide"));
  ab.appendChild(h("p", "note", "What Vitruvian is and how to read a Deconstruct: the cards, the diagram, the developer lens."));
  const abRow = h("div", "set-row");
  const abBtn = h("button", "gbtn primary", "Open the intro →");
  abBtn.onclick = () => { renderLanding(); show("landing"); };
  const tutBtn = h("button", "gbtn", "How to read a Deconstruct →");
  tutBtn.onclick = () => { renderTutorial("settings"); show("tutorial"); };
  abRow.append(abBtn, tutBtn);
  ab.appendChild(abRow);
  root.appendChild(ab);

  /* API key */
  const kb = h("div", "set-block");
  kb.appendChild(h("h3", null, "Anthropic API key"));
  kb.appendChild(h("p", "note", COPY.keyNotice));
  const key = h("input");
  key.type = "password";
  key.placeholder = "sk-ant-…";
  key.value = meta.apiKey || "";
  const krow = h("div", "set-row");
  const ksave = h("button", "gbtn primary", "Save key");
  ksave.onclick = async () => {
    meta.apiKey = key.value.trim();
    await Store.saveMeta({ apiKey: meta.apiKey });
    toast(meta.apiKey ? "Key saved on this device" : "Key removed");
  };
  const kclear = h("button", "gbtn", "Remove");
  kclear.onclick = async () => { key.value = ""; meta.apiKey = ""; await Store.saveMeta({ apiKey: "" }); toast("Key removed"); };
  krow.append(ksave, kclear);
  kb.append(key, krow);
  const cost = h("p", "note");
  cost.appendChild(document.createTextNode(COPY.costNote + " "));
  const link = h("a", null, "Anthropic pricing ↗");
  link.href = COPY.pricingUrl;
  link.target = "_blank";
  link.rel = "noopener";
  cost.appendChild(link);
  kb.appendChild(cost);
  root.appendChild(kb);

  /* model */
  const mb = h("div", "set-block");
  mb.appendChild(h("h3", null, "Model"));
  mb.appendChild(h("p", "note", "Any Anthropic model id; new models need no app update."));
  mb.appendChild(h("p", "note", COPY.modelCostNote));
  const mi = h("input");
  mi.type = "text";
  mi.value = meta.modelId || "claude-sonnet-5";
  const mrow = h("div", "set-row");
  ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5", "claude-haiku-4-5-20251001"].forEach(preset => {
    const b = h("button", "gbtn", preset.replace("claude-", "").replace("-20251001", ""));
    b.onclick = () => { mi.value = preset; msave.click(); };
    mrow.appendChild(b);
  });
  const msave = h("button", "gbtn primary", "Save");
  msave.onclick = async () => {
    meta.modelId = mi.value.trim() || "claude-sonnet-5";
    await Store.saveMeta({ modelId: meta.modelId });
    toast("Model: " + meta.modelId);
  };
  mrow.appendChild(msave);
  mb.append(mi, mrow);
  root.appendChild(mb);

  /* defaults */
  const db = h("div", "set-block");
  db.appendChild(h("h3", null, "Reading defaults"));
  const seg = h("div", "seg");
  COPY.audienceModes.forEach(m => {
    const b = h("button", meta.audienceMode === m.id ? "on" : "", m.label);
    b.onclick = async () => {
      meta.audienceMode = m.id;
      await Store.saveMeta({ audienceMode: m.id });
      renderAudSwitch();
      renderSettings();
    };
    seg.appendChild(b);
  });
  db.appendChild(seg);
  const tog = h("div", "toggle" + (meta.challengeModeDefault === true ? " on" : ""));
  tog.style.marginTop = "12px";
  tog.append(h("span", "tg-track"), h("span", "tg-label", "Challenge mode by default: hide each solution behind a design-it-first gate"));
  tog.onclick = async () => {
    meta.challengeModeDefault = !(meta.challengeModeDefault === true);
    await Store.saveMeta({ challengeModeDefault: meta.challengeModeDefault });
    renderSettings();
  };
  db.appendChild(tog);
  root.appendChild(db);

  /* generation speed */
  const gs = h("div", "set-block");
  gs.appendChild(h("h3", null, "Generation speed"));
  gs.appendChild(h("p", "note", "Balanced lets the model reason longer before writing, for better structure. Fast trims thinking for quicker, cheaper runs."));
  const gseg = h("div", "seg");
  [["balanced", "Balanced"], ["fast", "Fast"]].forEach(([id, label]) => {
    const b = h("button", (meta.genSpeed || "balanced") === id ? "on" : "", label);
    b.onclick = async () => {
      meta.genSpeed = id;
      await Store.saveMeta({ genSpeed: id });
      renderSettings();
    };
    gseg.appendChild(b);
  });
  gs.appendChild(gseg);
  root.appendChild(gs);

  /* backup / restore */
  const bb = h("div", "set-block");
  bb.appendChild(h("h3", null, "Backup & restore"));
  bb.appendChild(h("p", "note", "The backup contains your library and attempts, never your API key."));
  const brow = h("div", "set-row");
  const bexp = h("button", "gbtn primary", "Backup .json");
  bexp.onclick = async () => {
    const state = await Store.exportAll();
    download("system-deconstructor-backup.json", JSON.stringify(state, null, 2));
    meta.lastBackup = Date.now();
    await Store.saveMeta({ lastBackup: meta.lastBackup });
    toast("Backup downloaded");
  };
  const bres = h("button", "gbtn", "Restore .json");
  bres.onclick = () => pickFile(async file => {
    try {
      const state = JSON.parse(await file.text());
      if (!confirm("Restoring replaces your current library. Continue?")) return;
      const results = await Store.importAll(state);
      const bad = results.filter(r => !r.ok);
      meta = await Store.getMeta();
      applyTheme(meta.theme || document.documentElement.dataset.theme);   // a restored backup may carry a different theme
      renderAudSwitch();
      toast(`Restored ${results.length - bad.length}/${results.length} Deconstructs`);
      if (bad.length) alert("Skipped invalid entries:\n" + bad.map(r => `${r.system || r.id}: ${r.errors[0]}`).join("\n"));
      renderSettings();
    } catch (e) { alert("Restore failed: " + e.message); }
  });
  brow.append(bexp, bres);
  bb.appendChild(brow);
  root.appendChild(bb);

  root.appendChild(h("p", "fine", COPY.privacyNote));
  root.appendChild(h("p", "fine", `${CONFIG.toolName.replace("·", "·")} v${CONFIG.appVersion} · ${COPY.offlineGenNote}`));
}

/* ═══ Launcher shortcut routing (pwa.js calls these) ═══ */
function launchNew() {
  show("library");
  const i = $("deconInput");
  if (i) i.focus();
}
async function launchResume() {
  if (meta.lastOpenBreakdown) {
    const rec = await Store.getBreakdown(meta.lastOpenBreakdown);
    if (rec) { openReader(rec.id); return; }
  }
  show("library");
}

boot();
