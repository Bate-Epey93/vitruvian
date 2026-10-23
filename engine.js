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

/* Line icons for chrome and tools: 20-unit grid, 1.5 stroke, round joins.
   Same DOM-built, currentColor approach as ensoIcon, so they theme for free. */
const ICONS = {
  arrowRight: ["M4.5 10h11", "M11 5.5l4.5 4.5-4.5 4.5"],
  arrowUpRight: ["M6 14l8-8", "M7.5 6H14v6.5"],
  chevronLeft: ["M12 15l-5-5 5-5"],
  chevronDown: ["M5 7.5l5 5 5-5"],
  chevronUp: ["M5 12.5l5-5 5 5"],
  play: ["M7 5.2v9.6l7.6-4.8z"],
  pause: ["M7.5 5v10", "M12.5 5v10"],
  gauge: ["M3.8 14a6.2 6.2 0 1 1 12.4 0", "M10 14l3.2-4"],
  replay: ["M4 10a6 6 0 1 0 1.8-4.3", "M4 3.6v3.2h3.2"],
  races: ["M3 7h11.5", "M12 4.5L14.5 7 12 9.5", "M3 13h11.5", "M12 10.5l2.5 2.5-2.5 2.5"],
  spine: ["M2.5 10H6l2-5 4 10 2-5h3.5"],
  record: ["M10 3.6a6.4 6.4 0 1 1 0 12.8a6.4 6.4 0 1 1 0-12.8z", "M10 7.6a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8z"],
  upload: ["M10 13V3.8", "M6.2 7.4L10 3.6l3.8 3.8", "M4 16.4h12"],
  info: ["M10 3.2a6.8 6.8 0 1 1 0 13.6a6.8 6.8 0 1 1 0-13.6z", "M10 9v4.5", "M10 6.5v.2"],
  sparkle: ["M10 3v4M10 13v4M3 10h4M13 10h4", "M5.6 5.6l1.8 1.8M12.6 12.6l1.8 1.8M5.6 14.4l1.8-1.8M12.6 7.4l1.8-1.8"],
  layers: ["M10 3l7 3.6-7 3.6-7-3.6z", "M3 10.4l7 3.6 7-3.6", "M3 13.8l7 3.6 7-3.6"],
  pencil: ["M12.8 4.2l3 3L7.6 15.4 4 16l.6-3.6z"],
  cube: ["M10 2.8l6.4 3.6v7.2L10 17.2l-6.4-3.6V6.4z", "M3.6 6.4L10 10l6.4-3.6", "M10 10v7.2"],
  tag: ["M3.5 10.4V4.6c0-.6.5-1.1 1.1-1.1h5.8l6.1 6.1-6.9 6.9z", "M7.2 6.6v.2"],
  compare: ["M10 3v14", "M3.5 5.5h4v9h-4z", "M12.5 5.5h4v9h-4z"],
  flask: ["M8 3h4", "M8.6 3v5L4.4 15.2c-.5.9.1 1.8 1.1 1.8h9c1 0 1.6-.9 1.1-1.8L11.4 8V3", "M6.2 12.5h7.6"]
};
function icon(name, cls) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ico" + (cls ? " " + cls : ""));
  (ICONS[name] || []).forEach(d => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  });
  return svg;
}
/* a button's face: optional icon + text label (label hides on narrow chrome) */
function setFace(btn, name, label) {
  btn.textContent = "";
  if (name) btn.appendChild(icon(name));
  if (label) btn.appendChild(h("span", "btn-label", label));
  return btn;
}
/* primary pill with its arrow in a nested circle; strips any trailing arrow
   glyph from the copy since the circle now carries it */
function ctaButton(label, cls, iconName) {
  const b = h("button", "big-btn" + (cls ? " " + cls : ""));
  b.appendChild(h("span", "btn-label", String(label).replace(/\s*[→›]\s*$/, "")));
  const c = h("span", "btn-ico");
  c.appendChild(icon(iconName || "arrowRight"));
  b.appendChild(c);
  return b;
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
  if (meta) meta.setAttribute("content", t === "dark" ? "#0c0c0e" : "#f6f5f2");
  const btn = $("themeBtn");
  if (btn) btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");   // the sun/moon swap is CSS, keyed off data-theme
}
async function toggleTheme() {
  const next = (document.documentElement.dataset.theme === "dark") ? "light" : "dark";
  applyTheme(next);
  meta.theme = next;
  await Store.saveMeta({ theme: next });
}

/* ═══ Screen switching ═══ */
const SCREENS = ["landing", "library", "reader", "generate", "models", "vocab", "drill", "tutorial", "whatif", "settings"];
function show(screen) {
  SCREENS.forEach(s => { $("screen-" + s).hidden = s !== screen; });
  document.body.classList.toggle("reading", screen === "reader");   // frees topbar room for the audience switch
  $("audSwitch").hidden = screen !== "reader";
  $("readerMenuBtn").hidden = screen !== "reader";
  // reading-only context tools live in the topbar's right zone; hidden elsewhere
  // so global chrome never shows dead buttons (see placement note in commit)
  ["ctxDiv", "sheetBtn", "seqBtn", "graftBtn"].forEach(id => { $(id).hidden = screen !== "reader"; });
  $("backBtn").hidden = screen === "library" || screen === "landing";
  $("menuPop").hidden = true;
  const navScreen = screen === "vocab" ? "models" : screen;   // vocabulary is a tab of Models
  document.querySelectorAll("[data-screen]").forEach(b => {
    const on = b.dataset.screen === navScreen;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  document.body.dataset.screen = screen;
  if (screen !== "reader") {
    if (firstRunTips.close && document.querySelector(".tip-card")) firstRunTips.close();
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
  // v2: reading counts as progress. Before, only the challenge gate marked a
  // layer done, and gates are off by default, so a reader who finished a whole
  // system still showed 0 of N. Backfill once, from the furthest place each
  // reader got to (layersRead can't be used: outside challenge mode it jumped
  // to "every layer" the moment a system was opened). Gated records already
  // carry their own reveals. From here on the reader marks a layer at its fix.
  if (!meta.readCountsV2) {
    for (const r of await Store.getBreakdowns()) {
      if (r.challengeMode === true) continue;
      const read = Math.min(r.doc.layers.length, (r.progress && r.progress.position) || 0);
      let changed = false;
      r.doc.layers.forEach(L => {
        if (L.index > read) return;
        const a = r.attempts[L.index] || (r.attempts[L.index] = { answer: "", revealed: false, verdict: null, ts: 0 });
        if (!a.revealed) { a.revealed = true; a.ts = a.ts || Date.now(); changed = true; }
      });
      if (changed) await Store.saveBreakdownLight(r);
    }
    meta.readCountsV2 = true;
    await Store.saveMeta({ readCountsV2: true });
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
  $("brand").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("brand").click(); } };
  $("libraryBtn").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("backBtn").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("modelsBtn").onclick = () => { renderModels(); show("models"); };
  $("drillBtn").onclick = () => { renderDrill(); show("drill"); };
  $("settingsBtn").onclick = () => { renderSettings(); show("settings"); };
  $("themeBtn").onclick = () => toggleTheme();
  $("seqBtn").onclick = () => { if (currentRec) openSequence(currentRec); };
  $("sheetBtn").onclick = () => { if (currentView) currentView.openSheet(); };
  $("graftBtn").onclick = () => { if (currentRec) { renderWhatif(currentRec); show("whatif"); } };
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

/* Landing: an editorial split. Copy on the left; on the right, a real
   Deconstruct building itself, layer by layer, in a framed stage, because the
   product explains itself faster than any paragraph about it. */
let heroTimer = null;
function stopHero() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }

function renderLanding() {
  stopHero();
  const root = $("screen-landing").firstElementChild;
  root.textContent = "";
  const L = COPY.landing;

  const hero = h("section", "hero");
  const copy = h("div", "hero-copy reveal");
  const eyebrow = h("div", "eyebrow");
  eyebrow.appendChild(h("span", "eyebrow-dot"));
  eyebrow.appendChild(document.createTextNode(L.kicker));
  copy.appendChild(eyebrow);
  const head = h("h1", "landing-head");
  L.headline.split("\n").forEach((line, i) => { head.appendChild(h("span", i ? "lh-soft" : null, line)); });
  copy.appendChild(head);
  copy.appendChild(h("p", "landing-lede", L.lede));
  const actions = h("div", "hero-actions");
  const cta = ctaButton(L.cta, "landing-cta");
  cta.onclick = async () => {
    stopHero();
    await Store.saveMeta({ landingSeen: true });
    meta.landingSeen = true;
    await renderLibrary();
    show("library");
  };
  const learn = h("button", "gbtn ghost", L.learn);
  learn.onclick = () => { stopHero(); renderTutorial("landing"); show("tutorial"); };
  actions.append(cta, learn);
  copy.appendChild(actions);
  copy.appendChild(h("p", "landing-foot", L.footnote));
  hero.appendChild(copy);

  // the stage: shell + core, the core holds a live diagram
  const stage = h("div", "hero-stage reveal");
  const core = h("div", "hs-core");
  const bar = h("div", "hs-bar");
  const hsTitle = h("span", "hs-title", "");
  const hsLayer = h("span", "hs-layer", "");
  bar.append(hsTitle, hsLayer);
  const dg = h("div", "hs-diagram");
  const steps = h("div", "hs-steps");
  const note = h("div", "hs-note", "");
  core.append(bar, dg, note, steps);
  stage.appendChild(core);
  hero.appendChild(stage);
  root.appendChild(hero);

  // numbers that are true today, read from the library itself
  const stats = h("div", "landing-stats reveal");
  [[CONFIG.flagshipNames.length, L.stats[0]], [MODEL_LIBRARY.length, L.stats[1]], [COPY.audienceModes.length, L.stats[2]]].forEach(([n, label]) => {
    const st = h("div", "ls-item");
    st.appendChild(h("span", "ls-n", String(n)));
    st.appendChild(h("span", "ls-l", label));
    stats.appendChild(st);
  });
  root.appendChild(stats);

  const grid = h("div", "landing-grid");
  L.sections.forEach((s, i) => {
    const card = h("div", "landing-card reveal" + (i === 0 ? " lc-wide" : ""));
    const hd = h("div", "lc-head");
    const ic = h("span", "lc-icon");
    ic.appendChild(ensoIcon(s.icon));
    hd.appendChild(ic);
    hd.appendChild(h("span", "lc-num", "0" + (i + 1)));
    card.appendChild(hd);
    card.appendChild(h("h3", "lc-title", s.title));
    card.appendChild(h("p", null, s.body));
    grid.appendChild(card);
  });
  root.appendChild(grid);
  revealOnScroll(root);
  mountHero({ dg, hsTitle, hsLayer, steps, note });
}

async function mountHero(el) {
  const rec = (await Store.getBreakdown("flagship-" + COPY.landing.heroSystem).catch(() => null))
    || (await Store.getBreakdowns()).find(b => b.source === "flagship");
  if (!rec) return;
  const doc = rec.doc, N = doc.layers.length;
  const diagram = Diagram.mount(el.dg, doc);
  el.hsTitle.textContent = doc.meta.system;
  const segs = [];
  for (let i = 0; i <= N; i++) { const sg = h("span", "hs-seg"); el.steps.appendChild(sg); segs.push(sg); }
  let i = 0;
  const paint = () => {
    diagram.show(i, { animate: i > 0 });
    el.hsLayer.textContent = i === 0 ? "Layer 0 · the naive baseline" : "Layer " + i + " of " + N;
    el.note.textContent = i === 0 ? doc.meta.system + ", as simple as it can be." : doc.layers[i - 1].name;
    segs.forEach((sg, k) => { sg.classList.toggle("done", k < i); sg.classList.toggle("on", k === i); });
  };
  paint();
  if (RM_PREF()) { i = N; paint(); return; }    // reduced motion: show the finished system, hold still
  heroTimer = setInterval(() => {
    if ($("screen-landing").hidden) { stopHero(); return; }
    i = (i + 1) % (N + 1);
    paint();
  }, 2600);
}

/* Fade-up on first sight. IntersectionObserver only: no scroll listeners. */
function revealOnScroll(root) {
  const els = root.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || RM_PREF()) { els.forEach(e => e.classList.add("in")); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  // observe a tick later: callers render first and show() the screen after,
  // and an element observed while its screen is display:none can miss its entry
  els.forEach((e, k) => e.style.setProperty("--d", (k % 4) * 70 + "ms"));
  setTimeout(() => els.forEach(e => io.observe(e)), 0);
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
  const shape = d => { const p = svgNS("path", { d, class: "dgl-shape" }); s.appendChild(p); };
  const line = d => { const p = svgNS("path", { d, class: "dgl-line", fill: "none" }); s.appendChild(p); };
  if (kind === "actor") { s.appendChild(svgNS("circle", { cx: 23, cy: 7, r: 4, class: "dgl-shape" })); line("M23 11 V19 M16 14 H30 M23 19 L18 27 M23 19 L28 27"); }
  else if (kind === "store") { shape("M7 8 A16 3.5 0 0 1 39 8 V22 A16 3.5 0 0 1 7 22 Z"); line("M7 8 A16 3.5 0 0 0 39 8"); }
  else if (kind === "channel") { shape("M12 6 H34 A5 9 0 0 1 34 24 H12 A5 9 0 0 1 12 6 Z"); line("M34 6 A5 9 0 0 0 34 24"); }
  else s.appendChild(svgNS("rect", { x: 7, y: 6, width: 32, height: 18, rx: 4, class: "dgl-shape" }));
  return s;
}
function edgeSwatch(kind) {                       // mini arrow echoing the diagram's edge kinds
  const s = svgNS("svg", { viewBox: "0 0 50 16", class: "tut-swatch tut-swatch-edge" });
  const dash = kind === "money" ? "1.5 3.5" : kind === "control" ? "5 4" : "0";
  const ln = svgNS("line", { x1: 3, y1: 8, x2: 40, y2: 8, class: "dgl-line" });
  ln.style.strokeWidth = kind === "payload" ? 1.9 : 1.5; if (dash !== "0") ln.style.strokeDasharray = dash;
  s.appendChild(ln);
  s.appendChild(svgNS("path", { d: "M41 8 L33 4.2 L35 8 L33 11.8 Z", class: "dg-arrow" }));
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

  // Go deeper: the interactive simulate/interrogate tools
  if (T.explore) {
    root.appendChild(h("h2", "section-head", T.explore.title));
    if (T.explore.note) root.appendChild(h("p", "lib-note", T.explore.note));
    T.explore.items.forEach(([name, desc]) => {
      const row = h("div", "tut-row");
      const tx = h("div"); tx.appendChild(h("div", "tut-row-title", name)); tx.appendChild(h("p", "tut-row-desc", desc));
      row.appendChild(tx);
      root.appendChild(row);
    });
  }

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
    const n = rec.doc.layers.length;
    const done = rec.doc.layers.filter(L => rec.attempts[L.index] && rec.attempts[L.index].revealed).length;
    const pct = Math.round(100 * done / n);
    const top = h("div", "bd-top");
    const chipCls = rec.source === "flagship" ? " flagship" : (rec.source === "design" ? " design" : "");
    const chipLabel = rec.source === "flagship" ? "Sample" : (rec.source === "design" ? "Your design" : "Your Deconstruct");
    top.appendChild(h("span", "chip" + chipCls, chipLabel));
    // this subject also exists as a machine you can turn over
    if (fieldStudyFor(rec.system)) top.appendChild(h("span", "chip lab-chip", COPY.labChip));
    const go = h("span", "bd-go");
    go.appendChild(icon("arrowUpRight"));
    top.appendChild(go);
    card.appendChild(top);
    card.appendChild(h("div", "bd-name", rec.system));
    const es = rec.doc.essence && (rec.doc.essence.beginner || rec.doc.essence.text);
    if (es) card.appendChild(h("p", "bd-essence", es));
    // the strata: one bar per layer, filled as layers are revealed
    const strata = h("div", "bd-strata");
    for (let k = 1; k <= n; k++) {
      const a = rec.attempts[k];
      strata.appendChild(h("span", a && a.revealed ? "on" : null));
    }
    const foot = h("div", "bd-foot");
    foot.appendChild(h("span", "bd-last", n + " layers · " + (rec.lastOpen ? "opened " + timeAgo(rec.lastOpen) : "not started")));
    if (pct === 100) {
      const stamp = h("img", "enso-stamp card-stamp");
      stamp.src = "assets/enso-complete.svg";
      stamp.alt = "Deconstruct complete";
      foot.appendChild(stamp);
    } else if (pct > 0) foot.appendChild(h("span", "bd-pct", pct + "%"));
    card.appendChild(strata);
    card.appendChild(foot);
    card.onclick = () => openReader(rec.id);
    grid.appendChild(card);
  });
  return grid;
}

