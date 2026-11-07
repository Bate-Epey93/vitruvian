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
  stop: ["M6.2 6.2h7.6v7.6H6.2z"],
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
  /* Diagram tools wore a flask, which read as the field studies under lab/
     on every screen narrow enough to hide the label. A wrench says tools. */
  tools: ["M12.25 5.25a.83.83 0 0 0 0 1.17l1.33 1.33a.83.83 0 0 0 1.17 0l3.14-3.14a5 5 0 0 1-6.62 6.62l-5.76 5.76a1.77 1.77 0 0 1-2.5-2.5l5.76-5.76a5 5 0 0 1 6.62-6.62l-3.13 3.13z"],
  // the same two lifelines the topbar's Sequence button drew
  sequence: ["M5 3v14M15 3v14", "M5 7.5h9M12 5.8l2 1.7-2 1.7", "M15 12.5H6M8 10.8l-2 1.7 2 1.7"]
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
let currentDiagram = null;        // the reader's Diagram, retired on leaving (retireDiagram)
let suppressRoute = false;        // prevents hash sync feedback loops during popstate
let activeModelId = null;         // current model detail id on #/models/<id>
let activeVocabId = null;         // current vocab focus id on #/vocab/<id>
let activeGen = null;             // background generation state { controller, systemName, phaseText, readyRec, error }
let genFormOwner = null;          // controller of the run the generate form on screen started; null for a fresh form
let genRunView = null;            // { controller, nodes }: a running form set aside when another form replaced it
let originEscHandler = null;      // the one live origin-card Escape listener (openReader)

function bytesToBase64Url(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlToBytes(b64u) {
  const b64 = String(b64u).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* A shared link is attacker-controlled input. Real ones run 20 to 100 KB of
   token and a few hundred KB inflated; deflate can expand roughly a
   thousand-fold, so an uncapped decode of a 1 MB token inflates about a
   gigabyte and kills the tab. Both ends are capped. */
const SHARE_MAX_TOKEN = 512 * 1024;      // characters of token
const SHARE_MAX_RAW = 2 * 1024 * 1024;   // bytes once inflated, ~8x the largest real doc
async function streamBytes(stream, maxBytes = Infinity) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error("This shared link is too large to import.");
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}
async function encodeSharePayload(doc) {
  const raw = new TextEncoder().encode(JSON.stringify(doc));
  if (typeof CompressionStream === "function") {
    try {
      const cs = new CompressionStream("deflate-raw");
      const w = cs.writable.getWriter();
      w.write(raw);
      w.close();
      const compressed = await streamBytes(cs.readable);
      return "z." + bytesToBase64Url(compressed);
    } catch (e) {}
  }
  return "u." + bytesToBase64Url(raw);
}
async function decodeSharePayload(token) {
  const str = String(token || "").trim();
  if (str.length > SHARE_MAX_TOKEN) throw new Error("This shared link is too large to import.");
  const isDeflated = str.startsWith("z.");
  const payload = (str.startsWith("z.") || str.startsWith("u.")) ? str.slice(2) : str;
  const bytes = base64UrlToBytes(payload);
  let rawBytes = bytes;
  if (isDeflated) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress portable links.");
    const ds = new DecompressionStream("deflate-raw");
    const w = ds.writable.getWriter();
    w.write(bytes).catch(() => {});
    w.close().catch(() => {});
    rawBytes = await streamBytes(ds.readable, SHARE_MAX_RAW);
  } else if (rawBytes.byteLength > SHARE_MAX_RAW) {
    throw new Error("This shared link is too large to import.");
  }
  return JSON.parse(new TextDecoder().decode(rawBytes));
}
/* Text from an imported file or a shared link is someone else's, shown
   under this app's name. Anything of theirs that reaches a native dialog
   (whose title bar is the trusted origin) is flattened to one short line, so
   a field cannot be used to stage a fake security notice. */
function safeLine(v, n = 60) {
  const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
async function saveOrReuseImportedDoc(doc, source = "generated") {
  const res = Schema.validate(doc);
  if (!res.ok) {
    const err = new Error("Not a valid Deconstruct:\n" + res.errors.slice(0, 6).join("\n"));
    err.validationErrors = res.errors;
    throw err;
  }
  const all = await Store.getBreakdowns();
  const sysWant = (doc.meta && doc.meta.system || "").trim().toLowerCase();
  const essWant = (doc.essence && doc.essence.text || "").trim();
  const existing = all.find(b =>
    (b.system || "").trim().toLowerCase() === sysWant &&
    b.doc && b.doc.essence && b.doc.essence.text === essWant
  );
  if (existing) return { rec: existing, existed: true };
  const rec = {
    id: "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    system: doc.meta.system, created: Date.now(),
    source, schemaVersion: 1, doc,
    attempts: {}, progress: { layersRead: 0, gatesAnswered: 0, position: 0 }
  };
  await Store.saveBreakdown(rec);
  return { rec, existed: false };
}
async function importBreakdownJsonText(rawText) {
  const parsed = JSON.parse(rawText);
  if (parsed && Array.isArray(parsed.breakdowns) && (parsed.app === "vitruvian" || parsed.tool === "vitruvian" || parsed.tool === "system-deconstructor")) {
    /* A backup is a full restore, not an import: it replaces the library,
       every attempt and every synced setting. Dropping one on Home used to do
       that silently. It now asks exactly as Settings does, and says how much
       is about to go. */
    const mine = (await Store.getBreakdowns()).filter(b => b.source !== "flagship").length;
    if (!confirm(COPY.restoreAsk(parsed.breakdowns.length, mine))) return null;
    const results = await Store.importAll(parsed);
    const okCount = results.filter(r => r.ok).length;
    meta = await Store.getMeta();
    applyTheme(meta.theme || document.documentElement.dataset.theme);
    renderAudSwitch();
    await renderLibrary();
    toast(COPY.restoreDone(okCount, results.length));
    return null;
  }
  const doc = (parsed && parsed.doc && parsed.doc.meta) ? parsed.doc : parsed;
  const { rec, existed } = await saveOrReuseImportedDoc(doc);
  await renderLibrary();
  toast(existed ? COPY.importAgain(rec.system) : `Imported: ${rec.system}`);
  return rec;
}

/* A generation lives only in this page. Leaving the document mid-run aborts
   the stream after its tokens are billed, and nothing is saved. pwa.js reads
   genInFlight() before reloading, and waits for "sdc:gensettled". */
function genInFlight() { return !!(activeGen && !activeGen.readyRec && !activeGen.error); }
function guardUnload(e) { if (genInFlight()) { e.preventDefault(); e.returnValue = ""; } }
/* A field study is its own page, so following one unloads the app and the
   run with it. While one runs, the study opens in a new tab instead. Decided
   at click time, so a card drawn before the run started is covered too. */
function guardLabLink(a) {
  a.addEventListener("click", () => {
    if (genInFlight()) { a.target = "_blank"; a.rel = "noopener"; }
    else a.removeAttribute("target");
  });
  return a;
}
/* The pill's View: puts back the form a newer one set aside, so its progress,
   or its error and raw-output download, is what the reader lands on. A
   failure is seen once it is shown. */
function viewGenRun() {
  const root = $("screen-generate").firstElementChild;
  if (activeGen && genRunView && genRunView.controller === activeGen.controller) {
    root.textContent = "";
    root.append(...genRunView.nodes);
    genFormOwner = genRunView.controller;
    genRunView = null;
  }
  if (activeGen && activeGen.error) activeGen = null;
  show("generate");
}

function syncGenBgPill() {
  let pill = $("genBgPill");
  const screen = document.body.dataset.screen || "library";
  // on the generate screen the run's own form already shows it; any other form does not
  const onOwnForm = screen === "generate" && !!activeGen && genFormOwner === activeGen.controller;
  const shouldShow = !!activeGen && (!onOwnForm || !!activeGen.readyRec);
  if (!shouldShow) {
    if (pill) pill.hidden = true;
    return;
  }
  if (!pill) {
    pill = h("div", "gen-bg-pill");
    pill.id = "genBgPill";
    pill.setAttribute("role", "status");
    pill.setAttribute("aria-live", "polite");
    document.body.appendChild(pill);
  }
  pill.hidden = false;
  pill.textContent = "";
  pill.classList.toggle("failed", !activeGen.readyRec && !!activeGen.error);
  if (activeGen.readyRec) {
    const rec = activeGen.readyRec;
    pill.classList.add("ready");
    const dot = h("span", "gbp-dot ready");
    const txt = h("span", "gbp-text", `"${rec.system}" is ready`);
    const openBtn = h("button", "gbtn primary gbp-btn", "Open →");
    openBtn.onclick = () => {
      activeGen = null;
      syncGenBgPill();
      openReader(rec.id);
    };
    const closeBtn = h("button", "gbp-close", "×");
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.onclick = () => {
      activeGen = null;
      syncGenBgPill();
    };
    pill.append(dot, txt, openBtn, closeBtn);
  } else if (activeGen.error) {
    pill.classList.remove("ready");
    const dot = h("span", "gbp-dot failed");
    const txt = h("span", "gbp-text", `"${activeGen.systemName}" failed · ${activeGen.error}`);
    const viewBtn = h("button", "gbtn gbp-btn", "View");
    viewBtn.onclick = viewGenRun;
    const closeBtn = h("button", "gbp-close", "×");
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.onclick = () => {
      activeGen = null;
      syncGenBgPill();
    };
    pill.append(dot, txt, viewBtn, closeBtn);
  } else {
    pill.classList.remove("ready");
    const dot = h("span", "gbp-dot");
    const txt = h("span", "gbp-text", `Deconstructing "${activeGen.systemName}" · ${activeGen.phaseText || "Working…"}`);
    const viewBtn = h("button", "gbtn gbp-btn", "View");
    viewBtn.onclick = viewGenRun;
    const cancelBtn = h("button", "gbp-close", "×");
    cancelBtn.title = "Cancel generation";
    cancelBtn.setAttribute("aria-label", "Cancel generation");
    cancelBtn.onclick = () => {
      if (activeGen && activeGen.controller) activeGen.controller.abort();
    };
    pill.append(dot, txt, viewBtn, cancelBtn);
  }
}

function studySlug(rec) {
  if (!rec) return "";
  return rec.source === "flagship" ? rec.id.replace(/^flagship-/, "") : rec.id;
}
function buildRouteHash(screen) {
  if (screen === "reader" && currentRec) {
    const slug = studySlug(currentRec);
    const p = currentView ? currentView.position : (currentRec.progress && currentRec.progress.position) || 0;
    const s = currentView ? currentView.step : (currentRec.progress && currentRec.progress.step) || 1;
    const tail = (p > 0 || s > 1) ? `/${p}.${s}` : "";
    return `#/study/${encodeURIComponent(slug)}${tail}`;
  }
  if (screen === "models") return activeModelId ? `#/models/${encodeURIComponent(activeModelId)}` : "#/models";
  if (screen === "vocab") return activeVocabId ? `#/vocab/${encodeURIComponent(activeVocabId)}` : "#/vocab";
  if (screen === "drill") return "#/practice";
  if (screen === "settings") return "#/settings";
  if (screen === "tutorial") return "#/guide";
  if (screen === "landing") return "#/intro";
  if (screen === "whatif" && currentRec) return `#/graft/${encodeURIComponent(studySlug(currentRec))}`;
  return "#/";
}
function syncRoute(mode = "push") {
  if (suppressRoute || typeof history === "undefined") return;
  const screen = document.body.dataset.screen || "library";
  if (screen === "generate") return;
  const hash = buildRouteHash(screen);
  const state = {
    screen,
    drillStack: drillStack.map(x => ({ id: x.id, system: x.system }))
  };
  if (location.hash === hash && mode === "push") {
    try { history.replaceState(state, "", hash); } catch (e) {}
    return;
  }
  try {
    if (mode === "replace") history.replaceState(state, "", hash);
    else history.pushState(state, "", hash);
  } catch (e) {}
}
/* A chat app can mangle a link into a broken %-escape, and decodeURIComponent
   throws on one. The raw text simply matches nothing, which the routes
   already handle. */
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}
async function resolveStudySlug(slugOrId) {
  if (!slugOrId) return null;
  const decoded = safeDecode(slugOrId);
  const direct = await Store.getBreakdown(decoded).catch(() => null);
  if (direct) return direct;
  const flag = await Store.getBreakdown("flagship-" + decoded).catch(() => null);
  if (flag) return flag;
  const want = decoded.trim().toLowerCase();
  const all = await Store.getBreakdowns();
  return all.find(b => (b.system || "").trim().toLowerCase() === want) || null;
}
async function linkMissed(msg) {
  await renderLibrary();
  show("library", { noRoute: true });
  toast(msg);
  try { history.replaceState({ screen: "library", drillStack: [] }, "", "#/"); } catch (_) {}
  return true;
}
async function applyUrlRoute(hashStr, histState) {
  const hStr = (hashStr || location.hash || "#/").replace(/^#/, "");
  suppressRoute = true;
  try {
    const studyMatch = hStr.match(/^\/study\/([^/]+)(?:\/(\d+)(?:\.(\d+))?)?/);
    if (studyMatch) {
      const rec = await resolveStudySlug(studyMatch[1]);
      if (rec) {
        if (histState && Array.isArray(histState.drillStack) && histState.drillStack.length) {
          drillStack = histState.drillStack;
        }
        const pos = studyMatch[2] != null ? parseInt(studyMatch[2], 10) : null;
        const stp = studyMatch[3] != null ? parseInt(studyMatch[3], 10) : 1;
        if (currentRec && currentRec.id === rec.id && currentView && document.body.dataset.screen === "reader") {
          if (pos != null) currentView.goToPosStep(pos, stp);
        } else {
          await openReader(rec.id, null, {
            keepStack: !!(histState && Array.isArray(histState.drillStack) && histState.drillStack.length),
            posStep: pos != null ? [pos, stp] : null,
            noRoute: true
          });
        }
        return true;
      }
      /* A study link that resolves to nothing — deleted, never imported here,
         or a mangled escape — used to return false, which the back button
         ignores: the old screen stayed up under a URL that no longer matched
         it. Land on the library and say so, as the catch below does. */
      return await linkMissed(COPY.linkMissing);
    }
    const modelsMatch = hStr.match(/^\/models(?:\/([^/]+))?/);
    if (modelsMatch) {
      await renderModels(modelsMatch[1] ? safeDecode(modelsMatch[1]) : undefined);
      show("models", { noRoute: true });
      return true;
    }
    const vocabMatch = hStr.match(/^\/vocab(?:\/([^/]+))?/);
    if (vocabMatch) {
      await renderVocab(vocabMatch[1] ? safeDecode(vocabMatch[1]) : undefined);
      show("vocab", { noRoute: true });
      // only now: the screen was display:none while it rendered, and a hidden one cannot scroll
      const focused = $("screen-vocab").querySelector(".vocab-card.focused");
      if (focused) requestAnimationFrame(() => focused.scrollIntoView({ block: "center", behavior: RM_PREF() ? "auto" : "smooth" }));
      return true;
    }
    if (hStr === "/practice" || hStr === "/drill") {
      await renderDrill();
      show("drill", { noRoute: true });
      return true;
    }
    if (hStr === "/settings") {
      renderSettings();
      show("settings", { noRoute: true });
      return true;
    }
    if (hStr === "/guide" || hStr === "/tutorial") {
      renderTutorial("library");
      show("tutorial", { noRoute: true });
      return true;
    }
    if (hStr === "/intro" || hStr === "/landing") {
      renderLanding();
      show("landing", { noRoute: true });
      return true;
    }
    const importMatch = hStr.match(/^\/import\/(.+)$/);
    if (importMatch) {
      try {
        const doc = await decodeSharePayload(importMatch[1]);
        const { rec, existed } = await saveOrReuseImportedDoc(doc, "shared");
        await renderLibrary();
        toast(existed ? `Opened "${rec.system}"` : `Imported shared Deconstruct: ${rec.system}`);
        await openReader(rec.id, null, { noRoute: true });
        try { history.replaceState({ screen: "reader", drillStack: [{ id: rec.id, system: rec.system }] }, "", `#/study/${encodeURIComponent(studySlug(rec))}`); } catch (e) {}
        return true;
      } catch (e) {
        /* in-app, one line, never a native dialog: the message can carry the
           link author's own text, echoed back by the validator */
        toast("Could not import that shared link · " + safeLine(e.message.split("\n").slice(-1)[0], 80));
        await renderLibrary();
        show("library", { noRoute: true });
        return true;
      }
    }
    const graftMatch = hStr.match(/^\/graft\/([^/]+)/);
    if (graftMatch) {
      const rec = await resolveStudySlug(graftMatch[1]);
      if (rec) {
        currentRec = rec;
        renderWhatif(rec);
        show("whatif", { noRoute: true, keepRec: true });
        return true;
      }
      return await linkMissed(COPY.linkMissing);
    }
    if (hStr === "/" || hStr === "") {
      await renderLibrary();
      show("library", { noRoute: true });
      return true;
    }
    return false;
  } catch (e) {
    /* Whatever a link carries, it must not leave the app blank: the screen it
       asked for may be half-built, so land on the library and clear the hash
       so a reload recovers. replaceState, never push: popstate runs this too. */
    console.error(e);
    await renderLibrary();
    show("library", { noRoute: true });
    toast("That link could not be opened");
    try { history.replaceState({ screen: "library", drillStack: [] }, "", "#/"); } catch (_) {}
    return true;
  } finally {
    suppressRoute = false;
  }
}
window.addEventListener("popstate", async ev => {
  await flushSaves();
  await applyUrlRoute(location.hash, ev.state);
});

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
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  const next = (root.dataset.theme === "dark") ? "light" : "dark";
  applyTheme(next);
  meta.theme = next;
  await Store.saveMeta({ theme: next });
  setTimeout(() => root.classList.remove("theme-transitioning"), 260);
}

