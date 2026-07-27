/* ═══════════════════════════════════════════════════════════════
   THE GEAR CHANGE — page
   ───────────────────────────────────────────────────────────────
   Builds the walkthrough, the HUD, and the H-gate. No prose here
   (see transmission-copy.js) and no geometry (see the scene).
   Everything is createElement/textContent — never innerHTML.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var DEBUG = /(^|[?&])debug=1/.test(location.search);
  var C = TX_COPY, L = TXScene.LAYERS;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function $(id) { return document.getElementById(id); }

  var canvas = $("stage");
  var ctl = TXScene.create(canvas);
  var RM = ctl.scene.reducedMotion;
  if (DEBUG) window.__tx = ctl;
  var layerIndex = 0;
  var live = $("live");
  var els = {};

  /* ═══ theme ═══
     Session-only: the app keeps the real preference in IndexedDB and
     mirrors it to localStorage for its own splash. Writing it here
     would desync that mirror, so the lab just flips the attribute. */
  function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
  function paintThemeBtn() {
    var b = $("themeBtn"), dark = currentTheme() === "dark";
    b.textContent = dark ? "☀" : "☾";
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  $("themeBtn").addEventListener("click", function () {
    document.documentElement.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
    paintThemeBtn();
    ctl.scene.readTokens();
  });
  paintThemeBtn();

  /* ═══ HUD ═══ */
  function buildHud(root) {
    var hud = h("div", "hud");

    var gearBox = h("div", "hud-gear");
    els.gear = h("div", "hud-gear-n", "4");
    gearBox.appendChild(els.gear);
    gearBox.appendChild(h("div", "mono-label", C.hud.gear));
    hud.appendChild(gearBox);

    var meters = h("div", "hud-meters");
    var row = h("div", "hud-row");
    row.appendChild(h("span", "mono-label", C.hud.engine));
    els.rpm = h("span", "hud-num", "0");
    row.appendChild(els.rpm);
    meters.appendChild(row);

    var bar = h("div", "hud-bar");
    els.barFill = h("div", "hud-bar-fill");
    els.barTarget = h("div", "hud-bar-target");
    bar.appendChild(els.barFill);
    bar.appendChild(els.barTarget);
    meters.appendChild(bar);

    var row2 = h("div", "hud-row");
    row2.appendChild(h("span", "mono-label", C.hud.delta));
    els.delta = h("span", "hud-num", "0");
    row2.appendChild(els.delta);
    meters.appendChild(row2);
    hud.appendChild(meters);

    var clutch = h("div", "hud-clutch");
    clutch.appendChild(h("div", "mono-label", C.hud.clutch));
    var ct = h("div", "hud-pedal");
    els.pedal = h("div", "hud-pedal-fill");
    ct.appendChild(els.pedal);
    clutch.appendChild(ct);
    hud.appendChild(clutch);

    root.appendChild(hud);
  }

  function paintHud() {
    var S = ctl.state;
    els.gear.textContent = C.gearNames[S.gear] || "N";
    els.rpm.textContent = Math.round(S.engineRpm) + " rpm";
    var pct = Math.max(0, Math.min(100, S.engineRpm / 6000 * 100));
    els.barFill.style.width = pct + "%";
    var tgt = (S.to && ctl.ratios[S.to]) ? Math.abs(S.roadRpm * ctl.ratios[S.to]) : S.engineRpm;
    els.barTarget.style.left = Math.max(0, Math.min(100, tgt / 6000 * 100)) + "%";
    var d = Math.round(S.delta);
    els.delta.textContent = d + " rpm";
    els.delta.classList.toggle("matched", d < 60);
    els.pedal.style.height = Math.round(S.clutch * 100) + "%";
  }

  /* ═══ H-gate ═══ */
  var GATE_X = [18, 48, 78], GATE_Y = { 1: 14, 0: 42, "-1": 70 };
  var SLOTS = [
    [1, 0, 0], [3, 1, 0], [5, 2, 0],
    [0, 1, 1],
    [2, 0, 2], [4, 1, 2], [-1, 2, 2]
  ];

  function buildGate(root) {
    var wrap = h("div", "gate-wrap");
    var s = svg("svg", { viewBox: "0 0 96 84", "aria-hidden": "true", "class": "gate-svg" });
    s.appendChild(svg("path", {
      "class": "gate-slot",
      d: "M18 14 L18 42 L78 42 L78 14 M48 14 L48 70 M18 42 L18 70 M78 42 L78 70"
    }));
    GATE_X.forEach(function (x) {
      [14, 70].forEach(function (y) { s.appendChild(svg("circle", { "class": "gate-dot", cx: x, cy: y, r: 3.4 })); });
    });
    els.knob = svg("circle", { "class": "gate-knob", cx: 48, cy: 42, r: 7 });
    s.appendChild(els.knob);
    wrap.appendChild(s);

    var grid = h("div", "gate-grid");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", C.a11y.gate);
    els.gateBtns = {};
    SLOTS.forEach(function (sl) {
      var b = h("button", "gate-btn", C.gearNames[sl[0]]);
      b.style.gridColumn = (sl[1] + 1) + "";
      b.style.gridRow = (sl[2] + 1) + "";
      b.setAttribute("aria-label", sl[0] === 0 ? "Neutral" : sl[0] === -1 ? "Reverse" : "Gear " + sl[0]);
      b.addEventListener("click", function () { requestShift(sl[0]); });
      els.gateBtns[sl[0]] = b;
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wrap.appendChild(h("div", "mono-label gate-cap", "Gate"));
    root.appendChild(wrap);
  }

  function paintGate() {
    var S = ctl.state;
    els.knob.setAttribute("cx", (18 + S.leverRail * 30).toFixed(1));
    els.knob.setAttribute("cy", (42 - S.leverRow * 28).toFixed(1));
    var k;
    for (k in els.gateBtns) els.gateBtns[k].classList.toggle("on", String(S.gear) === k);
  }

  function requestShift(g) {
    var cfg = L[layerIndex];
    if (!cfg.free) return;
    if (g === ctl.state.gear) return;
    if (ctl.beginShift(g)) {
      els.play.textContent = C.controls.pause;
      if (RM) els.scrub.value = "0";
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && e.key.length === 1) return;
    var m = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, r: -1, R: -1, n: 0, N: 0 };
    if (m[e.key] !== undefined) { requestShift(m[e.key]); e.preventDefault(); }
  });

  /* ═══ stage controls ═══
     A toggle reads its own next state off aria-pressed, so anything that
     changes the scene behind its back has to say so here — otherwise the
     button stays lit over state that was quietly reset, and the next click
     is a no-op. */
  function setToggle(b, on) {
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("on", on);
  }

  function buildStageControls(root) {
    var bar = h("div", "stage-ctrls");

    function toggle(label, fn) {
      var b = h("button", "st-btn", label);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        setToggle(b, on);
        fn(on);
      });
      return b;
    }
    els.expBtn = toggle(C.controls.explode, function (on) { ctl.setExplode(on ? 1 : 0); });
    bar.appendChild(els.expBtn);
    els.cutBtn = toggle(C.controls.cutaway, function (on) { ctl.setCutaway(on); });
    bar.appendChild(els.cutBtn);
    els.oldBtn = toggle(C.controls.oldMode, function (on) { ctl.setMode(on ? "1930" : "modern"); });
    bar.appendChild(els.oldBtn);

    var reset = h("button", "st-btn", C.controls.reset);
    reset.addEventListener("click", function () { ctl.resetCamera(); });
    bar.appendChild(reset);
    root.appendChild(bar);
  }

  /* ═══ walkthrough ═══ */
  function buildDoc(root) {
    root.appendChild(h("div", "kicker", C.kicker));
    root.appendChild(h("h1", "title", C.title));
    root.appendChild(h("p", "subtitle", C.subtitle));
    root.appendChild(h("p", "lab-intro", C.intro));

    var st = h("div", "stepper");
    els.prev = h("button", "step-btn", "‹ Prev");
    els.prev.addEventListener("click", function () { goto(layerIndex - 1); });
    st.appendChild(els.prev);
    var rail = h("div", "step-rail");
    els.dots = L.map(function (cfg, i) {
      var d = h("button", "step-dot", String(i));
      d.setAttribute("aria-label", "Layer " + i + ": " + C.layers[i].name);
      d.addEventListener("click", function () { goto(i); });
      rail.appendChild(d);
      return d;
    });
    st.appendChild(rail);
    els.next = h("button", "step-btn", "Next ›");
    els.next.addEventListener("click", function () { goto(layerIndex + 1); });
    st.appendChild(els.next);
    root.appendChild(st);

    els.card = h("div", "layer-card");
    root.appendChild(els.card);
    root.appendChild(h("p", "fine lab-footer", C.footer));
  }

  function band(cls, label, text) {
    var b = h("div", "lc-band " + cls);
    b.appendChild(h("div", "mono-label", label));
    b.appendChild(h("p", null, text));
    return b;
  }

  function renderCard() {
    var t = C.layers[layerIndex], cfg = L[layerIndex], card = els.card;
    card.textContent = "";

    var head = h("div", "lc-head");
    head.appendChild(h("span", "layer-num", "Layer " + layerIndex));
    head.appendChild(h("span", "chip", t.era));
    card.appendChild(head);
    card.appendChild(h("h2", "lc-name", t.name));

    var prob = h("div", "problem-card");
    prob.appendChild(h("div", "mono-label", "The failure"));
    prob.appendChild(h("p", null, t.problem));
    prob.appendChild(h("p", "lc-beginner", t.beginner));
    card.appendChild(prob);

    card.appendChild(h("p", "lc-analogy", "Like " + t.analogy));

    /* demo controls */
    var demo = h("div", "demo-box");
    var drow = h("div", "demo-row");
    els.play = h("button", "big-btn demo-play", RM ? C.controls.restart : C.controls.play);
    els.play.addEventListener("click", onPlay);
    drow.appendChild(els.play);
    drow.appendChild(h("span", "demo-label", t.demoLabel));
    demo.appendChild(drow);

    els.scrub = document.createElement("input");
    els.scrub.type = "range";
    els.scrub.min = "0"; els.scrub.max = "1000"; els.scrub.value = "0";
    els.scrub.className = "scrub";
    els.scrub.setAttribute("aria-label", C.controls.scrubLabel);
    els.scrub.addEventListener("input", function () {
      ctl.seek(parseInt(els.scrub.value, 10) / 1000);
      els.play.textContent = RM ? C.controls.restart : C.controls.play;
    });
    demo.appendChild(els.scrub);
    els.phase = h("div", "demo-phase mono-label", C.phases.idle);
    demo.appendChild(els.phase);
    if (RM) demo.appendChild(h("p", "fine", C.a11y.rmNote));
    if (cfg.cutaway) demo.appendChild(h("p", "fine", C.cutawayNote));
    card.appendChild(demo);

    card.appendChild(band("solution", "What was built", t.solution));
    card.appendChild(band("tradeoff", "What it costs", t.tradeoff));
    card.appendChild(band("scale", "Under load", t.atScale));

    if (cfg.free) {
      var free = h("div", "free-note");
      free.appendChild(h("div", "mono-label", "Free shift"));
      free.appendChild(h("p", null, "The gate is live. Click a slot, or press 1-5, R, N."));
      card.appendChild(free);
    }

    els.dots.forEach(function (d, i) {
      d.classList.toggle("on", i === layerIndex);
      d.classList.toggle("done", i < layerIndex);
    });
    els.prev.disabled = layerIndex === 0;
    els.next.disabled = layerIndex === L.length - 1;
    Object.keys(els.gateBtns).forEach(function (k) { els.gateBtns[k].disabled = !cfg.free; });
    setToggle(els.cutBtn, !!cfg.cutaway);
    setToggle(els.expBtn, ctl.scene.explodeAmount > 0);
    setToggle(els.oldBtn, ctl.state.mode === "1930");
    canvas.setAttribute("aria-label", C.a11y.canvas + " — " + t.name);
  }

  function onPlay() {
    var S = ctl.state;
    if (RM) { ctl.seek(0); els.scrub.value = "0"; return; }
    if (S.playing) { ctl.pause(); els.play.textContent = C.controls.play; return; }
    if (S.t >= 1 || S.phase === "idle") startDemo();
    else { ctl.play(); els.play.textContent = C.controls.pause; }
  }

  function startDemo() {
    var cfg = L[layerIndex];
    if (!cfg.demo) return;
    ctl.state.gear = cfg.demo.from;
    /* pass the layer's own profile, not the resolved one — the scene decides
       what 1930 mode does to it, and it is the only thing that knows */
    ctl.beginShift(cfg.demo.to, cfg.demo.profile);
    els.play.textContent = RM ? C.controls.restart : C.controls.pause;
  }

  function goto(i) {
    if (i < 0 || i >= L.length) return;
    layerIndex = i;
    ctl.applyLayer(L[i]);
    renderCard();
    els.scrub.value = "0";
    if (location.hash !== "#" + L[i].id) history.replaceState(null, "", "#" + L[i].id);
    if (!RM) setTimeout(startDemo, 420);
  }

  ctl.on(function (kind, payload) {
    if (kind === "phase") {
      var txt = C.phases[payload] || "";
      els.phase.textContent = txt;
      els.phase.classList.toggle("bad", payload === "crash" || payload === "grind" || payload === "blocked");
      live.textContent = txt;
    } else if (kind === "done") {
      els.play.textContent = C.controls.replay;
    }
  });

  /* ═══ pointer: orbit on the canvas, page scroll everywhere else ═══ */
  var drag = null, pointers = {}, pinch = 0, moved = false;
  canvas.addEventListener("pointerdown", function (e) {
    pointers[e.pointerId] = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
    drag = [e.clientX, e.clientY];
    moved = false;
    $("hint").classList.add("gone");
  });
  canvas.addEventListener("pointermove", function (e) {
    var ids = Object.keys(pointers);
    if (pointers[e.pointerId]) pointers[e.pointerId] = [e.clientX, e.clientY];
    if (ids.length >= 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) ctl.dolly(pinch / d);
      pinch = d;
      return;
    }
    if (drag) {
      ctl.orbit(e.clientX - drag[0], e.clientY - drag[1]);
      drag = [e.clientX, e.clientY];
      moved = true;
      return;
    }
    var r = canvas.getBoundingClientRect();
    var lbl = ctl.hoverLabel(e.clientX - r.left, e.clientY - r.top);
    var tip = $("tip");
    if (lbl) {
      tip.textContent = lbl;
      tip.style.left = (e.clientX - r.left) + "px";
      tip.style.top = (e.clientY - r.top) + "px";
      tip.classList.add("on");
    } else tip.classList.remove("on");
  });
  function endPointer(e) {
    delete pointers[e.pointerId];
    if (!Object.keys(pointers).length) { drag = null; pinch = 0; }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", function () { $("tip").classList.remove("on"); });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    ctl.dolly(e.deltaY > 0 ? 1.09 : 0.92);
  }, { passive: false });
  canvas.addEventListener("dblclick", function () { ctl.resetCamera(); });

  /* ═══ layout ═══ */
  function fit() {
    ctl.scene.resize();
    ctl.resetCamera();
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe($("stageWrap"));
  else window.addEventListener("resize", fit);

  /* ═══ boot ═══ */
  buildHud($("stageWrap"));
  buildStageControls($("stageWrap"));
  buildGate($("stageWrap"));
  buildDoc($("docInner"));

  var dbg = null;
  if (DEBUG) { dbg = h("div", "dbg"); $("stageWrap").appendChild(dbg); }

  var start = L.map(function (c) { return c.id; }).indexOf(location.hash.replace("#", ""));
  layerIndex = start >= 0 ? start : 0;
  ctl.applyLayer(L[layerIndex]);
  renderCard();
  ctl.scene.resize();
  ctl.resetCamera();
  ctl.start();

  (function paintLoop() {
    requestAnimationFrame(paintLoop);
    paintHud();
    paintGate();
    var S = ctl.state;
    if (S.playing) els.scrub.value = Math.round(S.t * 1000) + "";
    if (S.shake > 0.01 && !RM) {
      canvas.style.transform = "translate(" + (Math.random() - 0.5) * S.shake * 3 + "px," + (Math.random() - 0.5) * S.shake * 3 + "px)";
    } else if (canvas.style.transform) canvas.style.transform = "";
    $("stageWrap").classList.toggle("crashing", !!S.crashed);
    if (dbg) dbg.textContent = ctl.scene.stats.ms.toFixed(1) + " ms · " + ctl.scene.stats.faces + " items · lod " + ctl.scene.lod;
  })();

  if (!RM) setTimeout(startDemo, 700);
})();