async function renderLibrary() {
  const root = $("screen-library").firstElementChild;
  root.textContent = "";
  const head = h("header", "lib-hero");
  head.appendChild(h("h1", "title", "What do you want to understand?"));
  head.appendChild(h("p", "subtitle", COPY.libraryLede));
  root.appendChild(head);

  const bar = h("div", "deconstruct-bar");
  const field = h("label", "db-field");
  field.appendChild(icon("sparkle", "db-ico"));
  const input = h("input");
  input.id = "deconInput";
  input.placeholder = COPY.deconstructPlaceholder;
  input.maxLength = 120;
  input.setAttribute("aria-label", "System to deconstruct");
  input.autocomplete = "off";
  field.appendChild(input);
  const go = ctaButton(COPY.deconstructBtn);
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
  field.appendChild(go);
  bar.appendChild(field);
  root.appendChild(bar);

  // second path: deconstruct a design you're building (not a known system)
  const ownLink = setFace(h("button", "gbtn own-design-btn"), "pencil", COPY.ownDesignLink.replace(/\s*→$/, ""));
  ownLink.onclick = () => {
    if (!meta.apiKey) { renderSettings("Add your Anthropic API key to generate Deconstructs."); show("settings"); return; }
    renderGenerate("", "design");
    show("generate");
  };
  root.appendChild(ownLink);

  const all = (await Store.getBreakdowns()).sort((a, b) => (b.lastOpen || b.created) - (a.lastOpen || a.created));
  const flagships = all.filter(b => b.source === "flagship");
  const yours = all.filter(b => b.source !== "flagship");

  // Your own Deconstructs are the point of the app; the samples only show
  // what one looks like.
  root.appendChild(sectionHead(COPY.yoursHeading, yours.length ? yours.length + " so far" : null));
  if (yours.length) root.appendChild(cardGrid(yours));
  else {
    const empty = h("div", "empty-panel");
    empty.appendChild(h("p", null, COPY.yoursEmpty));
    root.appendChild(empty);
  }
  root.appendChild(sectionHead(COPY.sampleHeading, flagships.length + " systems"));
  root.appendChild(h("p", "lib-note", COPY.sampleNote));
  root.appendChild(cardGrid(flagships));

  // Field studies: self-contained lab pages rather than schema documents,
  // so they live outside the breakdown store and link out as plain pages.
  const n = FIELD_STUDIES.length;
  root.appendChild(sectionHead(COPY.labHeading, n + (n === 1 ? " study" : " studies")));
  root.appendChild(h("p", "lib-note", COPY.labNote));
  const labGrid = h("div", "card-grid");
  FIELD_STUDIES.forEach(st => {
    const lab = h("a", "bd-card lab-card");
    lab.href = st.href;
    const top = h("div", "bd-top");
    top.appendChild(h("span", "chip lab-chip", "Field study"));
    top.appendChild(h("span", "chip", COPY.labChip));
    const go = h("span", "bd-go");
    go.appendChild(icon("arrowUpRight"));
    top.appendChild(go);
    lab.appendChild(top);
    const art = h("span", "lab-art");
    art.appendChild(icon("cube"));
    lab.appendChild(art);
    lab.appendChild(h("div", "bd-name", st.name));
    lab.appendChild(h("p", "bd-essence", st.sub));
    labGrid.appendChild(lab);
  });
  root.appendChild(labGrid);

  // quiet foundation of future sharing: single-breakdown import
  const importRow = h("div", "lib-foot");
  const imp = setFace(h("button", "gbtn ghost"), "upload", "Import a Deconstruct (.json)");
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
  const about = setFace(h("button", "gbtn ghost"), "info", "About Vitruvian");
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
let drillStack = [];   // semantic-zoom breadcrumb: [{id, system}, …], parent → child

/* the breadcrumb shown while nested: System › Sub-system › … , each crumb
   pops the stack back to that level. */
function drillCrumb() {
  const bar = h("div", "reader-crumb");
  drillStack.forEach((entry, i) => {
    if (i) bar.appendChild(h("span", "rc-sep", "›"));
    if (i === drillStack.length - 1) {
      bar.appendChild(h("span", "rc-here", entry.system));
    } else {
      const b = h("button", "rc-link", entry.system);
      b.onclick = () => { drillStack = drillStack.slice(0, i + 1); openReader(entry.id, null, { keepStack: true }); };
      bar.appendChild(b);
    }
  });
  return bar;
}

/* semantic zoom: a node's ⊕ badge drilled into sub-system `sub`. If a
   Deconstruct for it already exists (a flagship or one you've generated),
   open it nested under the current one; otherwise offer to deconstruct it. */
async function drillInto(sub) {
  const want = sub.trim().toLowerCase();
  const all = await Store.getBreakdowns();
  // prefer an exact system-name match; flagships first, then your own studies
  const match = all.filter(b => (b.system || "").trim().toLowerCase() === want)
                   .sort((a, b) => (a.source === "flagship" ? -1 : 1) - (b.source === "flagship" ? -1 : 1))[0];
  if (match) {
    if (!drillStack.some(e => e.id === match.id)) drillStack.push({ id: match.id, system: match.system });
    openReader(match.id, null, { keepStack: true });
    return;
  }
  // nothing yet — offer to generate it (BYOK), opening as its own study
  if (!meta.apiKey) { toast(`No Deconstruct of "${sub}" yet. Add an API key to generate one.`); return; }
  if (confirm(`No Deconstruct of "${sub}" yet. Deconstruct it now?`)) {
    renderGenerate(sub);
    show("generate");
  }
}

/* ═══ First-run tips: three, the first time a Deconstruct opens. Each one
   rings the part of the screen it's about. Esc or Skip ends them; the
   field guide keeps everything else. ═══ */
function firstRunTips() {
  if (meta.tipsSeen) return;
  const tips = COPY.firstRunTips;
  let i = 0, ringed = null;
  const card = h("div", "tip-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-live", "polite");
  const count = h("div", "tip-count");
  const title = h("h3", "tip-title");
  const text = h("p", "tip-text");
  const row = h("div", "tip-row");
  const skip = h("button", "gbtn ghost", "Skip tips");
  const next = h("button", "gbtn primary", "Next");
  row.append(skip, next);
  card.append(count, title, text, row);
  const finish = async () => {
    if (ringed) ringed.classList.remove("tip-ring");
    card.remove();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
    meta.tipsSeen = true;
    await Store.saveMeta({ tipsSeen: true });
  };
  function place() {
    if (!card.isConnected) return;
    const t = ringed && ringed.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 32);
    card.style.width = w + "px";
    if (!t || !t.width) { card.style.left = (innerWidth - w) / 2 + "px"; card.style.top = (innerHeight - card.offsetHeight) / 2 + "px"; return; }
    const ch = card.offsetHeight;
    let top = t.bottom + 12;
    if (top + ch > innerHeight - 12) top = t.top - ch - 12;
    if (top < 12) top = Math.max(12, Math.min(innerHeight - ch - 12, t.top + 12));
    card.style.top = top + "px";
    card.style.left = Math.max(16, Math.min(innerWidth - w - 16, t.left + t.width / 2 - w / 2)) + "px";
  }
  function paint() {
    const tip = tips[i];
    if (ringed) ringed.classList.remove("tip-ring");
    ringed = tip.target.split(",").map(sel => document.querySelector("#screen-reader " + sel.trim())).find(el => el && el.offsetParent);
    if (ringed) ringed.classList.add("tip-ring");
    count.textContent = `Tip ${i + 1} of ${tips.length}`;
    title.textContent = tip.title;
    text.textContent = tip.text;
    next.textContent = i === tips.length - 1 ? "Got it" : "Next";
    place();
    next.focus();
  }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); finish(); } }
  skip.onclick = finish;
  next.onclick = () => { if (i === tips.length - 1) finish(); else { i++; paint(); } };
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", place);
  document.body.appendChild(card);
  paint();
  // tips belong to the reader; leaving it ends them
  firstRunTips.close = finish;
}