/* ═══ Screen switching ═══ */
const SCREENS = ["landing", "library", "reader", "generate", "models", "vocab", "drill", "tutorial", "whatif", "settings"];
/* A reader left behind kept its Pulse running into a detached SVG, on every
   screen after, one more for each study opened. Stop it on the way out.
   destroy() is the renderer's teardown for the rest (its fit and resize
   loops); it is called only where the renderer provides it. */
function retireDiagram() {
  if (!currentDiagram) return;
  currentDiagram.sim.stop();
  if (typeof currentDiagram.destroy === "function") currentDiagram.destroy();
  currentDiagram = null;
}
function show(screen, opts = {}) {
  SCREENS.forEach(s => { $("screen-" + s).hidden = s !== screen; });
  document.body.classList.toggle("reading", screen === "reader");   // frees topbar room for the audience switch
  $("audSwitch").hidden = screen !== "reader";
  $("readerMenuBtn").hidden = screen !== "reader";
  // reading-only context tools live in the topbar's right zone; hidden elsewhere
  // so global chrome never shows dead buttons (see placement note in commit)
  ["ctxDiv", "sheetBtn", "graftBtn"].forEach(id => { $(id).hidden = screen !== "reader"; });
  $("backBtn").hidden = screen === "library" || screen === "landing";
  $("menuPop").hidden = true;
  const navScreen = screen === "vocab" ? "models" : screen;   // vocabulary is a tab of Models
  document.querySelectorAll("[data-screen]").forEach(b => {
    const on = b.dataset.screen === navScreen;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  document.body.dataset.screen = screen;
  syncGenBgPill();
  featureTips.close();
  if (screen !== "reader") setTimeout(() => { if (document.body.dataset.screen === screen) featureTips.visit(screen); }, 650);
  if (!opts.noRoute) syncRoute(opts.replace ? "replace" : "push");
  if (screen !== "reader") {
    /* destroy() cancels the reader's debounced save, so write the live record
       first, or the last keystrokes of a sketch are lost on any exit that did
       not pass through flushSaves(). IndexedDB runs transactions on one store
       in order, so this need not be awaited. */
    if (currentView && currentRec) Store.saveBreakdownLight(currentRec);
    if (currentView) currentView.destroy();   // cancel any pending debounce timer
    currentView = null;
    retireDiagram();
    if (originEscHandler) { document.removeEventListener("keydown", originEscHandler); originEscHandler = null; }
    if (!opts.keepRec) currentRec = null;
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
  /* Repair any stored record missing the fields every screen assumes. Older
     or hand-made backups could store a study with no attempts, and the
     Library then threw on every boot and every tap of Home — the app stuck at
     its top bar until someone cleared site data. Cheap, idempotent, and it
     runs before anything reads them. */
  {
    const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
    for (const r of await Store.getBreakdowns()) {
      if (isObj(r.attempts) && isObj(r.progress)) continue;
      if (!isObj(r.attempts)) r.attempts = {};
      if (!isObj(r.progress)) r.progress = { layersRead: 0, gatesAnswered: 0, position: 0 };
      await Store.saveBreakdownLight(r);
    }
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
  // deep link: #/study/<slug>[/<pos>.<step>], #/models[/<id>], #/vocab, #/practice, etc.
  const hasExplicitHash = location.hash && location.hash !== "#" && location.hash !== "#/";
  let handled = false;
  if (hasExplicitHash) {
    await renderLibrary();                // back button needs a library behind it
    // backstop: a throw here skipped show() and dismissSplash, a blank app
    try { handled = await applyUrlRoute(location.hash, history.state); } catch (e) { handled = false; }
  }
  if (!handled) {
    if (!meta.landingSeen) {
      renderLanding();
      show("landing", { replace: true });
      /* auto-shows once, however the reader leaves it: only the CTA set this,
         so tapping Home instead brought the landing back on every launch */
      meta.landingSeen = true;
      await Store.saveMeta({ landingSeen: true });
    } else {
      await renderLibrary();
      show("library", { replace: true });
    }
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
  /* Fetch them all at once. One after another, a first visit (no service
     worker yet) held the splash for a round trip per flagship. A failed one
     comes back null and is skipped, as before. */
  const docs = await Promise.all(names.map(n =>
    fetch("flagships/" + n + ".json", { cache: "no-cache" })  // revalidate: pick up content updates
      .then(res => res.ok ? res.json() : null)
      .catch(() => null)));   // offline first-open of a partial cache: retry next boot
  for (let k = 0; k < names.length; k++) {
    const n = names[k], doc = docs[k];
    if (!doc) continue;
    try {
      if (!Schema.validate(doc).ok) continue;
      const id = "flagship-" + n, was = prev[id];
      /* Spread the old record first, so anything a reader attached to a
         sample survives a content update. Saved grafts (whatifs) were being
         wiped on every flagshipVersion bump; so would any field added later. */
      await Store.saveBreakdown({
        ...(was || {}),
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
  $("sheetBtn").onclick = () => { if (currentView) currentView.openSheet(); };
  /* Graft leaves the reader, so its tip is held and comes on the way back */
  $("graftBtn").onclick = () => { if (currentRec) { featureTips.trigger("ctx"); renderWhatif(currentRec); show("whatif", { keepRec: true }); } };
  $("readerMenuBtn").onclick = e => {
    e.stopPropagation();
    const pop = $("menuPop");
    pop.hidden = !pop.hidden;
    if (!pop.hidden) featureTips.trigger("menu");
  };
  document.addEventListener("click", () => { $("menuPop").hidden = true; });
}

function renderAudSwitch() {
  const box = $("audSwitch");
  let pill = box.querySelector(".sliding-seg-pill");
  if (!pill) {
    box.textContent = "";
    pill = h("div", "sliding-seg-pill");
    box.appendChild(pill);
    COPY.audienceModes.forEach(m => {
      const b = h("button", meta.audienceMode === m.id ? "on" : "");
      b.dataset.aud = m.id;
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
    /* First measured at boot, while the switch is hidden, the pill came out
       0px wide and stayed so: every reader opened with no level marked. The
       switch resizes when it is shown and when its labels swap to letters,
       so re-measure then. The pill is absolute, so this cannot feed itself. */
    if (typeof ResizeObserver === "function") new ResizeObserver(() => renderAudSwitch()).observe(box);
  } else {
    box.querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", b.dataset.aud === meta.audienceMode);
    });
  }
  // say which level is on, not only paint it: a screen reader heard three equal buttons
  box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.aud === meta.audienceMode)));
  requestAnimationFrame(() => {
    const onBtn = box.querySelector("button.on");
    if (onBtn && pill) {
      const bRect = onBtn.getBoundingClientRect();
      const cRect = box.getBoundingClientRect();
      pill.style.width = `${bRect.width}px`;
      pill.style.transform = `translateX(${bRect.left - cRect.left}px)`;
    }
  });
}

/* ═══ Landing (first-run explainer, §value-add) ═══ */

/* Landing: an editorial split. Copy on the left; on the right, a real
   Deconstruct building itself, layer by layer, in a framed stage, because the
   product explains itself faster than any paragraph about it. */
let heroTimer = null;
function stopHero() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }

/* ═══ The headline's second line, drawn ═══
   "Put it back together, and it makes sense" is an argument with a shape:
   one thing leads to another. So it is drawn with the same grammar as the
   diagrams — an arrow from the first idea to the second, with a payload
   travelling it — rather than merely stated. The words are still words. ═══ */

/* The displacement filter, injected once. A CSS filter pointing at a missing
   id makes the element vanish in Chrome and Safari, so the defs go in before
   anything wears the class. */
function roughInkDefs() {
  if (document.getElementById("rough-ink")) return;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;pointer-events:none";
  svg.innerHTML =
    '<filter id="rough-ink" x="-6%" y="-10%" width="112%" height="120%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.019 0.034" numOctaves="3" seed="7" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>';
  document.body.appendChild(svg);
}

/* Wrap the two named fragments so the arrow has something to aim at. If the
   copy ever stops containing them, this returns the plain line and the arrow
   quietly does not draw — the headline still reads. */
function markedLine(line, L) {
  const span = h("span", "lh-soft");
  const a = line.indexOf(L.headlineFrom), b = line.indexOf(L.headlineTo);
  if (a < 0 || b < 0 || b < a) { span.textContent = line; return span; }
  const mk = (cls, text) => { const e = h("span", cls, text); return e; };
  span.appendChild(document.createTextNode(line.slice(0, a)));
  span.appendChild(mk("lh-from", L.headlineFrom));
  span.appendChild(document.createTextNode(line.slice(a + L.headlineFrom.length, b)));
  span.appendChild(mk("lh-to", L.headlineTo));
  span.appendChild(document.createTextNode(line.slice(b + L.headlineTo.length)));
  return span;
}

/* Draw the arrow between them and run a payload along it. Re-measured
   whenever the headline reflows, because where those two words sit depends
   on the window. */
function headArrow(head) {
  const from = head.querySelector(".lh-from"), to = head.querySelector(".lh-to");
  if (!from || !to) return;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "lh-arrow");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");   // the exact curve: geometry
  const inked = document.createElementNS(NS, "path");  // the roughened copy: what shows
  inked.setAttribute("class", "lh-ink");
  const headArr = document.createElementNS(NS, "path");
  headArr.setAttribute("class", "lh-ink lh-head");
  path.setAttribute("class", "lh-true");
  const tok = document.createElementNS(NS, "circle");
  tok.setAttribute("r", "4.5");
  tok.setAttribute("class", "lh-tok");
  svg.append(path, inked, headArr, tok);
  head.appendChild(svg);

  /* Roughened like every other line in the app. The exact path stays in the
     DOM but unpainted, because the token has to travel the true curve — a
     payload riding a wobble would wander off the arrow it is meant to be on. */
  const gen = (typeof rough !== "undefined" && rough.generator) ? rough.generator() : null;
  const ink = d => {
    if (!gen) return d;
    try {
      const ps = gen.toPaths(gen.path(d, { seed: 19, roughness: 0.8, bowing: 1,
                                           disableMultiStroke: true, preserveVertices: true }));
      return ps.length && ps[0].d ? ps.map(x => x.d).join(" ") : d;
    } catch (e) { return d; }
  };

  let raf = 0, timer = 0, len = 0;
  const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function measure() {
    const H = head.getBoundingClientRect();
    const A = from.getBoundingClientRect(), B = to.getBoundingClientRect();
    if (!A.width || !B.width) return false;
    let d, need;
    if (Math.abs(B.top - A.top) < A.height / 2) {
      /* one line: under both words, dipping between them */
      const x1 = A.left - H.left + A.width / 2, y1 = A.bottom - H.top + 3;
      const x2 = B.left - H.left + B.width / 2, y2 = B.bottom - H.top + 3;
      const drop = Math.max(14, Math.abs(y2 - y1) * 0.5 + 14);
      /* The dip falls below the headline's own box, so the canvas is sized to
         hold it rather than relying on overflow surviving every browser. The
         h1 carries matching bottom padding, so nothing below gets covered. */
      need = Math.ceil(Math.max(y1, y2) + drop + 8);
      d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${(y1 + drop).toFixed(1)}, ` +
          `${x2.toFixed(1)} ${(y2 + drop).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    } else {
      /* Wrapped, which at these sizes is nearly always. The lines touch at
         this leading, so a fall from under the first word cut straight
         through whatever sat beneath it, usually the second word itself.
         Bracket the two line ends on the right instead, where nothing is
         written. That needs both words to end their lines (trailing
         punctuation allowed); when either does not, there is no clear side,
         so the arrow stands down and only the colour hand-off runs. */
      const range = document.createRange();
      range.selectNodeContents(from.parentNode);
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 0);
      const rightIn = (lo, hi) => rects.reduce((m, r) => {
        const c = (r.top + r.bottom) / 2;
        return c >= lo && c <= hi ? Math.max(m, r.right) : m;
      }, -Infinity);
      const endA = rightIn(A.top, A.bottom), endB = rightIn(B.top, B.bottom);
      if (endA - A.right > A.height * 0.6 || endB - B.right > B.height * 0.6) {
        svg.style.display = "none";
        len = 0;
        return true;
      }
      const edge = rightIn(A.top, B.bottom) - H.left;   // the widest line the bracket passes
      const x1 = endA - H.left + 6, y1 = A.top - H.top + A.height * 0.55;
      const x2 = endB - H.left + 6, y2 = B.top - H.top + B.height * 0.55;
      const cx = edge + 26;
      need = Math.ceil(Math.max(y1, y2) + 8);
      d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx.toFixed(1)} ${y1.toFixed(1)}, ` +
          `${cx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    svg.style.display = "";
    svg.setAttribute("viewBox", `0 0 ${Math.round(H.width)} ${need}`);
    svg.setAttribute("width", Math.round(H.width));
    svg.setAttribute("height", need);
    path.setAttribute("d", d);
    len = path.getTotalLength();
    if (!(len > 0)) return false;
    inked.setAttribute("d", ink(d));
    /* an arrowhead on the true tangent, so it points where the curve actually
       arrives rather than where the wobble left off */
    const tip = path.getPointAtLength(len);
    const back = path.getPointAtLength(Math.max(0, len - 8));
    const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
    const wing = (off, L) => `M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} ` +
      `L ${(tip.x - Math.cos(ang + off) * L).toFixed(1)} ${(tip.y - Math.sin(ang + off) * L).toFixed(1)}`;
    headArr.setAttribute("d", ink(wing(0.45, 11) + " " + wing(-0.45, 11)));
    return true;
  }

  function place(u) {
    if (!len) return;                      // arrow stood down: nothing to travel
    const p = path.getPointAtLength(len * u);
    tok.setAttribute("cx", p.x);
    tok.setAttribute("cy", p.y);
  }

  function run() {
    if (!measure()) return;
    if (RM) { from.classList.add("lit"); to.classList.add("lit"); tok.style.opacity = "0"; return; }
    cancelAnimationFrame(raf); clearTimeout(timer);
    from.classList.add("lit"); to.classList.remove("lit");
    tok.style.opacity = "1";
    place(0);
    const DUR = 1500, HOLD = 2600;
    const t0 = performance.now();
    const step = now => {
      const u = Math.min(1, (now - t0) / DUR);
      place(u);
      /* the green travels rather than spreading: the idea arrives somewhere,
         it does not simply light everything up */
      if (u > 0.22) from.classList.remove("lit");
      if (u >= 1) {
        to.classList.add("lit");
        tok.style.opacity = "0";
        timer = setTimeout(run, HOLD);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* fonts land after first paint and move the words; re-measure then */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => run());
  requestAnimationFrame(run);
  if (typeof ResizeObserver === "function") {
    let ro = 0;
    new ResizeObserver(() => { cancelAnimationFrame(ro); ro = requestAnimationFrame(run); }).observe(head);
  }
}

function renderLanding() {
  stopHero();
  const root = $("screen-landing").firstElementChild;
  root.textContent = "";
  const L = COPY.landing;

  const hero = h("section", "hero");
  const copy = h("div", "hero-copy reveal");
  const eyebrow = h("div", "eyebrow");
  eyebrow.appendChild(h("span", "eyebrow-dot"));
  eyebrow.appendChild(document.createTextNode(L.kicker(CONFIG.flagshipNames.length)));
  copy.appendChild(eyebrow);
  const head = h("h1", "landing-head");
  const lines = L.headline.split("\n");
  lines.forEach((line, i) => {
    if (i === 0) {
      /* roughened letterforms: the filter is a displacement map, so the text
         stays real text — selectable, searchable, read aloud by a screen
         reader. It is on the display line only; at body size the same filter
         turns the edges to mush. */
      head.appendChild(h("span", "lh-rough", line));
      return;
    }
    head.appendChild(markedLine(line, L));
  });
  copy.appendChild(head);
  roughInkDefs();
  headArrow(head);
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
  /* Only Settings goes back to Settings. A guide reached by URL, reload or
     history comes from the router with no origin worth keeping, and landed
     on Settings, a screen the reader never came from. */
  back.onclick = async () => {
    if (returnId) { openReader(returnId); }
    else if (from === "landing") { renderLanding(); show("landing"); }
    else if (from === "settings") { renderSettings(); show("settings"); }
    else { await renderLibrary(); show("library"); }
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
/* ── Topological Miniature Blueprint Header (Wave F · Proposal #1) ── */
function buildCardTopo(doc, doneLayers, dom) {
  const header = h("div", "bd-topo-header");
  const totalLayers = (doc && doc.layers && doc.layers.length) || 1;
  header.appendChild(h("span", "bd-topo-badge", `${doneLayers}/${totalLayers} layers`));

  if (!doc || !doc.visual) return header;
  const lanes = doc.visual.lanes || [{ id: "l0" }];
  const laneIndex = {};
  lanes.forEach((l, idx) => { laneIndex[l.id] = idx; });
  const laneCount = Math.max(1, lanes.length);

  const allNodes = [...(doc.visual.nodes || [])];
  doc.layers.forEach(L => {
    if (L.diff && L.diff.add_nodes) allNodes.push(...L.diff.add_nodes);
  });
  let maxOrder = 1;
  allNodes.forEach(n => { if (n.order != null && n.order > maxOrder) maxOrder = n.order; });

  const W = 220, H = 76;
  const padX = 22, padY = 16;
  const colStep = (W - padX * 2) / Math.max(1, maxOrder);
  const rowStep = (H - padY * 2) / Math.max(1, laneCount - 1 || 1);

  const nodePos = {};
  allNodes.forEach(n => {
    const col = n.order != null ? n.order : 0;
    const row = laneIndex[n.lane] != null ? laneIndex[n.lane] : 0;
    nodePos[n.id] = {
      x: Math.round(padX + col * colStep),
      y: Math.round(laneCount === 1 ? H / 2 : padY + row * rowStep),
      layer: 0
    };
  });
  doc.layers.forEach((L, idx) => {
    if (L.diff && L.diff.add_nodes) {
      L.diff.add_nodes.forEach(n => {
        if (nodePos[n.id]) nodePos[n.id].layer = idx + 1;
      });
    }
  });

  const allEdges = [...(doc.visual.edges || [])];
  doc.layers.forEach((L, idx) => {
    if (L.diff && L.diff.add_edges) {
      L.diff.add_edges.forEach(e => {
        allEdges.push(Object.assign({}, e, { layer: idx + 1 }));
      });
    }
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "bd-topo-svg");

  allEdges.forEach(e => {
    const p1 = nodePos[e.from], p2 = nodePos[e.to];
    if (!p1 || !p2) return;
    const edgeLayer = e.layer || Math.max(p1.layer, p2.layer);
    const unlocked = edgeLayer <= doneLayers;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x);
    line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x);
    line.setAttribute("y2", p2.y);
    line.setAttribute("class", "topo-edge " + (unlocked ? "unlocked" : "ghost"));
    svg.appendChild(line);
  });

  allNodes.forEach(n => {
    const p = nodePos[n.id];
    if (!p) return;
    const unlocked = p.layer <= doneLayers;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", p.x - 9);
    rect.setAttribute("y", p.y - 6);
    rect.setAttribute("width", 18);
    rect.setAttribute("height", 12);
    rect.setAttribute("rx", 3.5);
    rect.setAttribute("class", "topo-node " + (unlocked ? "unlocked" : "ghost"));
    svg.appendChild(rect);
  });

  header.appendChild(svg);
  return header;
}

/* One badge per kind of Deconstruct, shared by the cards and the search
   match, so the same record is never "Sample" in one place and something
   else an inch above it. */
function sourceChipLabel(rec) {
  return COPY.sourceChip[rec.source] || COPY.sourceChip.own;
}

function cardGrid(recs) {
  const grid = h("div", "card-grid");
  recs.forEach(rec => {
    const card = h("button", "bd-card");
    const dom = (rec.doc && rec.doc.meta && rec.doc.meta.domain) || "software";
    card.dataset.domain = dom;

    const n = rec.doc.layers.length;
    const done = rec.doc.layers.filter(L => rec.attempts[L.index] && rec.attempts[L.index].revealed).length;
    const pct = Math.round(100 * done / n);

    // Topological Miniature Header (Proposal #1)
    card.appendChild(buildCardTopo(rec.doc, done, dom));

    const top = h("div", "bd-top");
    const chipCls = rec.source === "flagship" ? " flagship" : (rec.source === "design" ? " design" : "");
    top.appendChild(h("span", "chip" + chipCls, sourceChipLabel(rec)));
    if (dom && dom !== "software" && typeof domainLabel === "function") {
      const dl = domainLabel(dom);
      if (dl) top.appendChild(h("span", "chip dom-chip", dl));
    }
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

/* ═══ Field-study candidates ═══
   A Deconstruct whose subject is a physical mechanism carries meta.field_study,
   written by the model against the two bars in the prompt. None of them is
   built, so the reader gets a description rather than a link, and this is where
   a reader saying "I'd use this" is recorded. Interest is local, like
   everything else here — it exists to rank the queue, not to phone home. */
function labInterestMap() {
  return (meta.labInterest && typeof meta.labInterest === "object") ? meta.labInterest : {};
}
function labInterestHas(system) {
  return !!labInterestMap()[String(system || "").toLowerCase()];
}
async function labInterestAdd(system, fs) {
  const key = String(system || "").toLowerCase();
  if (!key) return;
  const map = Object.assign({}, labInterestMap());
  map[key] = { system: system, at: Date.now(), effort: (fs && fs.effort) || "medium" };
  meta.labInterest = map;
  await Store.saveMeta({ labInterest: map });
  toast(COPY.labMaybeDone);
}
/* Every stored Deconstruct the model flagged, newest first, wanted ones first. */
async function labCandidates() {
  const all = await Store.getBreakdowns();
  const want = labInterestMap();
  const out = [];
  for (const row of all) {
    const fs = row.doc && row.doc.meta && row.doc.meta.field_study;
    if (!fs) continue;
    if (fieldStudyFor(row.system)) continue;          // already built; it is not a candidate
    out.push({ system: row.system, fs: fs, wanted: !!want[String(row.system).toLowerCase()] });
  }
  out.sort((a, b) => (b.wanted - a.wanted) || a.system.localeCompare(b.system));
  return out;
}

let libFilter = "all";
let libQuery = "";

function recProgressPct(rec) {
  const n = (rec.doc && rec.doc.layers && rec.doc.layers.length) || 1;
  const done = (rec.doc && rec.doc.layers ? rec.doc.layers.filter(L => rec.attempts && rec.attempts[L.index] && rec.attempts[L.index].revealed).length : 0);
  return Math.round(100 * done / n);
}
function recDomain(rec) {
  return (rec.doc && rec.doc.meta && rec.doc.meta.domain) || "software";
}
function matchesRecQuery(rec, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const sys = (rec.system || "").toLowerCase();
  const slug = studySlug(rec).toLowerCase().replace(/-/g, " ");
  const ess = (rec.doc && rec.doc.essence && ((rec.doc.essence.beginner || "") + " " + (rec.doc.essence.text || "")) || "").toLowerCase();
  if (sys.includes(s) || slug.includes(s) || ess.includes(s)) return true;
  const layers = (rec.doc && rec.doc.layers) || [];
  return layers.some(L => (L.name || "").toLowerCase().includes(s) || (L.developer && L.developer.vocab || []).some(v => v.toLowerCase().includes(s)));
}
function matchesFieldStudyQuery(st, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return st.name.toLowerCase().includes(s) || st.sub.toLowerCase().includes(s) || st.terms.some(t => t.toLowerCase().includes(s));
}
function findBestInstantMatch(all, q) {
  const s = (q || "").trim().toLowerCase();
  if (s.length < 2) return null;
  // 1. Exact or prefix or substring breakdown match
  /* A study's 3D lab comes from the study itself, as on its library card.
     Taken from the query, "car" paired the card network with The Gear Change. */
  const exactRec = all.find(r => (r.system || "").trim().toLowerCase() === s || studySlug(r).toLowerCase().replace(/-/g, " ") === s);
  if (exactRec) return { kind: "rec", rec: exactRec, fs: fieldStudyFor(exactRec.system) };
  const subRec = all.find(r => (r.system || "").toLowerCase().includes(s) || studySlug(r).toLowerCase().replace(/-/g, " ").includes(s));
  if (subRec) return { kind: "rec", rec: subRec, fs: fieldStudyFor(subRec.system) };
  const fs = fieldStudyFor(s) || FIELD_STUDIES.find(st => st.name.toLowerCase().includes(s) || st.terms.some(t => t.includes(s)));
  if (fs) return { kind: "lab", st: fs };
  return null;
}

async function renderLibrary() {
  /* Read before touching the screen. With the await between the clear and
     the appends, two quick taps on Home interleaved and built the whole
     screen twice; now each call rebuilds it in one pass and the last wins. */
  const all = (await Store.getBreakdowns()).sort((a, b) => (b.lastOpen || b.created) - (a.lastOpen || a.created));
  const root = $("screen-library").firstElementChild;
  /* A background Deconstruct finishing re-renders Home under a reader who may
     be scrolled down or typing a search. The rebuilt search box gets their
     focus and caret back, and the scroll is put back if it moved. */
  const prevFocus = document.activeElement;
  const hadFocus = !!prevFocus && prevFocus.id === "deconInput";
  const caret = hadFocus ? [prevFocus.selectionStart, prevFocus.selectionEnd] : null;
  const keepTop = $("screen-library").scrollTop;
  root.textContent = "";
  const head = h("header", "lib-hero");
  head.appendChild(h("h1", "title", "What do you want to understand?"));
  head.appendChild(h("p", "subtitle", COPY.libraryLede));
  root.appendChild(head);

  const flagships = all.filter(b => b.source === "flagship");
  const yours = all.filter(b => b.source !== "flagship");

  const bar = h("div", "deconstruct-bar");
  const field = h("label", "db-field");
  field.appendChild(icon("sparkle", "db-ico"));
  const input = h("input");
  input.id = "deconInput";
  input.placeholder = COPY.deconstructPlaceholder;
  input.maxLength = 120;
  input.value = libQuery;
  input.setAttribute("aria-label", COPY.homeSearchAria);
  input.autocomplete = "off";
  field.appendChild(input);
  const go = ctaButton(COPY.deconstructBtn);
  const launchGenerate = name => {
    if (!name) return;
    if (!meta.apiKey) {
      renderSettings("Add your Anthropic API key to generate Deconstructs.");
      show("settings");
      return;
    }
    renderGenerate(name);
    show("generate");
  };
  const launch = () => {
    const name = input.value.trim();
    if (!name) return;
    const hit = findBestInstantMatch(all, name);
    // When no API key is configured, pressing Enter or Deconstruct on a matching
    // offline study opens it immediately instead of hitting the Settings wall.
    if (hit && !meta.apiKey) {
      if (hit.kind === "rec") { openReader(hit.rec.id); return; }
      if (hit.kind === "lab") { location.href = hit.st.href; return; }
    }
    launchGenerate(name);
  };
  go.onclick = launch;
  input.onkeydown = e => {
    if (e.key === "Enter") launch();
    else if (e.key === "Escape" && input.value) {
      e.stopPropagation();
      input.value = "";
      libQuery = "";
      paintBody();
    }
  };
  field.appendChild(go);
  bar.appendChild(field);
  root.appendChild(bar);

  const matchSlot = h("div", "omni-match-slot");
  root.appendChild(matchSlot);

  // second path: deconstruct a design you're building (not a known system)
  const subBar = h("div", "lib-subbar");
  const ownLink = setFace(h("button", "gbtn own-design-btn"), "pencil", COPY.ownDesignLink.replace(/\s*→$/, ""));
  ownLink.onclick = () => {
    if (!meta.apiKey) { renderSettings("Add your Anthropic API key to generate Deconstructs."); show("settings"); return; }
    renderGenerate("", "design");
    show("generate");
  };
  subBar.appendChild(ownLink);

  const filterBar = h("div", "lib-filters");
  filterBar.setAttribute("role", "group");
  filterBar.setAttribute("aria-label", COPY.homeFilterAria);
  const filters = [
    ["all", "All"],
    ...(yours.length ? [["yours", "Yours"]] : []),
    ["progress", "In progress"],
    ["done", "Completed"],
    ["software", "Software"],
    ["beyond", "Beyond software"],
    ["mech", "Mechanical & 3D"]
  ];
  if (!filters.some(([id]) => id === libFilter)) libFilter = "all";
  const filterBtns = {};
  filters.forEach(([id, label]) => {
    const b = h("button", "lib-fchip" + (libFilter === id ? " on" : ""), label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(libFilter === id));
    b.onclick = () => {
      libFilter = id;
      Object.entries(filterBtns).forEach(([k, btn]) => {
        btn.classList.toggle("on", k === libFilter);
        btn.setAttribute("aria-pressed", String(k === libFilter));
      });
      paintBody();
    };
    filterBtns[id] = b;
    filterBar.appendChild(b);
  });
  subBar.appendChild(filterBar);
  root.appendChild(subBar);

  const bodyWrap = h("div", "lib-body");
  root.appendChild(bodyWrap);

  const passesFilter = rec => {
    if (libFilter === "yours") return rec.source !== "flagship";
    if (libFilter === "progress") { const p = recProgressPct(rec); return p > 0 && p < 100; }
    if (libFilter === "done") return recProgressPct(rec) === 100;
    if (libFilter === "software") return recDomain(rec) === "software";
    if (libFilter === "beyond") return recDomain(rec) !== "software";
    if (libFilter === "mech") return recDomain(rec) === "mechanical" || !!fieldStudyFor(rec.system);
    return true;
  };

  function paintMatchBanner(q) {
    matchSlot.textContent = "";
    const hit = findBestInstantMatch(all, q);
    if (!hit) return;
    const banner = h("div", "omni-match");
    const info = h("div", "omni-match-info");
    if (hit.kind === "rec") {
      const rec = hit.rec;
      info.appendChild(h("span", "chip flagship", sourceChipLabel(rec)));
      info.appendChild(h("span", "omni-match-title", rec.system));
      info.appendChild(h("span", "omni-match-sub", `${rec.doc.layers.length} layers · works offline`));
      const acts = h("div", "omni-match-actions");
      const openBtn = h("button", "gbtn primary", COPY.matchOpen);
      openBtn.type = "button";
      openBtn.onclick = () => openReader(rec.id);
      acts.appendChild(openBtn);
      if (hit.fs) {
        const labLink = guardLabLink(h("a", "gbtn", COPY.labOpenAlso));
        labLink.href = hit.fs.href;
        acts.appendChild(labLink);
      }
      const genBtn = h("button", "gbtn ghost", "Generate fresh");
      genBtn.type = "button";
      genBtn.onclick = () => launchGenerate(q.trim());
      acts.appendChild(genBtn);
      banner.append(info, acts);
    } else if (hit.kind === "lab") {
      const st = hit.st;
      info.appendChild(h("span", "chip lab-chip", COPY.labCardChip));
      info.appendChild(h("span", "omni-match-title", st.name));
      info.appendChild(h("span", "omni-match-sub", st.sub));
      const acts = h("div", "omni-match-actions");
      const openLink = guardLabLink(h("a", "gbtn primary", COPY.labOpen));
      openLink.href = st.href;
      acts.appendChild(openLink);
      const genBtn = h("button", "gbtn ghost", "Deconstruct in 2D");
      genBtn.type = "button";
      genBtn.onclick = () => launchGenerate(q.trim());
      acts.appendChild(genBtn);
      banner.append(info, acts);
    }
    matchSlot.appendChild(banner);
  }

  function paintBody() {
    const q = libQuery.trim();
    paintMatchBanner(q);
    bodyWrap.textContent = "";

    const fYours = yours.filter(r => passesFilter(r) && matchesRecQuery(r, q));
    const fFlags = flagships.filter(r => passesFilter(r) && matchesRecQuery(r, q));
    const showLabs = (libFilter === "all" || libFilter === "mech") && FIELD_STUDIES.some(st => matchesFieldStudyQuery(st, q));
    const fLabs = (libFilter === "all" || libFilter === "mech") ? FIELD_STUDIES.filter(st => matchesFieldStudyQuery(st, q)) : [];

    const isFiltered = q.length > 0 || libFilter !== "all";

    // Your own Deconstructs are the point of the app; the samples only show
    // what one looks like.
    if (!isFiltered || fYours.length || libFilter === "yours") {
      bodyWrap.appendChild(sectionHead(COPY.yoursHeading, fYours.length ? fYours.length + (isFiltered ? " matching" : " so far") : null));
      if (fYours.length) bodyWrap.appendChild(cardGrid(fYours));
      /* filtered to nothing, the no-match panel below speaks (with its reset);
         a second panel here contradicted it */
      else if (!isFiltered) {
        const empty = h("div", "empty-panel");
        empty.appendChild(h("p", null, COPY.yoursEmpty));
        bodyWrap.appendChild(empty);
      }
    }

    if (libFilter !== "yours" && (fFlags.length || !isFiltered)) {
      bodyWrap.appendChild(sectionHead(COPY.sampleHeading, fFlags.length + (fFlags.length === 1 ? " system" : " systems")));
      if (!isFiltered) bodyWrap.appendChild(h("p", "lib-note", COPY.sampleNote));
      bodyWrap.appendChild(cardGrid(fFlags));
    }

    // Field studies: self-contained lab pages rather than schema documents,
    // so they live outside the breakdown store and link out as plain pages.
    if (showLabs && fLabs.length) {
      const n = fLabs.length;
      bodyWrap.appendChild(sectionHead(COPY.labHeading, n + (n === 1 ? " study" : " studies")));
      if (!isFiltered) bodyWrap.appendChild(h("p", "lib-note", COPY.labNote));
      const labGrid = h("div", "card-grid");
      fLabs.forEach(st => {
        const lab = guardLabLink(h("a", "bd-card lab-card"));
        lab.href = st.href;
        const top = h("div", "bd-top");
        top.appendChild(h("span", "chip lab-chip", COPY.labCardChip));
        top.appendChild(h("span", "chip", COPY.labCardChip3d));
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
      bodyWrap.appendChild(labGrid);
    }

    if (isFiltered && !fYours.length && !fFlags.length && !fLabs.length) {
      const none = h("div", "empty-panel");
      none.appendChild(h("p", null, q ? COPY.noMatchQuery(q) : COPY.noMatchFilter));
      if (libFilter !== "all" || q) {
        const rst = h("button", "gbtn", COPY.showAll);
        rst.type = "button";
        rst.style.marginTop = "10px";
        rst.onclick = () => {
          libFilter = "all";
          libQuery = "";
          input.value = "";
          Object.entries(filterBtns).forEach(([k, btn]) => {
            btn.classList.toggle("on", k === "all");
            btn.setAttribute("aria-pressed", String(k === "all"));
          });
          paintBody();
        };
        none.appendChild(rst);
      }
      bodyWrap.appendChild(none);
    }
  }

  input.oninput = () => {
    libQuery = input.value;
    paintBody();
  };
  paintBody();

  /* Candidates: flagged by the model, none of them built. Rendered as plain
     rows rather than cards on purpose — a card here would read as something
     you can open, and these are the ones you cannot. */
  const candWrap = h("div", "lab-cands");
  root.appendChild(candWrap);
  labCandidates().then(list => {
    candWrap.textContent = "";
    candWrap.appendChild(sectionHead(COPY.labCandHeading, list.length ? String(list.length) : ""));
    candWrap.appendChild(h("p", "lib-note", list.length ? COPY.labCandNote : COPY.labCandEmpty));
    if (!list.length) return;
    list.forEach(c => {
      const row = h("div", "cand-row" + (c.wanted ? " wanted" : ""));
      const head = h("div", "cand-head");
      head.appendChild(h("span", "cand-name", c.system));
      head.appendChild(h("span", "chip cand-effort", c.fs.effort));
      if (c.wanted) head.appendChild(h("span", "chip cand-want", "you'd use this"));
      row.appendChild(head);
      row.appendChild(h("p", "cand-ladder", c.fs.ladder));
      candWrap.appendChild(row);
    });
  });

  // quiet foundation of sharing: single-breakdown or full-backup .json import + drag-and-drop
  const importRow = h("div", "lib-foot");
  const imp = setFace(h("button", "gbtn ghost"), "upload", "Import a Deconstruct (.json)");
  imp.title = "Pick or drag & drop any .json Deconstruct or backup file";
  imp.onclick = () => pickFile(async file => {
    try {
      const rec = await importBreakdownJsonText(await file.text());
      if (rec) openReader(rec.id);
    } catch (e) { alert("Could not import: " + safeLine(e.message, 160)); }
  });
  importRow.appendChild(imp);
  const about = setFace(h("button", "gbtn ghost"), "info", "About Vitruvian");
  about.onclick = () => { renderLanding(); show("landing"); };
  importRow.appendChild(about);
  /* Request-a-system link hidden for now — restore by re-appending req.
  const req = h("a", "gbtn", COPY.requestLink);   // demand signal, no backend: a GitHub issue
  req.href = CONFIG.repoUrl + "/issues/new?template=request-a-system.md&title=Deconstruct%3A+";
  req.target = "_blank";
  req.target = "_blank";
  req.rel = "noopener";
  importRow.appendChild(req);
  */
  root.appendChild(importRow);

  const libScreen = $("screen-library");
  if (hadFocus) {
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(caret[0], caret[1]); } catch (e) {}
  }
  if (!libScreen.hidden && libScreen.scrollTop !== keepTop) libScreen.scrollTo({ top: keepTop, behavior: "instant" });
  if (libScreen && !libScreen._dropWired) {
    libScreen._dropWired = true;
    let dragDepth = 0;
    const clearCue = () => { dragDepth = 0; libScreen.classList.remove("drop-active"); };
    libScreen.addEventListener("dragenter", e => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      dragDepth++;
      libScreen.classList.add("drop-active");
    });
    libScreen.addEventListener("dragover", e => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      libScreen.classList.add("drop-active");
    });
    libScreen.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) libScreen.classList.remove("drop-active");
    });
    libScreen.addEventListener("drop", async e => {
      clearCue();
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      const file = Array.from(e.dataTransfer.files).find(f => /\.json$/i.test(f.name)) || e.dataTransfer.files[0];
      if (!file) return;
      try {
        const rec = await importBreakdownJsonText(await file.text());
        if (rec) openReader(rec.id);
      } catch (err) { alert("Could not import dropped file: " + safeLine(err.message, 160)); }
    });
  }
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
    /* already on the trail (B expands back to A): cut back to it, or the
       crumb went on calling the last entry "here" while A was open */
    const at = drillStack.findIndex(e => e.id === match.id);
    if (at >= 0) drillStack = drillStack.slice(0, at + 1);
    else drillStack.push({ id: match.id, system: match.system });
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

/* ═══ Feature tips ═══
   Not a first-run tour. A tour runs once, in the first two minutes, when you
   have no questions yet — and it cannot say anything useful about Graft,
   because you will not open Graft for a week. These fire one at a time, the
   first time you reach the thing they describe, and then never again.

   One card per arrival, never a queue. Opening a sample used to stack every
   reader tip at once ("1 of 7") over the step tabs, before a word had been
   read. A screen now offers one tip on arrival. A tip marked when: "used"
   is not offered on arrival at all: it waits for its own thing (the second
   step of a layer, the ⋯ menu, Diagram tools, the key), because the moment
   you use a thing is the moment a sentence about it can land.

   On by default and they stay on, because "on" here costs one card the first
   time you meet each feature and nothing after. meta.tipsDone records which
   ids are spent, so turning tips off and on again does not replay what you
   have already read; "Show them all again" is the deliberate way to do that.
   A tip whose target is not on the page is skipped, not queued, so a tip for
   a button this system does not have simply never fires. ══════════════ */
const featureTips = (() => {
  let card = null, ringed = null, tip = null, back = null;
  // used on the way out of their screen (Graft leaves the reader): offered on the way back
  const held = new Set();

  const on = () => meta.tipsOn !== false;            // absent means on
  const done = () => (meta.tipsDone && typeof meta.tipsDone === "object") ? meta.tipsDone : {};
  /* Look inside the screen first, then fall back to the whole page: some of
     what a screen offers lives in the topbar, which is not inside the screen
     element. Scoping to the screen alone silently made those tips unfirable.
     The fallback is safe because a tip only opens for the screen that is
     currently showing. */
  const find = (t, sel = t.target) => {
    const root = $("screen-" + t.screen);
    if (!root || root.hidden) return null;
    const sels = sel.split(",").map(x => x.trim());
    // getClientRects, not offsetParent: SVG targets (the drill badge) have no offsetParent
    const hit = root => sels.map(s => root.querySelector(s)).find(el => el && el.getClientRects().length > 0);
    return hit(root) || hit(document);
  };

  function close() {
    if (ringed) ringed.classList.remove("tip-ring");
    ringed = null;
    if (card) card.remove();
    card = null; tip = null;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
    document.removeEventListener("scroll", place, true);
  }
  async function markDone(id) {
    const d = Object.assign({}, done()); d[id] = true;
    meta.tipsDone = d;
    await Store.saveMeta({ tipsDone: d });
  }
  /* Closed by hand, the card hands focus back to what you were using: a tip
     that answers a tap took the focus from the thing you tapped. */
  function closeByHand() {
    const to = back;
    close();
    if (to && to.isConnected && to.getClientRects().length) {
      try { to.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); dismiss(); } }
  async function dismiss() { const t = tip; closeByHand(); if (t) await markDone(t.id); }

  function place() {
    if (!card || !card.isConnected) return;
    const t = ringed && ringed.getBoundingClientRect();
    const w = Math.min(330, innerWidth - 32);
    card.style.width = w + "px";
    const ch = card.offsetHeight;
    if (!t || !t.width) {
      card.style.left = (innerWidth - w) / 2 + "px";
      card.style.top = (innerHeight - ch) / 2 + "px";
      return;
    }
    const fitX = x => Math.max(16, Math.min(innerWidth - w - 16, x));
    const fitY = y => Math.max(12, Math.min(innerHeight - ch - 12, y));
    const x = fitX(t.left + t.width / 2 - w / 2);
    /* Below the target, else above it. A tip that answers a tap also names
       what it must keep clear (the menu that just opened, the open key):
       placed by its target alone, the card landed on the very thing it was
       describing. Then beside that thing, then below or above it. */
    const keep = tip && tip.clear ? find(tip, tip.clear) : null;
    const k = keep && keep.getBoundingClientRect();
    const spots = [[x, t.bottom + 12], [x, t.top - ch - 12]];
    if (k) spots.push([fitX(k.left - w - 12), fitY(k.top)], [fitX(k.right + 12), fitY(k.top)],
                      [x, k.bottom + 12], [x, k.top - ch - 12]);
    const isClear = ([sx, sy]) => sy >= 12 && sy + ch <= innerHeight - 12 &&
      !(k && sx < k.right && sx + w > k.left && sy < k.bottom && sy + ch > k.top);
    // no clear spot: over the target's top edge, and never past the bottom
    // edge, because a card whose buttons are off screen cannot be closed on a phone
    const [sx, sy] = spots.find(isClear) || [x, fitY(t.top + 12)];
    card.style.left = sx + "px";
    card.style.top = sy + "px";
  }

  /* A target below the fold put the card below the fold too. Scroll it into
     view first, moving only the screen's own scroller: scrollIntoView would
     also shift the reader's clipped panes, which are laid out by hand. The
     scroll is smooth, so place() follows it on scroll. */
  function reveal(el) {
    const scr = el.closest(".screen");
    if (!scr) return;
    const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect();
    if (r.top >= s.top && r.bottom <= s.bottom) return;
    scr.scrollTop += r.top - s.top - Math.max(16, (s.height - r.height) / 3);
  }

  function build() {
    card = h("div", "tip-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    /* A click on the card stays on the card. The ⋯ menu closes on any click
       on the page, so "Got it" on the tip about that menu shut the menu it
       had just explained. */
    card.addEventListener("click", e => e.stopPropagation());
    const count = h("div", "tip-count", "Tip");
    const title = h("h3", "tip-title");
    const text = h("p", "tip-text");
    const row = h("div", "tip-row");
    const off = h("button", "gbtn ghost tip-off", "Turn tips off");
    const next = h("button", "gbtn primary tip-next", "Got it");
    off.onclick = async () => {
      closeByHand();
      meta.tipsOn = false;
      await Store.saveMeta({ tipsOn: false });
      toast("Tips off. Settings turns them back on.");
    };
    next.onclick = () => dismiss();
    row.append(off, next);
    card.append(count, title, text, row);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);   // screens scroll themselves; capture catches them
    document.body.appendChild(card);
  }

  function open(t) {
    const el = find(t);
    if (!el) return;
    held.delete(t.id);
    tip = t;
    back = document.activeElement;
    build();
    ringed = el;
    ringed.classList.add("tip-ring");
    card.querySelector(".tip-title").textContent = t.title;
    card.querySelector(".tip-text").textContent = t.text;
    reveal(ringed);
    place();
    card.querySelector(".tip-next").focus();
  }

  /* Called whenever a screen settles. Offers one tip: one held from a tool
     used on the way out, else the first unspent tip for this screen that
     waits only for arrival and whose target is on the page. The rest come
     on later arrivals, or when their thing is used. */
  function visit(screen) {
    if (!on() || card) return;
    const spent = done();
    const left = (COPY.tips || []).filter(t => t.screen === screen && !spent[t.id] && find(t));
    const t = left.find(x => held.has(x.id)) || left.find(x => x.when !== "used");
    if (t) open(t);
  }

  /* Called by the thing a "used" tip describes, every time it is used, so
     the tip is offered until it has been read. A card already showing wins
     and the next use offers it again. The pause lets the thing finish
     opening, so the card is placed beside it rather than on it. */
  function trigger(id) {
    const t = (COPY.tips || []).find(x => x.id === id);
    if (!t || !on() || done()[id]) return;
    setTimeout(() => {
      if (!on() || done()[id] || card) return;
      if (document.body.dataset.screen !== t.screen) { held.add(id); return; }
      open(t);
    }, 300);
  }

  return {
    visit,
    trigger,
    close,
    get enabled() { return on(); },
    async setEnabled(v) { meta.tipsOn = !!v; await Store.saveMeta({ tipsOn: !!v }); if (!v) close(); },
    async reset() { held.clear(); meta.tipsDone = {}; await Store.saveMeta({ tipsDone: {} }); },
    remaining() {
      const spent = done();
      return (COPY.tips || []).filter(t => !spent[t.id]).length;
    }
  };
})();

const SHEET_SNAPS = [0.3, 0.52, 0.88];          // share of the reader the sheet covers
const SHEET_NAMES = ["mostly diagram", "half and half", "mostly text"];
function sheetDrag(wrap, sheet, grip) {
  /* On a phone the chrome above and below the diagram — topbar, timeline,
     caption, transport — already takes most of what the sheet leaves, so the
     old half-and-half default gave the signature artifact 29% of the screen.
     Narrow screens open on "mostly diagram"; the reader's own choice, once
     made, still wins. */
  let snap = 1;
  try { const v = parseInt(localStorage.getItem("vitruvian_sheet_snap"), 10); if (v >= 0 && v < SHEET_SNAPS.length) snap = v; } catch (e) {}
  const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MIN_SNAP = SHEET_SNAPS[0], MAX_SNAP = SHEET_SNAPS[SHEET_SNAPS.length - 1];
  const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  const softClamp = raw => {
    if (raw < MIN_SNAP) return MIN_SNAP - rubberband(MIN_SNAP - raw, 0.22);
    if (raw > MAX_SNAP) return MAX_SNAP + rubberband(raw - MAX_SNAP, 0.14);
    return raw;
  };
  let liveFrac = SHEET_SNAPS[snap], vel = 0, springRaf = 0;
  const apply = (frac, moving) => {
    liveFrac = frac;
    wrap.classList.toggle("sheet-moving", !!moving);
    wrap.style.setProperty("--sheet", (frac * 100).toFixed(2) + "%");
  };
  const springTo = (target, initVel = 0) => {
    if (springRaf) { cancelAnimationFrame(springRaf); springRaf = 0; }
    if (RM || Math.abs(target - liveFrac) < 0.001 && Math.abs(initVel) < 0.005) {
      vel = 0;
      apply(target, false);
      return;
    }
    vel = initVel;
    const response = 0.30;
    const damping = Math.abs(initVel) > 0.35 ? 0.84 : 1.0;
    const omega = (2 * Math.PI) / response;
    const k = omega * omega, c = 2 * damping * omega;
    let lastT = performance.now();
    const step = now => {
      const dt = Math.min(0.032, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      const disp = liveFrac - target;
      const acc = -k * disp - c * vel;
      vel += acc * dt;
      liveFrac += vel * dt;
      if (Math.abs(target - liveFrac) < 0.0008 && Math.abs(vel) < 0.005) {
        vel = 0;
        springRaf = 0;
        apply(target, false);
        return;
      }
      apply(liveFrac, true);
      springRaf = requestAnimationFrame(step);
    };
    springRaf = requestAnimationFrame(step);
  };
  const setSnap = (i, initVel = 0, immediate = false) => {
    snap = Math.max(0, Math.min(SHEET_SNAPS.length - 1, i));
    const target = SHEET_SNAPS[snap];
    if (immediate) apply(target, false);
    else springTo(target, initVel);
    grip.setAttribute("aria-label", `Reading panel: ${SHEET_NAMES[snap]}. Tap or use the arrow keys to resize.`);
    try { localStorage.setItem("vitruvian_sheet_snap", String(snap)); } catch (e) {}
  };
  setSnap(snap, 0, true);
  let start = null, moved = false, samples = [];
  grip.addEventListener("pointerdown", e => {
    if (springRaf) { cancelAnimationFrame(springRaf); springRaf = 0; }
    vel = 0;
    start = { y: e.clientY, frac: liveFrac, h: wrap.clientHeight || 1 };
    moved = false;
    samples = [{ t: performance.now(), frac: liveFrac }];
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener("pointermove", e => {
    if (!start) return;
    const dy = start.y - e.clientY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved) {
      const next = softClamp(start.frac + dy / start.h);
      apply(next, true);
      const now = performance.now();
      samples.push({ t: now, frac: next });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
    }
  });
  const end = () => {
    if (!start) return;
    if (moved) {
      let releaseVel = 0;
      const now = performance.now();
      while (samples.length > 2 && now - samples[0].t > 110) samples.shift();
      if (samples.length >= 2) {
        const a = samples[0], b = samples[samples.length - 1];
        const dt = (b.t - a.t) / 1000;
        if (dt > 0.008) releaseVel = Math.max(-5, Math.min(5, (b.frac - a.frac) / dt));
      }
      // Apple exponential deceleration projection (decelerationRate = 0.994)
      const projected = liveFrac + (releaseVel / 1000) * (0.994 / (1 - 0.994));
      let best = 0;
      SHEET_SNAPS.forEach((f, i) => { if (Math.abs(f - projected) < Math.abs(SHEET_SNAPS[best] - projected)) best = i; });
      setSnap(best, releaseVel, false);
    }
    start = null;
    samples = [];
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  // a tap steps up and wraps back down; the drag already ended without a click
  grip.addEventListener("click", () => { if (moved) { moved = false; return; } setSnap(snap === SHEET_SNAPS.length - 1 ? 0 : snap + 1, 0, false); });
  grip.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setSnap(snap + 1, 0, false); }
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setSnap(snap - 1, 0, false); }
  });
}

function paneSplitDrag(wrap, split) {
  let pct = 58;
  try {
    const v = parseFloat(localStorage.getItem("vitruvian_pane_split"));
    if (Number.isFinite(v) && v >= 34 && v <= 70) pct = v;
  } catch (e) {}
  const apply = (val, persist) => {
    pct = Math.max(34, Math.min(70, val));
    wrap.style.setProperty("--split-left", pct.toFixed(2) + "%");
    split.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (persist) {
      try { localStorage.setItem("vitruvian_pane_split", pct.toFixed(2)); } catch (e) {}
    }
  };
  apply(pct, false);
  let dragging = false;
  split.addEventListener("pointerdown", e => {
    if (e.button && e.button !== 0) return;
    dragging = true;
    wrap.classList.add("split-moving");
    split.setPointerCapture(e.pointerId);
  });
  split.addEventListener("pointermove", e => {
    if (!dragging) return;
    const r = wrap.getBoundingClientRect();
    if (r.width > 100) apply(((e.clientX - r.left) / r.width) * 100, false);
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove("split-moving");
    apply(pct, true);
  };
  split.addEventListener("pointerup", stop);
  split.addEventListener("pointercancel", stop);
  split.addEventListener("dblclick", e => {
    e.stopPropagation();
    apply(58, true);
  });
  split.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); apply(pct - 3, true); }
    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); apply(pct + 3, true); }
    else if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); apply(58, true); }
  });
}

