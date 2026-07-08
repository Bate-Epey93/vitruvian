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

let meta = {};                    // cached meta map
let currentView = null;           // DocView instance when reading
let currentRec = null;            // open breakdown record
let pendingSaveRec = null;        // for pagehide flush

async function flushSaves() {     // pwa.js calls this before update reload
  if (pendingSaveRec) { await Store.saveBreakdownLight(pendingSaveRec); pendingSaveRec = null; }
}
window.addEventListener("pagehide", () => { flushSaves(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSaves(); });

/* ═══ Screen switching ═══ */
const SCREENS = ["library", "reader", "generate", "models", "settings"];
function show(screen) {
  SCREENS.forEach(s => { $("screen-" + s).hidden = s !== screen; });
  $("audSwitch").hidden = screen !== "reader";
  $("readerMenuBtn").hidden = screen !== "reader";
  $("backBtn").hidden = screen === "library";
  $("menuPop").hidden = true;
  if (screen !== "reader") { currentView = null; currentRec = null; }
}

/* ═══ Boot ═══ */
async function boot() {
  meta = await Store.init();
  await seedFlagships();
  wireTopbar();
  renderAudSwitch();
  await renderLibrary();
  show("library");
  window.dispatchEvent(new Event("sdc:ready"));
}

async function seedFlagships() {
  if (meta.flagshipsSeeded) return;
  const names = ["railway", "whatsapp", "youtube"];
  for (const n of names) {
    try {
      const res = await fetch("flagships/" + n + ".json");
      if (!res.ok) continue;
      const doc = await res.json();
      if (!Schema.validate(doc).ok) continue;
      await Store.saveBreakdown({
        id: "flagship-" + n, system: doc.meta.system, created: Date.now(),
        source: "flagship", schemaVersion: 1, doc,
        attempts: {}, progress: { layersRead: 0, gatesAnswered: 0, position: 0 }
      });
    } catch (e) { /* offline first-open of a partial cache: retry next boot */ }
  }
  const have = await Store.getBreakdowns();
  if (have.some(b => b.source === "flagship")) {
    meta.flagshipsSeeded = true;
    await Store.saveMeta({ flagshipsSeeded: true });
  }
}

/* ═══ Topbar ═══ */
function wireTopbar() {
  $("brand").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("backBtn").onclick = async () => { await flushSaves(); await renderLibrary(); show("library"); };
  $("modelsBtn").onclick = () => { renderModels(); show("models"); };
  $("settingsBtn").onclick = () => { renderSettings(); show("settings"); };
  $("readerMenuBtn").onclick = e => { e.stopPropagation(); $("menuPop").hidden = !$("menuPop").hidden; };
  document.addEventListener("click", () => { $("menuPop").hidden = true; });
}

function renderAudSwitch() {
  const box = $("audSwitch");
  box.textContent = "";
  COPY.audienceModes.forEach(m => {
    const b = h("button", meta.audienceMode === m.id ? "on" : "", m.label);
    b.onclick = async () => {
      meta.audienceMode = m.id;
      await Store.saveMeta({ audienceMode: m.id });
      renderAudSwitch();
      if (currentView) currentView.setAudience(m.id);
    };
    box.appendChild(b);
  });
}

/* ═══ Library ═══ */
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
      renderSettings("Add your Anthropic API key to generate breakdowns.");
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

  const all = (await Store.getBreakdowns()).sort((a, b) => (b.lastOpen || b.created) - (a.lastOpen || a.created));
  const flagOnly = all.every(b => b.source === "flagship");
  if (flagOnly) root.appendChild(h("p", "lib-note", COPY.libraryFlagshipNote));

  const grid = h("div", "card-grid");
  all.forEach(rec => {
    const card = h("button", "bd-card");
    card.appendChild(h("div", "bd-name", rec.system));
    const metaRow = h("div", "bd-meta");
    metaRow.appendChild(h("span", "chip" + (rec.source === "flagship" ? " flagship" : ""), rec.source));
    metaRow.appendChild(h("span", "chip", rec.doc.layers.length + " layers"));
    card.appendChild(metaRow);
    const foot = h("div", "bd-foot");
    const n = rec.doc.layers.length;
    const done = rec.doc.layers.filter(L => rec.attempts[L.index] && rec.attempts[L.index].revealed).length;
    const pct = Math.round(100 * done / n);
    const ring = h("div", "ring");
    ring.style.background = `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--line-soft) 0deg)`;
    ring.appendChild(h("span", null, pct + ""));
    foot.appendChild(h("span", "bd-last", rec.lastOpen ? "opened " + timeAgo(rec.lastOpen) : "new"));
    foot.appendChild(ring);
    card.appendChild(foot);
    card.onclick = () => openReader(rec.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);

  // quiet foundation of future sharing: single-breakdown import
  const importRow = h("div", "gate-actions");
  importRow.style.marginTop = "26px";
  const imp = h("button", "gbtn", "Import a breakdown (.json)");
  imp.onclick = () => pickFile(async file => {
    try {
      const doc = JSON.parse(await file.text());
      const res = Schema.validate(doc);
      if (!res.ok) { alert("Not a valid breakdown:\n" + res.errors.slice(0, 6).join("\n")); return; }
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
  dcap.append(capState, capToggle);
  dpane.append(dscroll, dcap);
  const docPane = h("div", "doc-pane");
  wrap.append(dpane, docPane);
  pane.appendChild(wrap);

  const diagram = Diagram.mount(dscroll, rec.doc);
  const challengeOn = rec.challengeMode != null ? rec.challengeMode : meta.challengeModeDefault !== false;

  currentView = DocView.mount({
    docPane, diagram, rec,
    audience: meta.audienceMode || "enthusiast",
    challenge: challengeOn,
    onSave(r) { pendingSaveRec = null; Store.saveBreakdownLight(r); },
    canCompare() {
      if (!navigator.onLine) return { ok: false, reason: "You're offline. " + COPY.gateCompareOffline };
      if (!meta.apiKey) return { ok: false, reason: "No API key set. " + COPY.gateCompareOffline };
      return { ok: true };
    },
    onCompare(layer, attempt) {
      return Generator.compare({ apiKey: meta.apiKey, modelId: meta.modelId, layer, attempt });
    }
  });

  buildReaderMenu(rec, challengeOn);
  show("reader");
  if (layerIndex != null) currentView.goToLayer(layerIndex);
}

function buildReaderMenu(rec, challengeOn) {
  const pop = $("menuPop");
  pop.textContent = "";
  const add = (label, fn, cls) => {
    const b = h("button", cls || "", label);
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    pop.appendChild(b);
  };
  add((challengeOn ? "✓ " : "") + "Challenge mode (gates)", async () => {
    rec.challengeMode = !challengeOn;
    await Store.saveBreakdownLight(rec);
    openReader(rec.id);
  });
  pop.appendChild(h("div", "menu-sep"));
  add("Export breakdown .json", () => {
    download(rec.system.replace(/\W+/g, "-").toLowerCase() + ".json", JSON.stringify(rec.doc, null, 2));
  });
  add("Use as reference in UX-First Studio", async () => {
    try {
      await navigator.clipboard.writeText(bridgeNotes(rec.doc));
      toast(COPY.bridgeToast);
    } catch (e) { alert("Clipboard unavailable — export the .json instead."); }
  });
  pop.appendChild(h("div", "menu-sep"));
  add("Delete this breakdown", async () => {
    if (!confirm(`Delete "${rec.system}" and its attempts? This cannot be undone.`)) return;
    await Store.deleteBreakdown(rec.id);
    await renderLibrary();
    show("library");
  }, "danger");
}

/* ── the Studio bridge: clipboard reference notes (§11.5) ── */
function bridgeNotes(doc) {
  const lines = [];
  lines.push(`REFERENCE SYSTEM: ${doc.meta.system}`);
  lines.push(`(from System Deconstructor — paste into UX-First Studio › Structure It)`);
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
function renderGenerate(systemName) {
  const root = $("screen-generate").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "New breakdown"));
  root.appendChild(h("h1", "title", systemName));

  const focusRow = h("div", "focus-row");
  const focus = h("input");
  focus.placeholder = "Optional focus note — e.g. \"emphasize the payments part\"";
  focus.maxLength = 200;
  focusRow.appendChild(focus);
  root.appendChild(focusRow);
  root.appendChild(h("p", "lib-note", `Model: ${meta.modelId} · ${COPY.costNote}`));

  const startBtn = h("button", "big-btn", "Generate (1–3 minutes)");
  root.appendChild(startBtn);
  const prog = h("div", "gen-progress");
  root.appendChild(prog);

  startBtn.onclick = async () => {
    startBtn.disabled = true;
    focus.disabled = true;
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
        system: systemName, focus: focus.value.trim(),
        onProgress(p) {
          if (p.phase) {
            phaseEl.textContent = p.phase === "repair" ? "One repair pass — fixing validation errors…" : (COPY.genPhases[p.phase] || phaseEl.textContent);
            fill.style.width = (PHASE_PCT[p.phase] || 0) + "%";
          }
          if (p.tokens) tok.textContent = "~" + p.tokens.toLocaleString() + " tokens";
        }
      });
      fill.style.width = "100%";
      const rec = {
        id: "gen_" + Date.now(), system: doc.meta.system, created: Date.now(),
        source: "generated", schemaVersion: 1, doc,
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
        http: "API error"
      };
      box.appendChild(h("h3", null, titles[e.kind] || "Generation failed"));
      box.appendChild(h("p", null, e.message));
      const row = h("div", "gate-actions");
      if (e.kind === "key") {
        const b = h("button", "gbtn", "Open Settings");
        b.onclick = () => { renderSettings(); show("settings"); };
        row.appendChild(b);
      }
      if (e.kind === "overloaded" || e.kind === "rate" || e.kind === "offline" || e.kind === "http") {
        const b = h("button", "gbtn primary", "Retry");
        b.onclick = () => { startBtn.disabled = false; focus.disabled = false; prog.textContent = ""; startBtn.click(); };
        row.appendChild(b);
      }
      if (e.raw) {
        const b = h("button", "gbtn", "Download raw output");
        b.onclick = () => download("raw-breakdown.txt", e.raw);
        row.appendChild(b);
      }
      box.appendChild(row);
      prog.appendChild(box);
      startBtn.disabled = false;
      focus.disabled = false;
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

/* ═══ Settings (§11.5) ═══ */
function renderSettings(banner) {
  const root = $("screen-settings").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "Settings"));
  root.appendChild(h("h1", "title", "Keys, defaults, backups"));
  if (banner) root.appendChild(h("div", "narrowing-note", banner));

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
  mb.appendChild(h("p", "note", "Any Anthropic model id — new models need no app update."));
  const mi = h("input");
  mi.type = "text";
  mi.value = meta.modelId || "claude-sonnet-5";
  const mrow = h("div", "set-row");
  ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"].forEach(preset => {
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
  const tog = h("div", "toggle" + (meta.challengeModeDefault !== false ? " on" : ""));
  tog.style.marginTop = "12px";
  tog.append(h("span", "tg-track"), h("span", "tg-label", "Challenge mode by default (design before the reveal)"));
  tog.onclick = async () => {
    meta.challengeModeDefault = !(meta.challengeModeDefault !== false);
    await Store.saveMeta({ challengeModeDefault: meta.challengeModeDefault });
    renderSettings();
  };
  db.appendChild(tog);
  root.appendChild(db);

  /* backup / restore */
  const bb = h("div", "set-block");
  bb.appendChild(h("h3", null, "Backup & restore"));
  bb.appendChild(h("p", "note", "The backup contains your whole library and attempts — never your API key."));
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
      renderAudSwitch();
      toast(`Restored ${results.length - bad.length}/${results.length} breakdowns`);
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