const SHEET_SNAPS = [0.3, 0.52, 0.88];          // share of the reader the sheet covers
const SHEET_NAMES = ["mostly diagram", "half and half", "mostly text"];
function sheetDrag(wrap, sheet, grip) {
  let snap = 1;
  try { const v = parseInt(localStorage.getItem("vitruvian_sheet_snap"), 10); if (v >= 0 && v < SHEET_SNAPS.length) snap = v; } catch (e) {}
  const apply = (frac, animate) => {
    wrap.classList.toggle("sheet-moving", !animate);
    wrap.style.setProperty("--sheet", (frac * 100).toFixed(2) + "%");
  };
  const setSnap = i => {
    snap = Math.max(0, Math.min(SHEET_SNAPS.length - 1, i));
    apply(SHEET_SNAPS[snap], true);
    grip.setAttribute("aria-label", `Reading panel: ${SHEET_NAMES[snap]}. Tap or use the arrow keys to resize.`);
    try { localStorage.setItem("vitruvian_sheet_snap", String(snap)); } catch (e) {}
  };
  setSnap(snap);
  let start = null, moved = false;
  grip.addEventListener("pointerdown", e => {
    start = { y: e.clientY, frac: SHEET_SNAPS[snap], h: wrap.clientHeight || 1 };
    moved = false;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener("pointermove", e => {
    if (!start) return;
    const dy = start.y - e.clientY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved) apply(Math.max(0.2, Math.min(0.95, start.frac + dy / start.h)), false);
  });
  const end = e => {
    if (!start) return;
    if (moved) {
      const frac = start.frac + (start.y - e.clientY) / start.h;
      let best = 0;
      SHEET_SNAPS.forEach((f, i) => { if (Math.abs(f - frac) < Math.abs(SHEET_SNAPS[best] - frac)) best = i; });
      setSnap(best);
    }
    start = null;
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  // a tap steps up and wraps back down; the drag already ended without a click
  grip.addEventListener("click", () => { if (moved) { moved = false; return; } setSnap(snap === SHEET_SNAPS.length - 1 ? 0 : snap + 1); });
  grip.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setSnap(snap + 1); }
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setSnap(snap - 1); }
  });
}