async function openReader(id, layerIndex, opts = {}) {
  /* same reason as in show(): a drill, breadcrumb or vocab jump re-opens the
     reader without passing show()'s teardown, so the outgoing study's last
     edits are written before its view is torn down below */
  if (currentView) await flushSaves();
  const allBreakdowns = await Store.getBreakdowns();
  const rec = allBreakdowns.find(b => b.id === id) || await Store.getBreakdown(id);
  if (!rec) return;
  const knownSystemNames = new Set(allBreakdowns.map(b => (b.system || "").trim().toLowerCase()));
  const hasStudy = sub => knownSystemNames.has(String(sub || "").trim().toLowerCase());
  if (currentView) currentView.destroy();   // re-open (e.g. from Models index) skips show()'s teardown
  retireDiagram();                          // likewise the previous study's diagram and its Pulse
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
  /* All .collapsed has ever hidden is the key (styles.css); the drawing stays.
     The button is only shown on wide screens, where it is the one way to put
     the key away, so it is named for what it does. */
  const capToggle = setFace(h("button", "gbtn sim-btn icon-only cap-toggle"), "chevronDown");
  capToggle.setAttribute("aria-label", "Hide key");
  capToggle.title = "Hide key";
  capToggle.onclick = () => {
    const collapsed = dpane.classList.toggle("collapsed");
    setFace(capToggle, collapsed ? "chevronUp" : "chevronDown");
    capToggle.setAttribute("aria-label", collapsed ? "Show key" : "Hide key");
    capToggle.title = collapsed ? "Show key" : "Hide key";
  };
  const playBtn = setFace(h("button", "gbtn sim-btn sim-primary"), "play", COPY.pulse);
  playBtn.title = "Send live traffic through this state";
  const loadBtn = setFace(h("button", "gbtn sim-btn"), "gauge", "Load");
  loadBtn.title = "Turn up the traffic until something saturates";
  /* Replay and Before used to sit here as well, doubling the labelled
     buttons in the step card ("Replay the failure", "Compare before and
     after"). They live only there now, where their labels explain them;
     holding B still flips to Before from anywhere in the fix step. */
  const raceBtn = setFace(h("button", "gbtn sim-btn"), "races", "Races");
  raceBtn.title = "Highlight nodes with two or more concurrent writers, where races can happen";
  const spineBtn = setFace(h("button", "gbtn sim-btn"), "spine", "Spine");
  spineBtn.title = "Trace the critical path a request waits on, and ring the nodes that would take the whole system down";
  const sequenceBtn = setFace(h("button", "gbtn sim-btn"), "sequence", COPY.toolSequenceLabel);
  sequenceBtn.title = COPY.toolSequence;
  loadBtn.hidden = true;
  const capSep = () => h("span", "cap-sep");
  /* How much of the past stays drawn. One layer is the aggressive setting:
     only what this layer added keeps its own box. The choice is the reader's
     and it sticks, because the right amount of abstraction depends on how
     well they already know the system. */
  const foldLevels = h("div", "fold-levels");
  foldLevels.setAttribute("role", "group");
  foldLevels.setAttribute("aria-label", COPY.foldLevelsLabel);
  const foldOpts = [1, 2, 3].map(k => {
    const b = h("button", "fold-lvl", String(k));
    b.type = "button";
    b.title = k === 1 ? COPY.foldLvl1 : COPY.foldLvlN(k);
    b.setAttribute("aria-label", b.title);
    foldLevels.appendChild(b);
    return b;
  });
  foldLevels.insertBefore(h("span", "fold-levels-cap", COPY.foldLevelsCap), foldLevels.firstChild);

  /* Diagram tools: the instruments that change how the diagram is drawn, one
     tap away instead of always on show. Everything in it acts on the drawing
     (Sequence view redraws the same state as a timeline); exports went to
     the ⋯ menu with the other exports. The name stays off "Lab", which
     belongs to the field studies under lab/. */
  const toolsBtn = setFace(h("button", "gbtn sim-btn tools-btn"), "tools", COPY.toolsLabel);
  toolsBtn.appendChild(icon("chevronUp", "tools-caret"));   // it opens upward, over the drawing
  toolsBtn.title = COPY.toolsHint;
  // the label hides on narrow chrome, and a display:none label names nothing
  toolsBtn.setAttribute("aria-label", COPY.toolsLabel);
  toolsBtn.setAttribute("aria-haspopup", "true");
  toolsBtn.setAttribute("aria-expanded", "false");
  const toolsMenu = h("div", "tools-menu");
  toolsMenu.hidden = true;
  toolsMenu.setAttribute("role", "menu");
  toolsMenu.setAttribute("aria-label", COPY.toolsLabel);
  const foldBtn = setFace(h("button", "gbtn sim-btn"), "layers", COPY.foldLabel);
  foldBtn.title = COPY.foldHint;
  [[raceBtn, COPY.toolRaces],
   [spineBtn, COPY.toolSpine],
   [foldBtn, COPY.foldDesc],
   [sequenceBtn, COPY.toolSequence]].forEach(([btn, desc]) => {
    const item = h("div", "tools-item");
    item.append(btn, h("p", "tools-desc", desc));
    if (btn === foldBtn) item.appendChild(foldLevels);
    toolsMenu.appendChild(item);
  });
  const setTools = open => { toolsMenu.hidden = !open; toolsBtn.setAttribute("aria-expanded", String(open)); toolsBtn.classList.toggle("on", open); };
  toolsBtn.onclick = e => {
    e.stopPropagation();
    setTools(toolsMenu.hidden);
    if (toolsMenu.hidden) return;
    soloOverlay("tools");
    $("menuPop").hidden = true;   // the stopped click never reaches the document handler that closes ⋯
    featureTips.trigger("tools");
  };
  toolsMenu.onclick = e => e.stopPropagation();
  const toolsEsc = e => { if (e.key === "Escape" && !toolsMenu.hidden) { e.stopPropagation(); setTools(false); toolsBtn.focus(); } };
  toolsBtn.addEventListener("keydown", toolsEsc);
  toolsMenu.addEventListener("keydown", toolsEsc);
  pane.onclick = () => setTools(false);
  // the overlay covers the reader, so the menu that opened it goes away first
  sequenceBtn.onclick = () => { setTools(false); openSequence(rec); };
  /* Zoom. Fit is what the renderer does by itself; these exist so the reader
     can get in closer and get back out again, which on desktop was previously
     impossible — the pinch handler ignores anything that is not a touch. */
  const zoomBar = h("div", "dg-zoom");
  const zOut = h("button", "zbtn", "\u2212");
  const zFit = h("button", "zbtn zfit", COPY.zoomFit);
  const zIn = h("button", "zbtn", "+");
  [[zOut, COPY.zoomOutHint], [zFit, COPY.zoomFitHint], [zIn, COPY.zoomInHint]].forEach(([b, t]) => {
    b.type = "button"; b.title = t; b.setAttribute("aria-label", t);
  });
  zoomBar.append(zOut, zFit, zIn);

  const capTools = h("div", "cap-tools");
  capTools.append(playBtn, loadBtn, capSep(), zoomBar, toolsBtn, capToggle);
  dcap.append(capState, capTools);
  const scrubEl = h("div", "scrub-wrap");
  /* The caption narrates a failure the reader just watched, so it is marked
     by a caution sign rather than a coloured edge. Drawn through rough.js at
     the same roughness the diagram's own small marks use, so it belongs to
     the drawing beside it instead of looking like interface chrome.

     Built once: the sign never changes, and re-roughening it on every replay
     would make it twitch. */
  const caption = h("div", "dg-caption");
  caption.hidden = true;
  const capIcon = (() => {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", "cap-caution");
    svg.setAttribute("aria-hidden", "true");
    /* a triangle and a bang: three strokes and two marks, which is all that
       survives at this size — the same bar the node glyphs are held to */
    const parts = [
      ["M 10 2.2 L 18.2 16.4 L 1.8 16.4 Z", 1.5],
      ["M 10 7.1 L 10 11.6", 1.6],
      ["M 10 13.9 L 10 14.1", 2.2]
    ];
    const gen = (typeof rough !== "undefined" && rough.generator) ? rough.generator() : null;
    parts.forEach(([d, w], i) => {
      let out = d;
      if (gen) {
        try {
          const ps = gen.toPaths(gen.path(d, { seed: 41 + i * 7, roughness: 0.6, bowing: 0.7,
                                               disableMultiStroke: true, preserveVertices: true }));
          if (ps.length && ps[0].d) out = ps.map(x => x.d).join(" ");
        } catch (e) { /* the exact path is a fine fallback */ }
      }
      const el = document.createElementNS(NS, "path");
      el.setAttribute("d", out);
      el.setAttribute("stroke-width", String(w));
      svg.appendChild(el);
    });
    return svg;
  })();
  const capText = h("span", "cap-text");
  caption.append(capIcon, capText);
  // live HUD: throughput / in-flight / crashed while the sim runs
  const hud = h("div", "dg-hud");
  hud.hidden = true;
  const hudRate = h("span", "hud-stat"), hudFlight = h("span", "hud-stat"), hudCrash = h("span", "hud-stat crash"), hudHint = h("span", "hud-hint", "tap any node to kill it");
  hud.append(hudRate, hudFlight, hudCrash, hudHint);
  /* Says the diagram is not showing everything, and takes the saying-so back
     in one tap. A view that hides things without a standing notice is a view
     that misleads. */
  /* "Why is this here?" — the question the whole app is built to answer, and
     until now the one thing you could not ask the drawing. */
  const originCard = h("div", "dg-origin");
  originCard.hidden = true;
  const oHead = h("div", "org-head");
  const oTitle = h("div", "org-name");
  const oClose = h("button", "org-close", "\u00d7");
  oClose.type = "button";
  oClose.title = "Close (Esc)";
  oClose.setAttribute("aria-label", "Close card");
  oHead.append(oTitle, oClose);
  const oWhen = h("div", "org-when");
  const oDoes = h("div", "org-does");
  const oGo = h("button", "gbtn org-go");
  oGo.type = "button";
  originCard.append(oHead, oWhen, oDoes, oGo);

  const foldPill = h("button", "dg-fold-pill");
  foldPill.type = "button";
  foldPill.hidden = true;
  const pillMain = h("span", "fold-main", COPY.foldOn);
  const pillWhat = h("span", "fold-what");
  const pillOff = h("span", "fold-off", COPY.foldTapOff);
  foldPill.append(pillMain, pillWhat, pillOff);
  const legendEl = Diagram.legend();
  /* The key's tip waits for the key to be used: a tap on an entry, or on a
     phone the tap that opens it. Closing it is not using it. */
  legendEl.addEventListener("click", e => {
    const hit = e.target.closest(".dgl-tap, .dgl-tog");
    if (!hit || (hit.classList.contains("dgl-tog") && !legendEl.classList.contains("open"))) return;
    featureTips.trigger("key");
  });
  dpane.append(dscroll, hud, foldPill, originCard, caption, legendEl, scrubEl, dcap, toolsMenu);   // legend: the tutorial's grammar, always in view
  const docPane = h("div", "doc-pane");
  /* On a phone the step card is a bottom sheet over the diagram. The grip
     drags it between three heights, or steps through them by tap or arrow
     keys; the diagram gets whatever the sheet leaves. On wider screens the
     sheet is just the right-hand column and the grip is hidden. */
  const docSheet = h("div", "doc-sheet");
  const grip = h("button", "sheet-grip");
  grip.appendChild(h("span", "sheet-grip-bar"));
  docSheet.append(grip, docPane);
  const paneSplit = h("div", "pane-split");
  paneSplit.tabIndex = 0;
  paneSplit.setAttribute("role", "separator");
  paneSplit.setAttribute("aria-orientation", "vertical");
  paneSplit.setAttribute("aria-label", "Resize diagram and reading panes. Drag, double-click to reset, or use Left and Right arrow keys.");
  paneSplit.setAttribute("aria-valuemin", "34");
  paneSplit.setAttribute("aria-valuemax", "70");
  paneSplit.title = "Drag to resize panes · Double-click to reset";
  paneSplit.appendChild(h("span", "pane-split-bar"));
  wrap.append(dpane, paneSplit, docSheet);
  sheetDrag(wrap, docSheet, grip);
  paneSplitDrag(wrap, paneSplit);
  // breadcrumb: only while nested (drilled at least one level deep)
  if (drillStack.length > 1) pane.appendChild(drillCrumb());
  pane.appendChild(wrap);

  const diagram = Diagram.mount(dscroll, rec.doc, {
    hasStudy,
    onNodeHover: (nodeId, isOver) => {
      // Reverse tethering: highlight matching cards in prose pane (Wave E · Proposal #3)
      const pane = document.querySelector(".doc-pane");
      if (!pane) return;
      pane.querySelectorAll(".spot-card").forEach(c => {
        const ids = (c.dataset.spotIds || "").split(",");
        c.classList.toggle("card-reverse-highlight", isOver && ids.includes(nodeId));
      });
    }
  });

  currentDiagram = diagram;

  // Corner Registration Marks (Wave E · Proposal #5)
  ["tl", "tr", "bl", "br"].forEach(pos => {
    const mark = h("div", "reg-mark " + pos);
    mark.setAttribute("aria-hidden", "true");
    dpane.appendChild(mark);
  });

  diagram.onDrill((sub) => drillInto(sub));
  // the key lists only the glyphs this state actually uses, and tapping one
  // lights the nodes that carry it. onRender holds a single callback, so the
  // key and the abstraction pill share it — registered once, below, after
  // paintFold exists.
  const onDiagramRender = st => {
    if (legendEl.update) legendEl.update(st, diagram);
    paintFold();
  };

  /* flow simulation controls — instant response on press; any state change
     stops the sim (via diagram.show) and this resets the buttons */
  let captionTimer = null;
  const resetSimUI = () => {
    setFace(playBtn, "play", COPY.pulse);
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
  if (!diagram.sim.available) playBtn.hidden = true;   // prefers-reduced-motion
  playBtn.onclick = () => {
    if (diagram.sim.running) { diagram.sim.stop(); }
    else if (diagram.sim.start()) {
      setFace(playBtn, "stop", COPY.pulseStop);
      playBtn.classList.add("on");
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
  /* ── Abstraction ──
     The level is the reader's and it sticks across documents, because how
     much of a system you want folded depends on how well you already know
     systems, not on which one you are reading. Off is the default: a reader
     who has not asked for it should see what was drawn. */
  let foldKeep = Number(meta.foldKeep) > 0 ? Math.min(3, Number(meta.foldKeep)) : 0;
  const paintFold = () => {
    const on = foldKeep > 0;
    foldBtn.classList.toggle("on", on);
    foldBtn.setAttribute("aria-pressed", String(on));
    foldOpts.forEach((b, k) => {
      b.classList.toggle("on", on && foldKeep === k + 1);
      b.setAttribute("aria-pressed", String(on && foldKeep === k + 1));
    });
    foldLevels.classList.toggle("live", on);
    const info = diagram.foldInfo();
    /* The pill only claims something is folded when something is. On the
       early layers there is nothing settled yet, and a notice that said
       otherwise would be the diagram lying about itself. */
    foldPill.hidden = !(on && info && info.boxes > 0);
    if (!foldPill.hidden) {
      const opened = diagram.foldOpenCount();
      pillWhat.textContent = opened ? COPY.foldSome(info.boxes, opened) : COPY.foldWhat(info.boxes);
      foldPill.title = COPY.foldSet(foldKeep);
    }
    paintZoom();
  };
  const applyFold = (keep, say) => {
    foldKeep = keep;
    diagram.setFold(keep);
    meta.foldKeep = keep;
    Store.saveMeta({ foldKeep: keep });
    if (currentView && currentView.refresh) currentView.refresh();
    paintFold();
    if (say) {
      const info = diagram.foldInfo();
      toast(keep === 0 ? COPY.foldOff
            : (info && info.boxes) ? COPY.foldSet(keep) : COPY.foldNothing);
    }
  };
  /* ── zoom (Wave E · Proposal #5) ── */
  /* the renderer calls back after every zoom, however it happened —
     double-click, pinch, wheel — so the readout and Fit stay true without
     each control having to remember to repaint */
  const paintZoom = () => {
    const whole = diagram.fitsWhole();
    const currentZ = diagram.zoom.current();
    const fitZ = diagram.zoom.fitZ();
    const pct = Math.round((currentZ / fitZ) * 100);
    zFit.classList.toggle("on", diagram.isAutoFit());
    zFit.disabled = whole && diagram.isAutoFit();
    zoomBar.hidden = whole && diagram.isAutoFit() && !diagram.doc.layers.length;
    zFit.textContent = (diagram.isAutoFit() || Math.abs(currentZ - fitZ) < 0.03) ? "FIT" : `${pct}% ↺`;
  };
  diagram.onZoom(paintZoom);
  zOut.onclick = () => { diagram.zoomBy(1 / 1.25); paintZoom(); };
  zIn.onclick = () => { diagram.zoomBy(1.25); paintZoom(); };
  zFit.onclick = () => { diagram.fitNow(); paintZoom(); };
  /* desktop: the modifier-wheel gesture every map and canvas uses (and how
     macOS delivers two-finger trackpad pinch). Continuous 1:1 factor anchored
     at the cursor keeps trackpad pinches fluid instead of jumping by fixed
     steps around the center. */
  dscroll.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const modeScale = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 120 : 1);
    const dy = Math.max(-80, Math.min(80, e.deltaY * modeScale));
    const factor = Math.exp(-dy * 0.0045);
    diagram.zoomAtFactor(factor, e.clientX, e.clientY);
    paintZoom();
  }, { passive: false });

  /* ── why is this part here ── */
  const closeOrigin = () => { originCard.hidden = true; };
  /* One overlay on the drawing at a time. Diagram tools, the origin card and
     the replay caption all float over the drawing's lower edge, and on a
     desktop they piled up in the same corner. Whichever opened last stays.
     Closing the origin card here leaves its part traced: only the card goes,
     not what the reader asked the drawing to show. */
  const soloOverlay = keep => {
    if (keep !== "tools") setTools(false);
    if (keep !== "origin") closeOrigin();
    if (keep !== "caption") { caption.hidden = true; clearTimeout(captionTimer); }
  };
  oClose.onclick = () => {
    closeOrigin();
    diagram.spotlight(null);
  };
  /* One live listener, replaced on every open. Each reader used to add its
     own and never remove it, so every Escape ran one per study opened, and
     each kept its whole reader (diagram, record, DOM) reachable. Held at
     module level rather than torn down with the view, because two opens in
     quick succession can skip that teardown. */
  if (originEscHandler) document.removeEventListener("keydown", originEscHandler);
  originEscHandler = e => {
    if (e.key === "Escape" && !originCard.hidden && originCard.isConnected) {
      e.stopPropagation();
      closeOrigin();
      diagram.spotlight(null);
    }
  };
  document.addEventListener("keydown", originEscHandler);
  diagram.onSelect(sel => {
    if (!sel) { closeOrigin(); return; }
    oTitle.textContent = sel.label;
    if (sel.layerIndex == null) { closeOrigin(); return; }
    oDoes.textContent = sel.does || "";
    oDoes.hidden = !sel.does;
    if (sel.layerIndex < 0) {
      oWhen.textContent = COPY.originBase;
      oGo.hidden = true;
    } else {
      oWhen.textContent = COPY.originAt(sel.layerIndex + 1, sel.layerName);
      oGo.hidden = false;
      oGo.textContent = COPY.originGo;
      oGo.onclick = () => {
        closeOrigin();
        if (currentView && currentView.goToLayer) currentView.goToLayer(sel.layerIndex + 1);
      };
    }
    /* Sit on the drawing's own bottom edge, not the pane's: the key, the
       scrubber and the control bar live below the drawing, and a card pinned
       to the pane covers them whenever the pane is short. */
    const pane = originCard.parentElement, frame = dscroll;
    if (pane && frame) {
      const gap = pane.getBoundingClientRect().bottom - frame.getBoundingClientRect().bottom;
      originCard.style.bottom = Math.max(12, Math.round(gap) + 12) + "px";
    }
    soloOverlay("origin");
    originCard.hidden = false;
  });

  foldBtn.onclick = () => applyFold(foldKeep > 0 ? 0 : 1, true);
  foldOpts.forEach((b, k) => { b.onclick = () => applyFold(k + 1, true); });
  foldPill.onclick = () => applyFold(0, true);
  diagram.setFold(foldKeep);
  diagram.onRender(onDiagramRender);

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
    capText.textContent = text;
    /* styles.css lays the caption over the drawing, out of the flow: as a
       flex row it took height from the drawing, which refit smaller
       mid-replay and back 7s later. It sits on the drawing's bottom edge, as
       the origin card does, so the key, scrubber and control bar stay clear. */
    const gap = dpane.getBoundingClientRect().bottom - dscroll.getBoundingClientRect().bottom;
    caption.style.bottom = Math.max(12, Math.round(gap) + 12) + "px";
    soloOverlay("caption");
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
    else { setFace(playBtn, "stop", COPY.pulseStop); playBtn.classList.add("on"); hud.hidden = false; }
  };

  // gates are opt-in: on only if this breakdown enabled them, or the user set the default on
  const challengeOn = rec.challengeMode != null ? rec.challengeMode : meta.challengeModeDefault === true;

  /* mount() renders at once, and every render reports its place. Until this
     reader has pushed its own history entry, that report would rewrite the
     previous screen's entry (the parent study on a drill, or Practice,
     Models, Vocabulary), and Back skipped it. */
  let routed = false;
  currentView = DocView.mount({
    docPane, diagram, rec, scrubEl,
    audience: meta.audienceMode || "enthusiast",
    challenge: challengeOn,
    onePage: meta.onePage === true,
    canReplay: diagram.sim.available,
    autoReplay: meta.autoReplay !== false,
    onReplay: runReplay,
    onNavigate({ position, step }) {
      if (routed && document.body.dataset.screen === "reader") syncRoute("replace");
      // the four steps are explained on the second, where the guess is asked for
      if (position >= 1 && position <= rec.doc.layers.length && step >= 2) featureTips.trigger("steps");
    },
    onSheetClose() { featureTips.trigger("ctx"); },
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
  show("reader", { noRoute: true });
  if (!opts.noRoute) syncRoute("push");   // the reader takes its own entry first
  routed = true;
  // so the replace a jump makes lands on the reader's entry
  if (layerIndex != null) currentView.goToLayer(layerIndex);
  else if (Array.isArray(opts.posStep)) currentView.goToPosStep(opts.posStep[0], opts.posStep[1]);
  setTimeout(() => { if (currentRec === rec) featureTips.visit("reader"); }, 750);
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
  activeVocabId = focusId || null;
  // read first, as renderLibrary: overlapping calls cannot interleave
  const recs = await Store.getBreakdowns().catch(() => []);
  const root = $("screen-vocab").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "The engineering vocabulary"));
  root.appendChild(h("h1", "title", "What engineers call it"));
  root.appendChild(h("p", "subtitle", "Patterns are problem shapes, concepts are mechanisms, technologies are things you deploy. Every entry links back to the timeless thinking model underneath it, and to the layers where you watched it become necessary."));

  // where each id appears across the reader's library
  const uses = {};
  try {
    recs.forEach(b => {
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
  } catch (e) { recur.appendChild(h("p", "vo-none", COPY.readFail)); }
}

/* Pulse as GIF records for a couple of seconds after its menu entry is gone,
   so the guard against starting a second recording lives out here. */
let gifRecording = false;
function buildReaderMenu(rec, challengeOn) {
  const pop = $("menuPop");
  pop.textContent = "";
  /* One home per kind of thing: how to read it, where it can go, help, and
     the one destructive act set apart at the bottom. Each group is named for
     a screen reader by the same heading a sighted reader scans. */
  const group = title => {
    const g = h("div", "menu-group");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", title);
    const head = h("div", "menu-head", title);
    head.setAttribute("aria-hidden", "true");
    g.appendChild(head);
    pop.appendChild(g);
    return g;
  };
  const add = (to, label, fn, cls) => {
    const b = h("button", cls || "", label);
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    to.appendChild(b);
    return b;
  };
  const check = (to, label, on, fn) => {
    const b = h("button", "menu-check" + (on ? " on" : ""), label);
    b.setAttribute("role", "menuitemcheckbox");
    b.setAttribute("aria-checked", String(!!on));
    b.onclick = e => { e.stopPropagation(); pop.hidden = true; fn(); };
    to.appendChild(b);
  };
  /* On a phone the topbar cannot hold the contextual tools as well as the
     brand, the audience switch and this menu: they overflow their own
     container and land on top of the audience switch. CSS hides them there
     and shows these entries instead, which click the very same buttons, so
     there is one handler per tool rather than two that can drift apart.
     They lead the menu because on a phone they are the topbar. */
  // Gate on the button existing, not on it being visible: this menu is built
  // when the reader opens, which is before the topbar reveals those buttons,
  // so a `hidden` check here silently produced no entries at all.
  const compact = [["sheetBtn", COPY.menuSheet], ["graftBtn", COPY.menuGraft]]
    .filter(([id]) => !!$(id));
  if (compact.length) {
    compact.forEach(([id, label]) => add(pop, label, () => $(id).click(), "menu-compact"));
    pop.appendChild(h("div", "menu-sep menu-compact"));
  }

  const reading = group(COPY.menuReading);
  check(reading, COPY.menuStrict, challengeOn, () => {
    rec.challengeMode = !challengeOn;
    Store.saveBreakdownLight(rec);
    if (currentView) currentView.setChallenge(rec.challengeMode);
    buildReaderMenu(rec, rec.challengeMode);
    toast(rec.challengeMode ? "Strict mode on. The fix opens once you've sketched yours." : "Strict mode off");
  });
  check(reading, COPY.menuOnePage, meta.onePage === true, async () => {
    meta.onePage = !(meta.onePage === true);
    await Store.saveMeta({ onePage: meta.onePage });
    if (currentView) currentView.setOnePage(meta.onePage);
    buildReaderMenu(rec, challengeOn);
  });

  pop.appendChild(h("div", "menu-sep"));
  const out = group(COPY.menuShare);
  add(out, COPY.shareMenu, async () => {
    let url = "";
    let msg = COPY.shareCopied;
    if (rec.source === "flagship") {
      /* the sample's own share page, not the bare #/study link: unfurlers
         never see a #fragment, so that one previewed as the generic site
         card. The page carries the study's title and image and redirects to
         the same #/study route. tools/validate.js keeps one per sample. */
      url = CONFIG.siteUrl + "share/" + encodeURIComponent(studySlug(rec)) + ".html";
    } else {
      try {
        const token = await encodeSharePayload(rec.doc);
        url = CONFIG.siteUrl + "#/import/" + token;
        msg = "Portable share link copied (works offline, no server)";
      } catch (err) {
        toast(COPY.shareLocalNote);
        return;
      }
    }
    try { await navigator.clipboard.writeText(url); toast(msg); }
    catch (e) { prompt("Copy this link:", url); }
  });
  add(out, COPY.exportPngMenu, () => exportDiagramPNG(rec));
  /* Pulse is off under reduced motion, so there is nothing to record and
     the entry is left out rather than offered and refused. */
  if (currentDiagram && currentDiagram.sim.available) {
    add(out, COPY.menuGif, async () => {
      if (gifRecording || !currentDiagram) return;
      gifRecording = true;
      toast(COPY.menuGifBusy);
      try { await exportPulseGIF(currentDiagram); }
      finally { gifRecording = false; }
    });
  }
  add(out, COPY.menuJson, () => {
    download(rec.system.replace(/\W+/g, "-").toLowerCase() + ".json", JSON.stringify(rec.doc, null, 2));
  });
  add(out, COPY.menuNotes, async () => {
    try {
      await navigator.clipboard.writeText(bridgeNotes(rec.doc));
      toast(COPY.bridgeToast);
    } catch (e) { alert("Clipboard unavailable. Export the .json instead."); }
  }).title = COPY.menuNotesHint;

  pop.appendChild(h("div", "menu-sep"));
  add(pop, COPY.menuGuide, () => { renderTutorial("reader"); show("tutorial"); });

  /* Only the reader's own Deconstructs can be deleted. A sample deleted here
     lost its progress and came back with the next content update
     (seedFlagships), so the entry promised something it could not keep. */
  if (rec.source !== "flagship") {
    pop.appendChild(h("div", "menu-sep"));
    add(pop, COPY.menuDelete, async () => {
      if (!confirm(`Delete "${rec.system}" and its attempts? This cannot be undone.`)) return;
      await Store.deleteBreakdown(rec.id);
      await renderLibrary();
      show("library");
    }, "danger");
  }
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
      const wp = setFace(h("button", "gbtn sim-btn sim-primary"), "play", COPY.pulse);
      const wl = setFace(h("button", "gbtn sim-btn"), "gauge", "Load");
      wl.hidden = true;
      dg.sim.onStop(() => { setFace(wp, "play", COPY.pulse); wp.classList.remove("on"); wl.hidden = true; wl.classList.remove("on"); });
      wp.onclick = () => {
        if (dg.sim.running) dg.sim.stop();
        else if (dg.sim.start()) { setFace(wp, "stop", COPY.pulseStop); wp.classList.add("on"); wl.hidden = false; }
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

/* The Opus 5.5 bands at the bottom are the measured ones. The rest scale them
   by each family's price per token against Opus 5.5's $4/$20 per MTok:
   Fable and Mythos 2.5x, the $5/$25 Opus ids 1.25x, Sonnet 5 and 5.5 half,
   Haiku 4.5 a quarter, Haiku 5.5 a fortieth. A validation repair resends the
   prompt and the first answer and can roughly double a run; it is rare, and
   left out. */
function modelCostEstimate(modelId, speed, voiceOn) {
  const m = String(modelId || CONFIG.defaultModel || "").toLowerCase();
  const fast = speed === "fast";
  const speedTag = fast ? "Fast" : "Balanced";
  const voiceTag = voiceOn ? " + voice pass" : "";
  if (/fable|mythos/.test(m)) {
    return fast ? `${speedTag}${voiceTag} · ~45–90s · typically $0.55–$0.95 on your key`
                : `${speedTag}${voiceTag} · ~60–150s · typically $0.80–$1.40 on your key`;
  }
  if (m.includes("sonnet")) {
    return `${speedTag}${voiceTag} · ~25–45s · typically ${fast ? "$0.11–$0.19" : "$0.16–$0.28"} on your key`;
  }
  if (/haiku-5/.test(m)) {
    return `${speedTag}${voiceTag} · ~15–25s · typically under $0.02 on your key`;
  }
  if (m.includes("haiku")) {
    return `${speedTag}${voiceTag} · ~15–25s · typically $0.08–$0.14 on your key`;
  }
  if (/opus-5(?!-5)|opus-4-[5-8]/.test(m)) {
    return fast ? `${speedTag}${voiceTag} · ~30–50s · typically $0.28–$0.48 on your key`
                : `${speedTag}${voiceTag} · ~45–80s · typically $0.40–$0.70 on your key`;
  }
  if (fast) {
    return `${speedTag}${voiceTag} · ~30–50s · typically $0.22–$0.38 on your key`;
  }
  return `${speedTag}${voiceTag} · ~45–80s · typically $0.32–$0.55 on your key`;
}

/* ═══ Generation screen (§8, §11.3) ═══ */
function renderGenerate(systemName, mode) {
  const design = mode === "design";
  const root = $("screen-generate").firstElementChild;
  /* A run still going (or failed unseen) keeps its form: clearing it lost
     the progress, and later the error and the raw-output download, for good.
     It is set aside for the pill's View to put back. */
  if (activeGen && !activeGen.readyRec && genFormOwner === activeGen.controller) {
    genRunView = { controller: activeGen.controller, nodes: Array.from(root.childNodes) };
  }
  genFormOwner = null;
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
  const activeModel = meta.modelId || CONFIG.defaultModel;
  const est = modelCostEstimate(activeModel, meta.genSpeed || "balanced", meta.voicePass !== false);
  root.appendChild(h("p", "lib-note", `Model: ${activeModel} · ${est}`));

  const startBtn = h("button", "big-btn", design ? COPY.ownDesignBtn : "Generate");   // the time is in the estimate line above
  root.appendChild(startBtn);
  const prog = h("div", "gen-progress");
  root.appendChild(prog);

  startBtn.onclick = async () => {
    let subject = systemName;
    if (design) {
      if (dq.what.value.trim().length < 12) { dq.what.focus(); toast("Say a little more about what it does"); return; }
      subject = COPY.dissectQuestions.map(([id, label]) => dq[id].value.trim() ? label + "\n" + dq[id].value.trim() : "").filter(Boolean).join("\n\n");
    }
    /* One run at a time. Starting from another form used to cancel the one
       in flight without a word, after its tokens were billed. */
    if (genInFlight()) {
      if (!confirm(`"${activeGen.systemName}" is still being built. Cancel it and start this one?`)) return;
      try { activeGen.controller.abort(); } catch (e) {}
    }
    const controller = new AbortController();
    const displaySubject = design ? (dq.what.value.trim().split(/[\n.]/)[0].slice(0, 42) || "Design review") : systemName;
    genFormOwner = controller;
    activeGen = { controller, systemName: displaySubject, phaseText: COPY.genPhases.start, readyRec: null };
    syncGenBgPill();
    window.addEventListener("beforeunload", guardUnload);   // a desktop backstop; iOS standalone ignores it

    startBtn.disabled = true;
    if (dq) Object.values(dq).forEach(t => t.disabled = true);
    if (focus) focus.disabled = true;
    prog.textContent = "";
    const headRow = h("div", "gen-head-row");
    const phaseEl = h("div", "gen-phase", COPY.genPhases.start);
    const cancelBtn = h("button", "gbtn ghost gen-cancel-btn", "Cancel");
    cancelBtn.type = "button";
    cancelBtn.onclick = () => controller.abort();
    headRow.append(phaseEl, cancelBtn);
    const barEl = h("div", "gen-bar");
    const fill = h("div");
    barEl.appendChild(fill);
    const tok = h("div", "gen-tokens", "You can browse other systems while this runs.");
    prog.append(headRow, barEl, tok);
    const early = earlyMeet((idx, name) => {
      const layerLabel = `Layer ${idx} · ${name}`;
      phaseEl.textContent = `Building ${layerLabel}…`;
      if (activeGen && activeGen.controller === controller) {
        activeGen.phaseText = layerLabel;
        syncGenBgPill();
      }
      const layerPct = Math.min(76, 42 + idx * 5);
      fill.style.width = layerPct + "%";
    });
    prog.appendChild(early.el);

    const PHASE_PCT = { start: 4, strip_down: 18, visual: 30, layers: 42, stress: 78, transfer: 88, repair: 92, voice: 96 };
    try {
      const { doc, repaired, voice } = await Generator.generate({
        apiKey: meta.apiKey, modelId: meta.modelId, voice: meta.voicePass !== false,
        system: subject, focus: focus ? focus.value.trim() : "", mode,
        speed: meta.genSpeed || "balanced",
        signal: controller.signal,
        onProgress(p) {
          if (p.phase) {
            const label = p.phase === "repair" ? "Repairing validation errors…" : (COPY.genPhases[p.phase] || phaseEl.textContent);
            phaseEl.textContent = label;
            fill.style.width = (PHASE_PCT[p.phase] || 0) + "%";
            if (activeGen && activeGen.controller === controller) {
              activeGen.phaseText = label;
              syncGenBgPill();
            }
          }
          if (p.tokens) tok.textContent = "~" + p.tokens.toLocaleString() + " tokens · " + COPY.genBrowse;
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
      else if (voice && voice.cancelled) toast("Saved without the voice edit");   // cancelled late: the document was already whole
      else if (voice && voice.fixed) toast(`Edited ${voice.fixed} passage${voice.fixed > 1 ? "s" : ""} for voice`);
      // open it only over its own form; any other form is the reader's work in progress
      if (document.body.dataset.screen === "generate" && genFormOwner === controller) {
        activeGen = null;
        syncGenBgPill();
        openReader(rec.id);
      } else {
        if (activeGen && activeGen.controller === controller) {
          activeGen.readyRec = rec;
          syncGenBgPill();
        }
        if (document.body.dataset.screen === "library") await renderLibrary();
      }
    } catch (e) {
      const titles = {
        key: "Invalid API key", rate: "Rate limited", overloaded: "Anthropic is overloaded",
        offline: "You're offline", toobig: "Too large", invalid: "The model returned an invalid document",
        http: "API error", refusal: "The model declined"
      };
      if (activeGen && activeGen.controller === controller) {
        /* A failure the reader is not looking at used to vanish with the
           pill, and its Retry and raw-output download with it. It stays on
           the pill until they View it or dismiss it. */
        if (e.kind !== "aborted" && !(document.body.dataset.screen === "generate" && genFormOwner === controller)) {
          activeGen.error = titles[e.kind] || "Generation failed";
        } else {
          activeGen = null;
        }
        syncGenBgPill();
      }
      prog.textContent = "";
      if (e.kind === "aborted") {
        prog.appendChild(h("p", "lib-note", "Generation cancelled. No further tokens will be billed."));
        /* a cancel during the repair pass still holds the first response,
           which was paid for; keep it downloadable */
        if (e.raw) {
          const b = h("button", "gbtn", "Download raw output");
          b.onclick = () => download("raw-deconstruct.txt", e.raw);
          prog.appendChild(b);
        }
        startBtn.disabled = false;
        if (focus) focus.disabled = false;
        if (dq) Object.values(dq).forEach(t => t.disabled = false);
        return;
      }
      const box = h("div", "gen-error");
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
    } finally {
      // a run cancelled for a newer one settles while that one still streams
      if (!genInFlight()) {
        window.removeEventListener("beforeunload", guardUnload);
        window.dispatchEvent(new Event("sdc:gensettled"));
      }
    }
  };
}

/* While a Deconstruct streams in, the essence, rules, and layer titles arrive
   in order. Show them as soon as each string is complete so there's something
   substantive to read during the wait. */
function earlyMeet(onLayer) {
  const el = h("section", "early-meet");
  el.hidden = true;
  const ess = h("p", "early-essence");
  const rulesSub = h("div", "early-sub", "The rules it lives by");
  const rules = h("ol", "early-rules");
  const layersSub = h("div", "early-sub", "The failure ladder taking shape");
  const layersOl = h("ol", "early-layers");
  rulesSub.hidden = true;
  rules.hidden = true;
  layersSub.hidden = true;
  layersOl.hidden = true;
  el.append(
    h("div", "step-kick tone-ink", "Meet the system, while the rest is written"),
    ess, rulesSub, rules, layersSub, layersOl
  );
  let shownRules = 0, shownLayers = 0;
  const STR = '"((?:[^"\\\\]|\\\\.)*)"';
  const dec = x => { try { return JSON.parse('"' + x + '"'); } catch (e) { return x; } };
  function update(text) {
    if (!ess.textContent) {
      const m = new RegExp('"essence"\\s*:\\s*\\{\\s*"text"\\s*:\\s*' + STR).exec(text);
      if (m) { ess.textContent = dec(m[1]); el.hidden = false; }
    }
    const at = text.indexOf('"invariants"');
    if (at >= 0) {
      const end = text.indexOf('"entities"', at);
      const chunk = text.slice(at, end < 0 ? undefined : end);
      const re = new RegExp('"text"\\s*:\\s*' + STR, "g");
      const found = [];
      let m;
      while ((m = re.exec(chunk))) found.push(dec(m[1]));
      for (; shownRules < found.length; shownRules++) {
        rules.appendChild(h("li", null, found[shownRules]));
        rulesSub.hidden = false;
        rules.hidden = false;
        el.hidden = false;
      }
    }
    const lAt = text.indexOf('"layers"');
    if (lAt >= 0) {
      const lEnd = text.indexOf('"stress_tests"', lAt);
      const lChunk = text.slice(lAt, lEnd < 0 ? undefined : lEnd);
      const lRe = new RegExp('"index"\\s*:\\s*(\\d+)\\s*,\\s*"name"\\s*:\\s*' + STR, "g");
      const lFound = [];
      let lm;
      while ((lm = lRe.exec(lChunk))) {
        lFound.push({ idx: parseInt(lm[1], 10), name: dec(lm[2]) });
      }
      for (; shownLayers < lFound.length; shownLayers++) {
        const item = lFound[shownLayers];
        const li = h("li", null);
        li.append(h("span", "early-layer-n", `Layer ${item.idx}`), document.createTextNode(" · " + item.name));
        layersOl.appendChild(li);
        layersSub.hidden = false;
        layersOl.hidden = false;
        el.hidden = false;
        if (onLayer) onLayer(item.idx, item.name);
      }
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
/* The screen is its own scroll box and kept its offset across the swap, so a
   model opened from low in the list landed mid-page with its title far above.
   A model opens at its top; "All models" returns to where the list was.
   Instant, because .screen scrolls smoothly. */
let modelsIndexScroll = 0;
async function renderModels(detailId) {
  // a bookmark to a model since renamed opens the index, not a blank screen
  if (detailId && !MODEL_LIBRARY.some(x => x.id === detailId)) detailId = undefined;
  const scr = $("screen-models");
  const showing = !scr.hidden;
  const fromDetail = showing && !!activeModelId;
  if (detailId && !fromDetail) modelsIndexScroll = showing ? scr.scrollTop : 0;
  activeModelId = detailId || null;
  const recs = await Store.getBreakdowns();   // read first, as renderLibrary: overlapping calls cannot interleave
  const root = scr.firstElementChild;
  root.textContent = "";
  if (detailId) {
    renderModel(root, recs, detailId);
    scr.scrollTo({ top: 0, behavior: "instant" });
    if (document.body.dataset.screen === "models" && !suppressRoute) syncRoute("push");
    return;
  }

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
    card.appendChild(h("div", "ml-count", systems ? `In ${systems} system${systems > 1 ? "s" : ""}` + (read ? ` · you've read ${read}` : "") : COPY.modelNotYet));
    card.onclick = () => renderModels(m.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);
  scr.scrollTo({ top: fromDetail ? modelsIndexScroll : 0, behavior: "instant" });
  if (document.body.dataset.screen === "models" && !suppressRoute) syncRoute("push");
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
  main.appendChild(h("p", "lib-note", COPY.modelUsedBy(systems, read.length)));
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
  const recs = await Store.getBreakdowns();   // read first, as renderLibrary: overlapping calls cannot interleave
  const root = $("screen-drill").firstElementChild;
  root.textContent = "";
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

/* drafts: { key, model }, the two text fields as typed, when this screen
   re-renders itself (see refresh below) */
function renderSettings(banner, drafts) {
  const root = $("screen-settings").firstElementChild;
  root.textContent = "";
  root.appendChild(h("div", "kicker", "Settings"));
  root.appendChild(h("h1", "title", "How you learn"));

  /* About / how it works → landing + tutorial */
  const ab = h("div", "set-block");
  ab.appendChild(h("h3", null, "About & field guide"));
  ab.appendChild(h("p", "note", "What Vitruvian is and how to read a Deconstruct: the cards, the diagram, the developer lens."));
  const abRow = h("div", "set-row");
  const abBtn = h("button", "gbtn primary", "Open the intro →");
  abBtn.onclick = () => { renderLanding(); show("landing"); };
  const tutBtn = h("button", "gbtn", "Field guide →");
  tutBtn.onclick = () => { renderTutorial("settings"); show("tutorial"); };
  abRow.append(abBtn, tutBtn);
  ab.appendChild(abRow);

  /* API key */
  const kb = h("div", "set-block");
  const kh = h("h3", null, "Anthropic API key");
  kh.id = "set-key-h";   // names the field below for screen readers
  kb.appendChild(kh);
  /* Every banner asks for the key, so it sits with the key. Under the title
     it was several blocks above the field, and the screen kept its old
     scroll, so a reader sent here to add a key often saw neither. */
  if (banner) kb.appendChild(h("div", "narrowing-note", banner));
  kb.appendChild(h("p", "note", COPY.keyNotice));
  const key = h("input");
  key.type = "password";
  key.placeholder = "sk-ant-…";
  key.setAttribute("aria-labelledby", "set-key-h");
  key.value = drafts ? drafts.key : (meta.apiKey || "");
  // callers show() the screen right after; a hidden screen cannot scroll.
  // Not on a re-render from a control lower down: it would yank the page here.
  if (banner && !drafts) requestAnimationFrame(() => {
    if ($("screen-settings").hidden || !kb.isConnected) return;
    kb.scrollIntoView({ block: "start" });
    key.focus({ preventScroll: true });
  });
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
  const mh = h("h3", null, "Model");
  mh.id = "set-model-h";
  mb.appendChild(mh);
  mb.appendChild(h("p", "note", "Any Anthropic model id; new models need no app update."));
  mb.appendChild(h("p", "note", COPY.modelCostNote));
  const mi = h("input");
  mi.type = "text";
  mi.setAttribute("aria-labelledby", "set-model-h");
  mi.value = drafts ? drafts.model : (meta.modelId || CONFIG.defaultModel);
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

  /* Every control below re-renders the screen. A key pasted but not yet
     saved, a model id mid-edit and the add-your-key banner lived only in the
     DOM, so a toggle flipped before "Save key" wiped them. They carry across;
     the banner only while no key is saved. */
  const refresh = () => renderSettings(meta.apiKey ? undefined : banner, { key: key.value, model: mi.value });

  /* how you learn: everything that changes what reading feels like */
  const toggle = (on, label, flip) => {
    const t = h("div", "toggle" + (on ? " on" : ""));
    t.setAttribute("role", "switch");
    t.setAttribute("aria-checked", String(!!on));
    t.tabIndex = 0;
    t.append(h("span", "tg-track"), h("span", "tg-label", label));
    t.onclick = async () => { await flip(); refresh(); };
    t.onkeydown = async e => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        await flip();
        refresh();
      }
    };
    return t;
  };
  const db = h("div", "set-block");
  db.appendChild(h("h3", null, "Reading level"));
  db.appendChild(h("p", "note", "How much each layer explains. You can switch it any time from the reader too."));
  const seg = h("div", "seg");
  COPY.audienceModes.forEach(m => {
    const b = h("button", meta.audienceMode === m.id ? "on" : "", m.label);
    b.setAttribute("aria-pressed", String(meta.audienceMode === m.id));
    b.onclick = async () => {
      meta.audienceMode = m.id;
      await Store.saveMeta({ audienceMode: m.id });
      renderAudSwitch();
      refresh();
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

  /* feature tips — on by default, and a way back to the ones already spent */
  const tb = h("div", "set-block set-tips");
  tb.appendChild(h("h3", null, "Tips"));
  tb.appendChild(h("p", "note", "A short card the first time you reach each part of the app, once each. They never repeat on their own."));
  tb.appendChild(toggle(featureTips.enabled, "Explain each feature the first time I reach it",
    () => featureTips.setEnabled(!featureTips.enabled)));
  const tagain = h("button", "gbtn", "Show them all again");
  tagain.onclick = async () => {
    await featureTips.reset();
    if (!featureTips.enabled) await featureTips.setEnabled(true);
    refresh();
    toast("Tips reset. They start again as you move through the app.");
  };
  const tleft = h("p", "note");
  tleft.textContent = featureTips.enabled
    ? `${featureTips.remaining()} of ${(COPY.tips || []).length} still to come.`
    : "Tips are off.";
  tb.append(tagain, tleft);

  /* generation speed */
  const gs = h("div", "set-block");
  gs.appendChild(h("h3", null, "Generation"));
  gs.appendChild(h("p", "note", "Balanced lets the model reason longer before writing, for better structure. Fast trims thinking for quicker, cheaper runs."));
  const gseg = h("div", "seg");
  [["balanced", "Balanced"], ["fast", "Fast"]].forEach(([id, label]) => {
    const b = h("button", (meta.genSpeed || "balanced") === id ? "on" : "", label);
    b.setAttribute("aria-pressed", String((meta.genSpeed || "balanced") === id));
    b.onclick = async () => {
      meta.genSpeed = id;
      await Store.saveMeta({ genSpeed: id });
      refresh();
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
  bb.appendChild(h("p", "note", COPY.backupNote));
  const brow = h("div", "set-row");
  const bexp = h("button", "gbtn primary", "Backup .json");
  bexp.onclick = async () => {
    const state = await Store.exportAll();
    download("vitruvian-backup.json", JSON.stringify(state, null, 2));
    meta.lastBackup = Date.now();
    await Store.saveMeta({ lastBackup: meta.lastBackup });
    toast("Backup downloaded");
  };
  const bres = h("button", "gbtn", "Restore .json");
  bres.onclick = () => pickFile(async file => {
    try {
      const state = JSON.parse(await file.text());
      if (!confirm(COPY.restoreConfirm)) return;
      const results = await Store.importAll(state);
      const bad = results.filter(r => !r.ok);
      meta = await Store.getMeta();
      applyTheme(meta.theme || document.documentElement.dataset.theme);   // a restored backup may carry a different theme
      renderAudSwitch();
      toast(`Restored ${results.length - bad.length}/${results.length} Deconstructs`);
      if (bad.length) alert("Skipped invalid entries:\n" + bad.slice(0, 8).map(r => `${safeLine(r.system || r.id, 40)}: ${safeLine(r.errors[0], 60)}`).join("\n"));
      renderSettings();
    } catch (e) { alert("Restore failed: " + safeLine(e.message, 120)); }
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
  group(null, null, db, lb, tb);
  group("Deconstructing your own systems", "Generating a Deconstruct calls Anthropic with your key. Everything else works offline.", kb, mb, gs);
  group("Your data", null, bb);
  group("About", null, ab);

  root.appendChild(h("p", "fine", COPY.privacyNote));
  root.appendChild(h("p", "fine", `${CONFIG.toolName.replace("·", "·")} v${CONFIG.appVersion} · ${COPY.offlineGenNote}`));
}

/* ═══ Launcher shortcut routing (pwa.js calls these) ═══ */
/* Both render Home before showing it: on a first launch boot drew only the
   landing, so a shortcut opened an empty Home with nothing to type into. */
async function launchNew() {
  await renderLibrary();
  show("library");
  const i = $("deconInput");
  if (i) i.focus();
}
async function launchResume() {
  if (meta.lastOpenBreakdown) {
    const rec = await Store.getBreakdown(meta.lastOpenBreakdown);
    if (rec) { openReader(rec.id); return; }
  }
  await renderLibrary();
  show("library");
}

boot();