async function openReader(id, layerIndex, opts = {}) {
  const rec = await Store.getBreakdown(id);
  if (!rec) return;
  if (currentView) currentView.destroy();   // re-open (e.g. from Models index) skips show()'s teardown
  currentRec = rec;
  // a plain open (library, Models, deep link) starts a fresh breadcrumb; a
  // drill keeps the stack the caller already pushed onto
  if (!opts.keepStack) drillStack = [{ id: rec.id, system: rec.system }];
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
  const capToggle = setFace(h("button", "gbtn sim-btn icon-only cap-toggle"), "chevronDown");
  capToggle.setAttribute("aria-label", "Hide diagram");
  capToggle.title = "Hide diagram";
  capToggle.onclick = () => {
    const collapsed = dpane.classList.toggle("collapsed");
    setFace(capToggle, collapsed ? "chevronUp" : "chevronDown");
    capToggle.setAttribute("aria-label", collapsed ? "Show diagram" : "Hide diagram");
    capToggle.title = collapsed ? "Show diagram" : "Hide diagram";
  };
  const playBtn = setFace(h("button", "gbtn sim-btn sim-primary"), "play", "Pulse");
  playBtn.title = "Send live traffic through this state";
  const loadBtn = setFace(h("button", "gbtn sim-btn"), "gauge", "Load");
  loadBtn.title = "Turn up the traffic until something saturates";
  const replayBtn = setFace(h("button", "gbtn sim-btn"), "replay", "Replay");
  replayBtn.title = "Re-enact this layer's historical failure";
  const raceBtn = setFace(h("button", "gbtn sim-btn"), "races", "Races");
  raceBtn.title = "Highlight nodes with two or more concurrent writers, where races can happen";
  const spineBtn = setFace(h("button", "gbtn sim-btn"), "spine", "Spine");
  spineBtn.title = "Trace the critical path a request waits on, and ring the nodes that would take the whole system down";
  const gifBtn = setFace(h("button", "gbtn sim-btn"), "record", "GIF");
  gifBtn.title = "Record the running Pulse as a looping GIF to share";
  loadBtn.hidden = true;
  const capSep = () => h("span", "cap-sep");
  // Before: in the fix step, flip the diagram to the state this layer replaced
  const beforeBtn = setFace(h("button", "gbtn sim-btn"), "compare", "Before");
  beforeBtn.title = "Show the system before this fix (or hold B)";
  replayBtn.hidden = true;
  beforeBtn.hidden = true;
  // Lab tools: the deeper instruments, one tap away instead of always on show
  const labBtn = setFace(h("button", "gbtn sim-btn lab-btn"), "flask", "Lab tools");
  labBtn.setAttribute("aria-haspopup", "true");
  labBtn.setAttribute("aria-expanded", "false");
  const labMenu = h("div", "lab-menu");
  labMenu.hidden = true;
  labMenu.setAttribute("role", "menu");
  [[raceBtn, "Ring the parts where two flows can arrive at once."],
   [spineBtn, "Trace what a request waits on, and what would stop everything."],
   [gifBtn, "Record a running Pulse as a looping GIF."]].forEach(([btn, desc]) => {
    const item = h("div", "lab-item");
    item.append(btn, h("p", "lab-desc", desc));
    labMenu.appendChild(item);
  });
  const setLab = open => { labMenu.hidden = !open; labBtn.setAttribute("aria-expanded", String(open)); labBtn.classList.toggle("on", open); };
  labBtn.onclick = e => { e.stopPropagation(); setLab(labMenu.hidden); };
  labMenu.onclick = e => e.stopPropagation();
  const labEsc = e => { if (e.key === "Escape" && !labMenu.hidden) { e.stopPropagation(); setLab(false); labBtn.focus(); } };
  labBtn.addEventListener("keydown", labEsc);
  labMenu.addEventListener("keydown", labEsc);
  pane.onclick = () => setLab(false);
  const capTools = h("div", "cap-tools");
  capTools.append(replayBtn, beforeBtn, playBtn, loadBtn, capSep(), labBtn, capToggle);
  dcap.append(capState, capTools);
  const scrubEl = h("div", "scrub-wrap");
  const caption = h("div", "dg-caption");
  caption.hidden = true;
  // live HUD: throughput / in-flight / crashed while the sim runs
  const hud = h("div", "dg-hud");
  hud.hidden = true;
  const hudRate = h("span", "hud-stat"), hudFlight = h("span", "hud-stat"), hudCrash = h("span", "hud-stat crash"), hudHint = h("span", "hud-hint", "tap any node to kill it");
  hud.append(hudRate, hudFlight, hudCrash, hudHint);
  const legendEl = Diagram.legend();
  dpane.append(dscroll, hud, caption, legendEl, scrubEl, dcap, labMenu);   // legend: the tutorial's grammar, always in view
  const docPane = h("div", "doc-pane");
  /* On a phone the step card is a bottom sheet over the diagram. The grip
     drags it between three heights, or steps through them by tap or arrow
     keys; the diagram gets whatever the sheet leaves. On wider screens the
     sheet is just the right-hand column and the grip is hidden. */
  const docSheet = h("div", "doc-sheet");
  const grip = h("button", "sheet-grip");
  grip.appendChild(h("span", "sheet-grip-bar"));
  docSheet.append(grip, docPane);
  wrap.append(dpane, docSheet);
  sheetDrag(wrap, docSheet, grip);
  // breadcrumb: only while nested (drilled at least one level deep)
  if (drillStack.length > 1) pane.appendChild(drillCrumb());
  pane.appendChild(wrap);

  const diagram = Diagram.mount(dscroll, rec.doc);
  diagram.onDrill((sub) => drillInto(sub));
  // the key lists only the glyphs this state actually uses, and tapping one
  // lights the nodes that carry it
  if (legendEl.update) diagram.onRender(st => legendEl.update(st, diagram));

  /* flow simulation controls — instant response on press; any state change
     stops the sim (via diagram.show) and this resets the buttons */
  let captionTimer = null;
  const resetSimUI = () => {
    setFace(playBtn, "play", "Pulse");
    playBtn.classList.remove("on");
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
      setFace(playBtn, "pause", "Rest");
      playBtn.classList.add("on");
      loadBtn.hidden = false;
      hud.hidden = false;
    }
  };
  loadBtn.onclick = () => {
    loadBtn.classList.toggle("on", diagram.sim.toggleLoad());
  };
  gifBtn.onclick = async () => {
    if (gifBtn.disabled) return;
    gifBtn.disabled = true;
    try { await exportPulseGIF(diagram, pct => { setFace(gifBtn, "record", pct + "%"); }); }
    finally { setFace(gifBtn, "record", "GIF"); gifBtn.disabled = false; }
  };
  // race spotlight: ring nodes with ≥2 concurrent payload writers (contention
  // points). Structural — works standing still; under ◉ load you watch tokens
  // actually collide there. Toggle off clears the rings.
  let raceOn = false;
  raceBtn.onclick = () => {
    raceOn = !raceOn;
    const n = diagram.raceSpotlight(raceOn);
    raceBtn.classList.toggle("race-on", raceOn);
    if (raceOn) toast(n ? `${n} contention point${n > 1 ? "s" : ""}: two or more concurrent writers` : "No contention at this state. Each node has one writer.");
  };
  // critical path: the chain a request waits on, plus the nodes whose loss
  // takes delivery with them. Structural, so it reads standing still — and the
  // spine grows layer by layer, which is the price of every fix in the ladder.
  let spineOn = false;
  spineBtn.onclick = () => {
    spineOn = !spineOn;
    const s = diagram.spineSpotlight(spineOn);
    spineBtn.classList.toggle("spine-on", spineOn);
    if (!spineOn) return;
    if (!s || !s.hops) { toast("No end-to-end path at this state"); return; }
    const parts = [`Spine: ${s.hops} hop${s.hops > 1 ? "s" : ""}`];
    // the layer-0 comparison is the point of the button: what surviving cost
    if (s.ratio > 1.05) parts.push(`${s.ratio.toFixed(1)}× layer 0`);
    else if (s.ratio < 0.95) parts.push(`shorter than layer 0`);
    if (!s.chokes) parts.push("no single point of failure");
    else parts.push(`${s.chokes} single point${s.chokes > 1 ? "s" : ""} of failure` +
                    (s.onSpine < s.chokes ? ` (${s.onSpine} on the spine)` : ""));
    toast(parts.join(" · "));
  };
  // scripted incident: two tokens run into the gate's failure, seconds apart.
  // The caption tells the reader what history they just watched.
  diagram.sim.onReplayCrash(() => {
    const p = currentView ? currentView.position : 0;
    const L = rec.doc.layers[p - 1];
    let text = "The failure, replayed. The second arrival meets the first.";
    if (L && L.problem && L.problem.statement) {
      const s = L.problem.statement.split(". ")[0];
      text = (s.length > 150 ? s.slice(0, 147) + "…" : s) + (s.endsWith(".") ? "" : ".");
    }
    caption.textContent = text;
    caption.hidden = false;
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { caption.hidden = true; }, 7000);
  });
  // rewind to the moment before this layer's fix (pre-state, failure lit
  // red), then send history's two payloads into it. Quiet when the reader
  // plays it by itself on arriving at a layer.
  const runReplay = (p, quiet) => {
    if (diagram.sim.running) diagram.sim.stop();
    caption.hidden = true;
    const L = rec.doc.layers[p - 1];
    if (!L || !L.diff.highlight.length) { if (!quiet) toast("No failure at this position. Step into a rebuild layer."); return; }
    diagram.show(p - 1, { highlight: L.diff.highlight });
    capState.textContent = `Before layer ${p} · the failure, replayed`;
    if (!diagram.sim.replay()) { if (!quiet) toast("No payload path reaches this failure"); }
    else { setFace(playBtn, "pause", "Rest"); playBtn.classList.add("on"); hud.hidden = false; }
  };
  replayBtn.onclick = () => runReplay(currentView ? currentView.position : 0, false);
  beforeBtn.onclick = () => { if (currentView) currentView.setBefore(!currentView.before); };
  // the toolbar shows what the current step can use
  const onTools = ({ step, before }) => {
    replayBtn.hidden = !diagram.sim.available || !(step === 1 || step === 2);
    beforeBtn.hidden = step !== 3;
    beforeBtn.classList.toggle("on", !!before);
    beforeBtn.setAttribute("aria-pressed", String(!!before));
    setFace(beforeBtn, "compare", before ? "After" : "Before");
  };

  // gates are opt-in: on only if this breakdown enabled them, or the user set the default on
  const challengeOn = rec.challengeMode != null ? rec.challengeMode : meta.challengeModeDefault === true;

  currentView = DocView.mount({
    docPane, diagram, rec, scrubEl,
    audience: meta.audienceMode || "enthusiast",
    challenge: challengeOn,
    onePage: meta.onePage === true,
    canReplay: diagram.sim.available,
    autoReplay: meta.autoReplay !== false,
    onReplay: runReplay,
    onTools,
    async onOpen(id) { await flushSaves(); openReader(id); },
    async onFinish() { await flushSaves(); await renderLibrary(); show("library"); },
    onSave(r) { Store.saveBreakdownLight(r); },
    canCompare() {
      if (!navigator.onLine) return { ok: false, reason: "You're offline. " + COPY.gateCompareOffline };
      if (!meta.apiKey) return { ok: false, reason: "No API key set. " + COPY.gateCompareOffline };
      return { ok: true };
    },
    onCompare(layer, attempt) {
      return Generator.compare({ apiKey: meta.apiKey, modelId: meta.modelId, layer, attempt, voice: meta.voicePass !== false });
    },
    onAsk(layer, question) {
      return Generator.ask({ apiKey: meta.apiKey, modelId: meta.modelId, doc: rec.doc, layer, question, voice: meta.voicePass !== false });
    }
  });

  buildReaderMenu(rec, challengeOn);
  show("reader");
  if (layerIndex != null) currentView.goToLayer(layerIndex);
  if (!meta.tipsSeen) setTimeout(() => { if (currentRec === rec && !document.querySelector(".tip-card")) firstRunTips(); }, 700);
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
  const PROPS = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill", "fill-opacity", "opacity", "font-size", "font-weight", "letter-spacing", "paint-order", "display"];
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
  const label = upto === 0 ? "Baseline · the naive system" : upto >= N ? "Final system · after every layer" : `After layer ${upto} of ${N}`;

  const ov = h("div", "seq-overlay");
  const bar = h("div", "seq-bar");
  const titleWrap = h("div");
  titleWrap.appendChild(h("h2", null, "Sequence · " + rec.system));
  titleWrap.appendChild(h("div", "seq-sub", label + " · order flows top to bottom"));
  const close = h("button", "gbtn seq-close", "✕ close");
  bar.append(titleWrap, close);
  const scroll = h("div", "seq-scroll");
  scroll.appendChild(Diagram.sequence(rec.doc, upto));
  const card = h("div", "seq-card");
  card.append(bar, scroll);
  ov.append(card);
  document.body.appendChild(ov);

  const dismiss = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") dismiss(); };
  close.onclick = dismiss;
  ov.addEventListener("click", e => { if (e.target === ov) dismiss(); });
  document.addEventListener("keydown", onKey);
}

/* ═══ Vocabulary index — the engineering names, and where each one showed up
   in the systems you've taken apart. Sibling to the Models index: models are
   WHY a layer is forced, this is what the profession CALLS it. ═══ */
let vocabFilter = "all";
async function renderVocab(focusId) {
  const root = $("screen-vocab").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "The engineering vocabulary"));
  root.appendChild(h("h1", "title", "What engineers call it"));
  root.appendChild(h("p", "subtitle", "Patterns are problem shapes, concepts are mechanisms, technologies are things you deploy. Every entry links back to the timeless thinking model underneath it, and to the layers where you watched it become necessary."));

  // where each id appears across the reader's library
  const uses = {};
  try {
    (await Store.getBreakdowns()).forEach(b => {
      if (!b.doc || !b.doc.layers) return;
      b.doc.layers.forEach(L => ((L.developer && L.developer.vocab) || []).forEach(id => {
        (uses[id] = uses[id] || []).push({ system: b.system, id: b.id, index: L.index, name: L.name });
      }));
    });
  } catch (e) { /* library unreadable — the index still lists the vocabulary */ }

  root.appendChild(modelTabs("vocab"));

  const seg = h("div", "seg vocab-seg");
  [["all", "All"], ["pattern", "Patterns"], ["concept", "Concepts"], ["technology", "Technologies"]].forEach(([id, label]) => {
    const b = h("button", vocabFilter === id ? "on" : "", label);
    b.onclick = () => { vocabFilter = id; renderVocab(); };
    seg.appendChild(b);
  });
  root.appendChild(seg);

  const grid = h("div", "card-grid vocab-grid");
  VOCAB_LIBRARY.filter(v => vocabFilter === "all" || v.tier === vocabFilter).forEach(v => {
    const card = h("div", "ml-card vocab-card" + (focusId === v.id ? " focused" : ""));
    const head = h("div", "vc-head");
    head.appendChild(h("span", "vocab-chip tier-" + v.tier + " static", v.name));
    head.appendChild(h("span", "vo-tier", v.tier));
    card.appendChild(head);
    card.appendChild(h("p", "vc-one", v.one_liner));
    card.appendChild(h("p", "vc-appears", v.appears));
    const hits = uses[v.id] || [];
    const foot = h("div", "vc-foot");
    foot.appendChild(h("span", "ml-count", hits.length
      ? hits.length + " layer" + (hits.length > 1 ? "s" : "") + " · " + new Set(hits.map(x => x.id)).size + " system(s)"
      : "not yet seen"));
    (v.models || []).map(modelById).filter(Boolean).forEach(m => {
      const mb = h("button", "vc-model", m.name);
      mb.title = m.one_liner;
      mb.onclick = () => { renderModels(m.id); show("models"); };
      foot.appendChild(mb);
    });
    card.appendChild(foot);
    hits.slice(0, 3).forEach(hit => {
      const b = h("button", "vc-hit");
      b.textContent = hit.system + " · layer " + hit.index;
      b.onclick = () => openReader(hit.id, hit.index);
      card.appendChild(b);
    });
    grid.appendChild(card);
  });
  root.appendChild(grid);
  if (focusId) {
    const el = grid.querySelector(".focused");
    if (el) el.scrollIntoView({ block: "center", behavior: RM_PREF() ? "auto" : "smooth" });
  }
}
function RM_PREF() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

/* ═══ Vocabulary ladder: tap a "Known as" chip to climb from the timeless
   thinking model (WHY this layer is forced) down through the concept and the
   component you'd actually deploy. The ladder is what neither a reference site
   nor a bare diagram gives you: the name AND the reason it exists. ═══ */
async function openVocab(v, layer) {
  const ov = h("div", "seq-overlay vocab-overlay");
  const bar = h("div", "seq-bar");
  const titleWrap = h("div");
  const tRow = h("div", "vo-title");
  tRow.appendChild(h("span", "vocab-chip tier-" + v.tier + " static", v.name));
  tRow.appendChild(h("span", "vo-tier", v.tier));
  titleWrap.appendChild(tRow);
  titleWrap.appendChild(h("div", "seq-sub", v.one_liner));
  const close = h("button", "gbtn seq-close", "✕ close");
  bar.append(titleWrap, close);

  const body = h("div", "seq-scroll vo-body");
  body.appendChild(h("p", "vo-appears", v.appears));

  // the ladder for THIS layer, when opened from one
  if (layer) {
    const lad = h("div", "vo-ladder");
    lad.appendChild(h("div", "mono-label", "In this layer"));
    const rung = (label, text, cls) => {
      const r = h("div", "vo-rung " + (cls || ""));
      r.appendChild(h("span", "vo-rung-label", label));
      r.appendChild(h("span", "vo-rung-text", text));
      lad.appendChild(r);
    };
    const m = layer.problem && layer.problem.model ? modelById(layer.problem.model.id) : null;
    if (m) rung("why it's forced", m.name + ": " + m.one_liner, "rung-model");
    const sibs = (layer.developer.vocab || []).map(vocabById).filter(Boolean);
    ["pattern", "concept", "technology"].forEach(tier => {
      sibs.filter(s => s.tier === tier).forEach(s => {
        rung(tier === "pattern" ? "the problem shape" : tier === "concept" ? "the mechanism" : "what you'd deploy",
             s.name + (s.id === v.id ? "" : ""), "rung-" + tier + (s.id === v.id ? " rung-here" : ""));
      });
    });
    body.appendChild(lad);
  }

  // the timeless models this vocabulary expresses
  const rel = (v.models || []).map(modelById).filter(Boolean);
  if (rel.length) {
    const rw = h("div", "vo-models");
    rw.appendChild(h("div", "mono-label", "Thinking models behind it"));
    rel.forEach(m => {
      const b = h("button", "gbtn vo-model-btn", m.name);
      b.title = m.one_liner;
      b.onclick = () => { dismiss(); renderModels(m.id); show("models"); };
      rw.appendChild(b);
    });
    body.appendChild(rw);
  }

  // recurrence: the same force showing up across the reader's own library
  const recur = h("div", "vo-recur");
  recur.appendChild(h("div", "mono-label", "Where else it appears"));
  body.appendChild(recur);
  ov.append(bar, body);
  document.body.appendChild(ov);

  const dismiss = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") dismiss(); };
  close.onclick = dismiss;
  ov.addEventListener("click", e => { if (e.target === ov) dismiss(); });
  document.addEventListener("keydown", onKey);

  try {
    const all = await Store.getBreakdowns();
    const hits = [];
    all.forEach(b => {
      if (!b.doc || !b.doc.layers) return;
      b.doc.layers.forEach(L => {
        if ((L.developer && L.developer.vocab || []).indexOf(v.id) !== -1)
          hits.push({ system: b.system, id: b.id, index: L.index, name: L.name });
      });
    });
    if (!hits.length) { recur.appendChild(h("p", "vo-none", "Not yet. It hasn't shown up in another Deconstruct you've opened.")); return; }
    hits.slice(0, 8).forEach(hit => {
      const row = h("button", "vo-hit");
      row.appendChild(h("span", "vo-hit-sys", hit.system));
      row.appendChild(h("span", "vo-hit-layer", "Layer " + hit.index + " · " + hit.name));
      row.onclick = () => { dismiss(); openReader(hit.id, hit.index); };
      recur.appendChild(row);
    });
  } catch (e) { recur.appendChild(h("p", "vo-none", "Couldn't read your library.")); }
}

function buildReaderMenu(rec, challengeOn) {
  const pop = $("menuPop");
  pop.textContent = "";
  const add = (label, fn, cls) => {
    const b = h("button", cls || "", label);
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    pop.appendChild(b);
  };
  // Graft + Sequence live in the topbar. The ⋯ menu holds the two reading
  // preferences and the rarer, one-shot actions.
  const check = (label, on, fn) => {
    const b = h("button", "menu-check" + (on ? " on" : ""), label);
    b.setAttribute("role", "menuitemcheckbox");
    b.setAttribute("aria-checked", String(!!on));
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    pop.appendChild(b);
  };
  check("Strict mode: write your fix first", challengeOn, () => {
    rec.challengeMode = !challengeOn;
    Store.saveBreakdownLight(rec);
    if (currentView) currentView.setChallenge(rec.challengeMode);
    buildReaderMenu(rec, rec.challengeMode);
    toast(rec.challengeMode ? "Strict mode on. The fix opens once you've sketched yours." : "Strict mode off");
  });
  check("Read each layer as one page", meta.onePage === true, async () => {
    meta.onePage = !(meta.onePage === true);
    await Store.saveMeta({ onePage: meta.onePage });
    if (currentView) currentView.setOnePage(meta.onePage);
    buildReaderMenu(rec, challengeOn);
  });
  /* On a phone the topbar cannot hold the three contextual tools as well as
     the brand, the audience switch and this menu: they overflow their own
     container and land on top of the audience switch. CSS hides them there
     and shows these entries instead, which click the very same buttons, so
     there is one handler per tool rather than two that can drift apart. */
  // Gate on the button existing, not on it being visible: this menu is built
  // when the reader opens, which is before the topbar reveals those buttons,
  // so a `hidden` check here silently produced no entries at all.
  const compact = [["sheetBtn", "System sheet"], ["seqBtn", "Sequence view"], ["graftBtn", "Graft a change"]]
    .filter(([id]) => !!$(id));
  if (compact.length) {
    pop.appendChild(h("div", "menu-sep menu-compact"));
    compact.forEach(([id, label]) => add(label, () => $(id).click(), "menu-compact"));
  }
  pop.appendChild(h("div", "menu-sep"));
  add("Field guide", () => { renderTutorial("reader"); show("tutorial"); });
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
      row.onclick = () => { showResult(wi.result, wi.change, wi.guess); resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); };
      savedWrap.appendChild(row);
    });
  }

  function showResult(w, change, guess) {
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
    const abBtn = h("button", "gbtn sim-btn on", "Graft on");
    let graftOn = true;
    abBtn.onclick = () => {
      graftOn = !graftOn;
      abBtn.textContent = graftOn ? "Graft on" : "Graft off";
      abBtn.classList.toggle("on", graftOn);
      showGraft(graftOn);
    };
    ctl.appendChild(abBtn);
    if (dg.sim.available) {
      const wp = setFace(h("button", "gbtn sim-btn sim-primary"), "play", "Pulse");
      const wl = setFace(h("button", "gbtn sim-btn"), "gauge", "Load");
      wl.hidden = true;
      dg.sim.onStop(() => { setFace(wp, "play", "Pulse"); wp.classList.remove("on"); wl.hidden = true; wl.classList.remove("on"); });
      wp.onclick = () => {
        if (dg.sim.running) dg.sim.stop();
        else if (dg.sim.start()) { setFace(wp, "pause", "Rest"); wp.classList.add("on"); wl.hidden = false; }
      };
      wl.onclick = () => wl.classList.toggle("on", dg.sim.toggleLoad());
      ctl.append(wp, wl);
    }
    dpane.appendChild(ctl);

    resultEl.appendChild(verdictCard(w, rec.doc, {
      guess,
      onAlt: a => {
        ta.value = a.name + ": " + a.note;
        ta.focus();
        compose.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }));
  }

  renderSaved();
  if (opts.result) showResult(opts.result, opts.change);

  /* Guess first. The verdict is requested straight away; while it's judged,
     you call it yourself: does the change improve the system, and which rule
     does it put at risk? Then the verdict, with your call beside it. */
  function guessPanel(guess, onChange) {
    const box = h("section", "graft-guess");
    box.appendChild(h("div", "step-kick tone-vio", "Your call"));
    box.appendChild(h("h3", "move-q", "While it's judged: what will this change do?"));
    const vlist = h("div", "rule-list");
    [["improves", "It improves the system"], ["mixed", "A real tradeoff: better in one way, worse in another"], ["harmful", "It works against the system"]].forEach(([id, label]) => {
      const b = h("button", "rule-opt");
      b.append(h("span", "rule-n", ""), h("span", "rule-t", label));
      b.onclick = () => { guess.verdict = id; vlist.querySelectorAll(".rule-opt").forEach(x => x.classList.toggle("chosen", x === b)); onChange(); };
      vlist.appendChild(b);
    });
    box.appendChild(vlist);
    box.appendChild(h("h3", "move-q graft-q2", "Which rule does it put most at risk?"));
    const rlist = h("div", "rule-list");
    const rules = rec.doc.strip_down.invariants.map((iv, k) => [iv.id, "Rule " + (k + 1), iv.text]).concat([["none", "", "None of them"]]);
    rules.forEach(([id, n, text]) => {
      const b = h("button", "rule-opt");
      b.append(h("span", "rule-n", n), h("span", "rule-t", text));
      b.onclick = () => { guess.rule = id; rlist.querySelectorAll(".rule-opt").forEach(x => x.classList.toggle("chosen", x === b)); onChange(); };
      rlist.appendChild(b);
    });
    box.appendChild(rlist);
    return box;
  }

  runBtn.onclick = async () => {
    const change = ta.value.trim();
    if (change.length < 4) { ta.focus(); return; }
    if (!meta.apiKey) { renderSettings("Add your Anthropic API key to run grafts."); show("settings"); return; }
    if (!navigator.onLine) { toast("A graft needs a connection"); return; }
    runBtn.disabled = true;
    ta.disabled = true;
    resultEl.textContent = "";
    const guess = { verdict: null, rule: null };
    let w = null, failed = null;
    const foot = h("div", "graft-reveal");
    const status = h("span", "step-foot-note", COPY.whatifThinking);
    const reveal = ctaButton("Show the verdict");
    reveal.disabled = true;
    const sync = () => {
      reveal.disabled = !w;
      status.textContent = w ? (guess.verdict ? "The verdict is ready." : "The verdict is ready. Make your call first, or just look.") : COPY.whatifThinking;
    };
    resultEl.appendChild(guessPanel(guess, sync));
    foot.append(status, reveal);
    resultEl.appendChild(foot);
    const done = () => { runBtn.disabled = false; runBtn.textContent = COPY.whatifBtn; ta.disabled = false; };
    reveal.onclick = async () => {
      (rec.whatifs = rec.whatifs || []).push({ change, result: w, guess, ts: Date.now() });
      await Store.saveBreakdownLight(rec);
      showResult(w, change, guess);
      renderSaved();
      resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    try {
      w = await Generator.whatif({ apiKey: meta.apiKey, modelId: meta.modelId, doc: rec.doc, change, speed: meta.genSpeed || "balanced", voice: meta.voicePass !== false });
      sync();
    } catch (e) {
      failed = e;
      resultEl.textContent = "";
      const box = h("div", "gen-error");
      box.appendChild(h("h3", null, e.kind === "key" ? "Invalid API key" : "Graft failed"));
      box.appendChild(h("p", null, e.message));
      resultEl.appendChild(box);
    } finally { done(); }
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
  const g = opts.guess;
  if (g && (g.verdict || g.rule)) {
    const VERB = { improves: "it improves the system", mixed: "a real tradeoff", harmful: "it works against the system" };
    const parts = [];
    if (g.verdict) parts.push(g.verdict === w.verdict ? `You called it: ${VERB[w.verdict]}.` : `You said ${VERB[g.verdict]}; the verdict is ${VERB[w.verdict] || w.verdict}.`);
    if (g.rule) {
      const n = id => "Rule " + (invById[id] ? invById[id].n : "?");
      if (g.rule === "none") parts.push(w.stresses && w.stresses.length ? `You expected no rule at risk; it threatens ${w.stresses.map(n).join(" and ")}.` : "You expected no rule at risk, and none is threatened.");
      else parts.push((w.stresses || []).includes(g.rule) ? `And ${n(g.rule)} is the one it threatens.` : `You picked ${n(g.rule)}; ` + (w.stresses && w.stresses.length ? `it threatens ${w.stresses.map(n).join(" and ")}.` : "it threatens none of them."));
    }
    card.appendChild(h("p", "vf-guess" + (g.verdict === w.verdict ? " hit" : ""), parts.join(" ")));
  }
  card.appendChild(h("p", "vf-assessment", w.assessment));
  if (w.gain) { const g = h("p", "vf-line"); g.appendChild(h("b", null, "Gains: ")); g.appendChild(document.createTextNode(w.gain)); card.appendChild(g); }

  // rules by number AND text: a reader shouldn't have to remember what Rule 3 was
  const ruleRows = (label, ids, cls) => {
    if (!ids || !ids.length) return;
    const r = h("div", "defends-row defends-full");
    r.appendChild(h("span", "mono-label", label));
    ids.forEach(id => {
      const line = h("div", "defends-line");
      line.append(h("span", "inv-badge" + (cls ? " " + cls : ""), "Rule " + (invById[id] ? invById[id].n : "?")),
        h("span", "defends-text", invById[id] ? invById[id].text : id));
      r.appendChild(line);
    });
    card.appendChild(r);
  };
  ruleRows("Threatens", w.stresses, "stress");
  ruleRows("Strengthens", w.defends, "");
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

  /* Dissect asks three plain questions instead of one blank box: what it
     does and for whom, what must never go wrong, and where the load comes
     from. They become the brief the model rebuilds from. */
  let designInput = null, focus = null, dq = null;
  if (design) {
    root.appendChild(h("p", "subtitle", COPY.ownDesignLede));
    dq = {};
    const form = h("div", "dissect-form");
    COPY.dissectQuestions.forEach(([id, label, hint, rows], i) => {
      const f = h("label", "dissect-q");
      f.append(h("span", "dissect-n", String(i + 1)), h("span", "dissect-label", label));
      const ta = h("textarea", "design-input");
      ta.rows = rows;
      ta.placeholder = hint;
      ta.maxLength = 600;
      if (i === 0 && systemName) ta.value = systemName;
      dq[id] = ta;
      f.appendChild(ta);
      form.appendChild(f);
    });
    root.appendChild(form);
    designInput = dq.what;
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
    let subject = systemName;
    if (design) {
      if (dq.what.value.trim().length < 12) { dq.what.focus(); toast("Say a little more about what it does"); return; }
      subject = COPY.dissectQuestions.map(([id, label]) => dq[id].value.trim() ? label + "\n" + dq[id].value.trim() : "").filter(Boolean).join("\n\n");
    }
    startBtn.disabled = true;
    if (dq) Object.values(dq).forEach(t => t.disabled = true);
    if (focus) focus.disabled = true;
    prog.textContent = "";
    const phaseEl = h("div", "gen-phase", COPY.genPhases.start);
    const barEl = h("div", "gen-bar");
    const fill = h("div");
    barEl.appendChild(fill);
    const tok = h("div", "gen-tokens", "");
    prog.append(phaseEl, barEl, tok);
    const early = earlyMeet();
    prog.appendChild(early.el);

    const PHASE_PCT = { start: 4, strip_down: 18, visual: 30, layers: 42, stress: 78, transfer: 88, repair: 92, voice: 96 };
    try {
      const { doc, repaired, voice } = await Generator.generate({
        apiKey: meta.apiKey, modelId: meta.modelId, voice: meta.voicePass !== false,
        system: subject, focus: focus ? focus.value.trim() : "", mode,
        speed: meta.genSpeed || "balanced",
        onProgress(p) {
          if (p.phase) {
            phaseEl.textContent = p.phase === "repair" ? "Repairing validation errors…" : (COPY.genPhases[p.phase] || phaseEl.textContent);
            fill.style.width = (PHASE_PCT[p.phase] || 0) + "%";
          }
          if (p.tokens) tok.textContent = "~" + p.tokens.toLocaleString() + " tokens";
          if (p.partial) early.update(p.partial);
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
      else if (voice && voice.fixed) toast(`Edited ${voice.fixed} passage${voice.fixed > 1 ? "s" : ""} for voice`);
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
        b.onclick = () => { startBtn.disabled = false; if (focus) focus.disabled = false; if (dq) Object.values(dq).forEach(t => t.disabled = false); prog.textContent = ""; startBtn.click(); };
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
      if (dq) Object.values(dq).forEach(t => t.disabled = false);
    }
  };
}

/* While a Deconstruct streams in, the essence and the rules arrive first.
   Show them as soon as each string is complete so there's something to
   read during the wait; it's the same Meet you'd open afterwards. */
function earlyMeet() {
  const el = h("section", "early-meet");
  el.hidden = true;
  const ess = h("p", "early-essence");
  const rules = h("ol", "early-rules");
  el.append(h("div", "step-kick tone-ink", "Meet the system, while the rest is written"), ess,
    h("div", "early-sub", "The rules it lives by"), rules);
  rules.hidden = true;
  let shownRules = 0;
  const STR = '"((?:[^"\\\\]|\\\\.)*)"';
  const dec = x => { try { return JSON.parse('"' + x + '"'); } catch (e) { return x; } };
  function update(text) {
    if (!ess.textContent) {
      const m = new RegExp('"essence"\\s*:\\s*\\{\\s*"text"\\s*:\\s*' + STR).exec(text);
      if (m) { ess.textContent = dec(m[1]); el.hidden = false; }
    }
    const at = text.indexOf('"invariants"');
    if (at < 0) return;
    const end = text.indexOf('"entities"', at);
    const chunk = text.slice(at, end < 0 ? undefined : end);
    const re = new RegExp('"text"\\s*:\\s*' + STR, "g");
    const found = [];
    let m;
    while ((m = re.exec(chunk))) found.push(dec(m[1]));
    for (; shownRules < found.length; shownRules++) {
      rules.appendChild(h("li", null, found[shownRules]));
      rules.hidden = false;
      el.hidden = false;
    }
  }
  return { el, update };
}

/* ═══ Models index (§11.4) ═══ */
/* ═══ Models: each thinking model as something to learn, not a catalog row.
   The index shows which ones you've collected; a model's page puts every
   place you met it side by side, quizzes you on spotting it in failures you
   haven't read yet, and lists its names in other fields. ═══ */
function modelTabs(active) {
  const seg = h("div", "seg models-tabs");
  [["models", "Thinking models"], ["vocab", "Engineering vocabulary"]].forEach(([id, label]) => {
    const b = h("button", active === id ? "on" : "", label);
    b.onclick = () => { if (id === "models") { renderModels(); show("models"); } else { renderVocab(); show("vocab"); } };
    seg.appendChild(b);
  });
  return seg;
}
function modelUses(recs, id) {
  const out = [];
  recs.forEach(rec => rec.doc.layers.forEach(L => {
    if (L.problem.model.id !== id) return;
    const a = rec.attempts[L.index];
    out.push({ rec, L, read: !!(a && a.revealed) });
  }));
  return out;
}
async function renderModels(detailId) {
  const root = $("screen-models").firstElementChild;
  root.textContent = "";
  const recs = await Store.getBreakdowns();
  if (detailId) return renderModel(root, recs, detailId);

  root.appendChild(h("div", "kicker", "Cross-system pattern recognition"));
  root.appendChild(h("h1", "title", "The 14 thinking models"));
  root.appendChild(h("p", "subtitle", "Every layer names the idea that cracks its problem. The same fourteen keep coming back, so learning to spot them is most of what taking systems apart teaches."));
  root.appendChild(modelTabs("models"));
  const grid = h("div", "model-grid");
  MODEL_LIBRARY.forEach(m => {
    const uses = modelUses(recs, m.id), read = uses.filter(u => u.read).length;
    const systems = new Set(uses.map(u => u.rec.id)).size;
    const card = h("button", "ml-card");
    card.appendChild(h("div", "ml-name", m.name));
    card.appendChild(h("div", "ml-one", m.one_liner));
    card.appendChild(h("div", "ml-count", systems ? `In ${systems} system${systems > 1 ? "s" : ""}` + (read ? ` · you've read ${read}` : "") : "Not in your library yet"));
    card.onclick = () => renderModels(m.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function renderModel(root, recs, id) {
  const m = MODEL_LIBRARY.find(x => x.id === id);
  const uses = modelUses(recs, id);
  const read = uses.filter(u => u.read), unread = uses.filter(u => !u.read);
  const back = h("button", "gbtn ghost", "‹ All models");
  back.onclick = () => renderModels();
  root.appendChild(back);
  root.appendChild(h("div", "kicker", "Thinking model"));
  root.appendChild(h("h1", "title", m.name));
  root.appendChild(h("p", "subtitle", m.one_liner));
  root.appendChild(h("p", "essence", m.description));

  const layout = h("div", "model-layout");
  const main = h("div", "model-main");
  const side = h("aside", "model-side");

  // every place you met it, side by side, with the fix in teal
  main.appendChild(h("h2", "section-head", "Where you've met it"));
  const systems = new Set(uses.map(u => u.rec.id)).size;
  main.appendChild(h("p", "lib-note", read.length
    ? `${systems} system${systems > 1 ? "s" : ""} in your library use it; you've read ${read.length} of those layers.`
    : `${systems} system${systems > 1 ? "s" : ""} in your library use it.`));
  const grid = h("div", "met-grid");
  (read.length ? read : uses).slice(0, 6).forEach(u => {
    const card = h("button", "met-card");
    const thumb = h("div", "home-thumb met-thumb");
    card.appendChild(thumb);
    card.appendChild(h("div", "met-sys", `${u.rec.system} · layer ${u.L.index}`));
    card.appendChild(h("div", "met-name", u.read ? u.L.name.split(":")[0] : "Not read yet"));
    card.appendChild(h("p", "met-why", u.L.problem.model.application));
    card.onclick = () => openReader(u.rec.id, u.L.index);
    grid.appendChild(card);
    try { Diagram.mount(thumb, u.rec.doc).show(u.L.index); } catch (e) { thumb.remove(); }
  });
  main.appendChild(grid);
  const rest = (read.length ? uses.slice(0, 0).concat(read.slice(6), unread) : uses.slice(6));
  if (rest.length) {
    const more = h("div", "met-more");
    more.appendChild(h("div", "mono-label", read.length ? "Also in" : "More"));
    rest.forEach(u => {
      const row = h("button", "ml-use");
      const left = h("div");
      left.append(h("div", "mu-sys", u.rec.system), h("div", "mu-layer", `Layer ${u.L.index}` + (u.read ? " · " + u.L.name.split(":")[0] : " · not read yet")));
      row.append(left, h("span", "mr-arrow", "›"));
      row.onclick = () => openReader(u.rec.id, u.L.index);
      more.appendChild(row);
    });
    main.appendChild(more);
  }

  // Spot it: failures from layers you haven't read; is this the model?
  main.appendChild(spotIt(recs, m));

  // its names in other fields
  const names = typeof rosettaFor === "function" ? rosettaFor(id, null) : [];
  if (names.length) {
    side.appendChild(h("div", "mono-label", "Also called"));
    const list = h("div", "aka-list");
    names.forEach(n => {
      const row = h("div", "aka-row");
      row.append(h("span", "aka-dom", n.label), h("span", "aka-term", n.term));
      list.appendChild(row);
    });
    side.appendChild(list);
  }
  layout.append(main, side);
  root.appendChild(layout);
}

/* Spot it: three failures you haven't read. For each, does this model
   crack it? Two use the model when there are enough; the rest use others. */
function spotIt(recs, m) {
  const box = h("section", "spot-it");
  box.appendChild(h("div", "step-kick tone-vio", "Spot it"));
  box.appendChild(h("h3", "move-q", `Does ${m.name} crack these failures?`));
  const pool = [];
  recs.forEach(rec => rec.doc.layers.forEach(L => {
    const a = rec.attempts[L.index];
    if (!(a && a.revealed)) pool.push({ rec, L, yes: L.problem.model.id === m.id });
  }));
  const pick = (list, n) => list.map(x => ({ x, k: Math.random() })).sort((p, q) => p.k - q.k).slice(0, n).map(p => p.x);
  const yes = pick(pool.filter(p => p.yes), 2);
  const items = pick(yes.concat(pick(pool.filter(p => !p.yes), 3 - yes.length)), 3);
  if (items.length < 2) {
    box.appendChild(h("p", "lib-note", "You've read nearly everything already. Spot it uses failures you haven't seen, so there's nothing left to test you on here."));
    return box;
  }
  box.appendChild(h("p", "lib-note", "These come from layers you haven't read, so recognising the idea is the whole exercise."));
  let right = 0, answered = 0;
  const score = h("p", "pb-result");
  items.forEach(it => {
    const card = h("div", "spot-q");
    card.appendChild(h("div", "rv-where", it.rec.system));
    card.appendChild(h("p", "rv-prompt", it.L.problem.beginner || it.L.problem.statement));
    const row = h("div", "spot-row");
    const fb = h("p", "spot-fb");
    [["Yes", true], ["No", false]].forEach(([lab, val]) => {
      const b = h("button", "gbtn", lab);
      b.onclick = () => {
        row.querySelectorAll("button").forEach(x => { x.disabled = true; });
        const ok = val === it.yes;
        answered++; if (ok) right++;
        b.classList.add(ok ? "spot-ok" : "spot-no");
        const actual = MODEL_LIBRARY.find(x => x.id === it.L.problem.model.id);
        fb.textContent = (ok ? "Right. " : "Not this time. ") + (it.yes ? `It's ${m.name}.` : `That one is ${actual ? actual.name : "a different model"}.`);
        if (answered === items.length) score.textContent = `${right} of ${items.length}. Open any of these systems to see the idea at work.`;
      };
      row.appendChild(b);
    });
    card.append(row, fb);
    box.appendChild(card);
  });
  box.appendChild(score);
  return box;
}

/* ═══ Pulse → GIF: record a few seconds of the running simulation as a
   looping GIF for sharing. Self-contained GIF89a + LZW encoder (no deps, CSP
   safe). Palette is a fixed 6·6·6 colour cube + a grey ramp, nearest-match —
   the diagram is flat colour so uniform quantization reads clean. ═══ */
var VGif = (() => {
  // fixed palette: 216 web-cube + 40-step grey ramp = 256
  const PAL = [];
  const lv = [0, 51, 102, 153, 204, 255];
  for (const r of lv) for (const g of lv) for (const b of lv) PAL.push([r, g, b]);
  for (let i = 0; i < 40; i++) { const v = Math.round(i * 255 / 39); PAL.push([v, v, v]); }
  // nearest-palette lookup, memoised on a coarse key
  const cache = new Map();
  function idx(r, g, b) {
    const key = (r >> 2 << 12) | (g >> 2 << 6) | (b >> 2);
    let v = cache.get(key); if (v !== undefined) return v;
    let best = 0, bd = 1e9;
    for (let i = 0; i < PAL.length; i++) {
      const dr = PAL[i][0] - r, dg = PAL[i][1] - g, db = PAL[i][2] - b, d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = i; }
    }
    cache.set(key, best); return best;
  }
  // LZW compress a frame of indices → GIF sub-blocks
  function lzw(minCode, indices, out) {
    const clear = 1 << minCode, eoi = clear + 1;
    let dict, codeSize, next;
    const init = () => { dict = new Map(); for (let i = 0; i < clear; i++) dict.set("" + i, i); codeSize = minCode + 1; next = eoi + 1; };
    let acc = 0, nbits = 0;
    const chunk = [];
    const emit = code => {
      acc |= code << nbits; nbits += codeSize;
      while (nbits >= 8) { chunk.push(acc & 255); acc >>= 8; nbits -= 8; }
    };
    init(); emit(clear);
    let prefix = "" + indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], comb = prefix + "," + k;
      if (dict.has(comb)) { prefix = comb; continue; }
      emit(dict.get(prefix));
      if (next < 4096) {
        dict.set(comb, next++);
        if (next === (1 << codeSize) && codeSize < 12) codeSize++;   // bump BEFORE the next code needs the wider width
      } else {
        emit(clear); init();                                         // dictionary full → reset
      }
      prefix = "" + k;
    }
    emit(dict.get(prefix)); emit(eoi);
    if (nbits > 0) chunk.push(acc & 255);
    // pack into ≤255-byte sub-blocks
    for (let i = 0; i < chunk.length; i += 255) {
      const slice = chunk.slice(i, i + 255);
      out.push(slice.length, ...slice);
    }
    out.push(0);
  }
  function encode(frames, w, h, delayCs) {
    const b = [];
    const push = (...xs) => b.push(...xs);
    const u16 = n => push(n & 255, (n >> 8) & 255);
    push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);          // GIF89a
    u16(w); u16(h);
    push(0xF7, 0, 0);                                   // global palette, 256 colours
    for (const c of PAL) push(c[0], c[1], c[2]);
    push(0x21, 0xFF, 0x0B); "NETSCAPE2.0".split("").forEach(ch => push(ch.charCodeAt(0)));
    push(0x03, 0x01, 0, 0, 0);                          // loop forever
    for (const fr of frames) {
      push(0x21, 0xF9, 0x04, 0x04); u16(delayCs); push(0, 0);   // graphic control, delay
      push(0x2C); u16(0); u16(0); u16(w); u16(h); push(0);      // image descriptor
      const minCode = 8; push(minCode);
      lzw(minCode, fr, b);
    }
    push(0x3B);
    return new Uint8Array(b);
  }
  return { idx, encode };
})();

/* record ~2.5s of the running Pulse as a looping GIF. Static structure is
   style-inlined once; each frame only swaps in the live token layer (tokens
   carry inline styles, so they serialise without re-inlining) — cheap enough
   to grab ~20 frames. */
async function exportPulseGIF(diagram, onProgress) {
  const svgEl = document.querySelector("#screen-reader .dg-svg");
  if (!svgEl) { toast("Open a diagram first"); return; }
  if (!diagram.sim.available) { toast("Motion is off (reduced-motion)"); return; }
  const started = !diagram.sim.running && diagram.sim.start();
  if (!diagram.sim.running) { toast("Press pulse first"); return; }

  const vb = svgEl.viewBox.baseVal;
  const scale = Math.min(1, 460 / vb.width);
  const W = Math.round(vb.width * scale), H = Math.round(vb.height * scale);
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#f5f2ea";

  // static clone with computed styles inlined once
  const clone = svgEl.cloneNode(true);
  const src = [svgEl, ...svgEl.querySelectorAll("*")], dst = [clone, ...clone.querySelectorAll("*")];
  const PROPS = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill", "fill-opacity", "opacity", "font-size", "font-weight", "letter-spacing", "paint-order", "display"];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v); });
    if (el.tagName === "text" || el.tagName === "tspan") dst[i].style.fontFamily = "ui-monospace, Menlo, monospace";
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.width = W + "px"; clone.style.minWidth = "0"; clone.setAttribute("width", W); clone.setAttribute("height", H);
  const cloneSim = clone.querySelector(".dg-sim");
  const liveSim = svgEl.querySelector(".dg-sim");

  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d");
  const NFRAMES = 20, DELAY_CS = 12;                    // ~0.12s × 20 ≈ 2.4s loop
  const frames = [];

  async function grab() {
    if (cloneSim && liveSim) { cloneSim.textContent = ""; [...liveSim.childNodes].forEach(n => cloneSim.appendChild(n.cloneNode(true))); }
    const data = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await new Promise((res, rej) => { const im = new Image(); im.onload = () => { cx.fillStyle = paper; cx.fillRect(0, 0, W, H); cx.drawImage(im, 0, 0, W, H); res(); }; im.onerror = rej; im.src = data; }).catch(() => {});
    const px = cx.getImageData(0, 0, W, H).data, idxs = new Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) idxs[j] = VGif.idx(px[i], px[i + 1], px[i + 2]);
    frames.push(idxs);
  }

  for (let f = 0; f < NFRAMES; f++) {
    await grab();
    if (onProgress) onProgress(Math.round(100 * (f + 1) / NFRAMES));
    await new Promise(r => setTimeout(r, 110));
  }
  if (started) diagram.sim.stop();

  const bytes = VGif.encode(frames, W, H, DELAY_CS);
  const blob = new Blob([bytes], { type: "image/gif" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vitruvian-pulse.gif";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Pulse GIF exported");
}

/* ═══ Practice: optional questions on layers you've read (review.js).
   Nothing is scheduled or due. Model and rule questions check themselves;
   fix, cost and probe questions ask you to recall first, then compare. ═══ */
let reviewState = null;
async function renderDrill(opts = {}) {
  const root = $("screen-drill").firstElementChild;
  root.textContent = "";
  const recs = await Store.getBreakdowns();
  const audience = meta.audienceMode || "enthusiast";
  if (!opts.keep || !reviewState) {
    reviewState = { deck: Review.deck(recs, { systems: opts.systems || null, audience }), i: 0, right: 0, checked: 0, systems: opts.systems || null, label: opts.label || null };
  }
  const st = reviewState;
  root.appendChild(h("div", "kicker", st.label || "Practice"));
  root.appendChild(h("h1", "title", "Practice"));
  if (!st.deck.length) {
    root.appendChild(h("p", "subtitle", "Nothing to practise yet. Read a layer of any Deconstruct through to its solution and you can quiz yourself on it here."));
    const go = ctaButton("Back home");
    go.onclick = async () => { await renderLibrary(); show("library"); };
    root.appendChild(go);
    return;
  }
  if (st.i >= st.deck.length) return practiceDone(root, st);
  root.appendChild(h("p", "subtitle", `A few questions on layers you've read, whenever you like. ${st.deck.length - st.i} left in this round.`));
  const bar = h("div", "rv-progress");
  st.deck.forEach((_, k) => bar.appendChild(h("span", k < st.i ? "done" : k === st.i ? "on" : "")));
  root.appendChild(bar);
  reviewCard(root, st.deck[st.i], audience);
}

function reviewCard(root, c, audience) {
  const { rec, L } = c;
  const card = h("div", "rv-card");
  card.appendChild(h("div", "rv-type", c.label));
  card.appendChild(h("div", "rv-where", `${rec.system} · layer ${L.index}`));
  const next = () => { reviewState.i++; renderDrill({ keep: true }); };
  const nextBtn = () => { const b = ctaButton("Next question"); b.onclick = next; return b; };
  const problem = audience === "beginner" ? L.problem.beginner : L.problem.statement;
  const model = MODEL_LIBRARY.find(m => m.id === L.problem.model.id);

  if (c.type === "model" || c.type === "rule") {
    card.appendChild(h("p", "rv-prompt", problem));
    const list = h("div", "rule-list");
    const ruleN = {}; rec.doc.strip_down.invariants.forEach((iv, k) => { ruleN[iv.id] = k + 1; });
    const feedback = h("div");
    c.options.forEach(o => {
      const btn = h("button", "rule-opt");
      if (c.type === "model") {
        const m = MODEL_LIBRARY.find(x => x.id === o.id);
        btn.append(h("span", "rule-n", "Model"), h("span", "rule-t", m ? m.name : o.id));
      } else {
        const iv = rec.doc.strip_down.invariants.find(x => x.id === o.id);
        btn.append(h("span", "rule-n", "Rule " + ruleN[o.id]), h("span", "rule-t", iv ? iv.text : o.id));
      }
      btn.onclick = () => {
        list.querySelectorAll("button").forEach(x => { x.disabled = true; });
        c.options.forEach((o2, k) => { if (o2.right) list.children[k].classList.add(o2 === o ? "hit" : "answer"); });
        if (!o.right) btn.classList.add("miss");
        reviewState.checked++;
        if (o.right) reviewState.right++;
        const fb = h("div", "rv-feedback " + (o.right ? "ok" : "no"));
        fb.appendChild(h("b", null, o.right ? "Right. " : "Not this time. "));
        if (c.type === "model") fb.appendChild(document.createTextNode(`${model ? model.name + ": " + model.one_liner : ""} ${L.problem.model.application}`));
        else fb.appendChild(document.createTextNode("This failure attacks " + L.defends.map(d => "Rule " + ruleN[d]).join(" and ") + "."));
        feedback.append(fb, nextBtn());
      };
      list.appendChild(btn);
    });
    card.append(list, feedback);
  } else {
    let question, answer;
    if (c.type === "fix") { card.appendChild(h("p", "rv-prompt", problem)); question = L.gate.question; answer = L.solution; }
    else if (c.type === "cost") { card.appendChild(h("p", "rv-prompt", L.solution)); question = "What did this fix cost, and who pays for it?"; answer = L.tradeoff; }
    else { card.appendChild(h("p", "rv-prompt", `${L.name}. ${L.tech_lens.mechanism}`)); question = c.probe; answer = L.tech_lens.principle; }
    card.appendChild(h("p", "rv-q", question));
    const ta = h("textarea", "move-sketch");
    ta.placeholder = "Answer from memory first. A few words is enough.";
    ta.setAttribute("aria-label", "Your answer");
    card.appendChild(ta);
    const reveal = ctaButton("Show the answer");
    const after = h("div");
    reveal.onclick = () => {
      reveal.remove();
      ta.readOnly = true;
      const box = h("div", "solution-card");
      box.appendChild(h("div", "sc-label", c.type === "fix" ? "What was actually built" : c.type === "cost" ? "The tradeoff" : "The principle to check against"));
      box.appendChild(h("p", null, answer));
      after.append(box, nextBtn());
    };
    card.append(reveal, after);
  }
  const open = h("button", "gbtn ghost rv-open", "Open this layer");
  open.onclick = () => openReader(rec.id, L.index);
  card.appendChild(open);
  root.appendChild(card);
}

function practiceDone(root, st) {
  root.appendChild(h("p", "subtitle", st.checked
    ? `That's the round. ${st.right} of ${st.checked} checked questions right.`
    : "That's the round."));
  const row = h("div", "rv-actions");
  const again = ctaButton("Another round");
  again.onclick = () => renderDrill({ systems: st.systems, label: st.label });
  const home = h("button", "gbtn", "Back home");
  home.onclick = async () => { await renderLibrary(); show("library"); };
  row.append(again, home);
  root.appendChild(row);
}

function renderSettings(banner) {
  const root = $("screen-settings").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "Settings"));
  root.appendChild(h("h1", "title", "How you learn"));
  if (banner) root.appendChild(h("div", "narrowing-note", banner));

  /* About / how it works → landing + tutorial */
  const ab = h("div", "set-block");
  ab.appendChild(h("h3", null, "About & field guide"));
  ab.appendChild(h("p", "note", "What Vitruvian is and how to read a Deconstruct: the cards, the diagram, the developer lens."));
  const abRow = h("div", "set-row");
  const abBtn = h("button", "gbtn primary", "Open the intro →");
  abBtn.onclick = () => { renderLanding(); show("landing"); };
  const tutBtn = h("button", "gbtn", "Field guide →");
  tutBtn.onclick = () => { renderTutorial("settings"); show("tutorial"); };
  const tipsBtn = h("button", "gbtn", "Show the first-run tips again");
  tipsBtn.onclick = async () => { meta.tipsSeen = false; await Store.saveMeta({ tipsSeen: false }); toast("Tips will show next time you open a Deconstruct"); };
  abRow.append(abBtn, tutBtn, tipsBtn);
  ab.appendChild(abRow);

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

  /* model */
  const mb = h("div", "set-block");
  mb.appendChild(h("h3", null, "Model"));
  mb.appendChild(h("p", "note", "Any Anthropic model id; new models need no app update."));
  mb.appendChild(h("p", "note", COPY.modelCostNote));
  const mi = h("input");
  mi.type = "text";
  mi.value = meta.modelId || CONFIG.defaultModel;
  const mrow = h("div", "set-row");
  ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"].forEach(preset => {
    const b = h("button", "gbtn", preset.replace("claude-", ""));
    b.onclick = () => { mi.value = preset; msave.click(); };
    mrow.appendChild(b);
  });
  const msave = h("button", "gbtn primary", "Save");
  msave.onclick = async () => {
    meta.modelId = mi.value.trim() || CONFIG.defaultModel;
    await Store.saveMeta({ modelId: meta.modelId });
    toast("Model: " + meta.modelId);
  };
  mrow.appendChild(msave);
  mb.append(mi, mrow);

  /* how you learn: everything that changes what reading feels like */
  const toggle = (on, label, flip) => {
    const t = h("div", "toggle" + (on ? " on" : ""));
    t.append(h("span", "tg-track"), h("span", "tg-label", label));
    t.onclick = async () => { await flip(); renderSettings(); };
    return t;
  };
  const db = h("div", "set-block");
  db.appendChild(h("h3", null, "Reading level"));
  db.appendChild(h("p", "note", "How much each layer explains. You can switch it any time from the reader too."));
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
  const lb = h("div", "set-block set-toggles");
  lb.appendChild(h("h3", null, "While you read"));
  lb.append(
    toggle(meta.challengeModeDefault === true, "Strict mode: write your own fix before you can see the real one",
      () => { meta.challengeModeDefault = !(meta.challengeModeDefault === true); return Store.saveMeta({ challengeModeDefault: meta.challengeModeDefault }); }),
    toggle(meta.autoReplay !== false, "Replay each failure on the diagram when you reach it",
      () => { meta.autoReplay = meta.autoReplay === false; return Store.saveMeta({ autoReplay: meta.autoReplay }); }),
    toggle(meta.onePage === true, "Read each layer as one page instead of four steps",
      () => { meta.onePage = !(meta.onePage === true); return Store.saveMeta({ onePage: meta.onePage }); }));

  /* generation speed */
  const gs = h("div", "set-block");
  gs.appendChild(h("h3", null, "Generation"));
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
  // the voice pass: generated text gets the same editing the app's own copy got
  const vtog = toggle(meta.voicePass !== false, "Edit generated text for voice: when the checker flags stock phrasing, one short extra call rewrites just those passages",
    () => { meta.voicePass = meta.voicePass === false; return Store.saveMeta({ voicePass: meta.voicePass }); });
  vtog.style.marginTop = "14px";
  gs.appendChild(vtog);

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

  const group = (title, note, ...blocks) => {
    const g = h("section", "set-group");
    if (title) g.appendChild(h("h2", "set-group-title", title));
    if (note) g.appendChild(h("p", "set-group-note", note));
    blocks.forEach(b => g.appendChild(b));
    root.appendChild(g);
  };
  group(null, null, db, lb);
  group("Deconstructing your own systems", "Generating a Deconstruct calls Anthropic with your key. Everything else works offline.", kb, mb, gs);
  group("Your data", null, bb);
  group("About", null, ab);

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
