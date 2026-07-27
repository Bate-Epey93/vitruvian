/* ═══════════════════════════════════════════════════════════════
   THE GEAR CHANGE — instruments
   ───────────────────────────────────────────────────────────────
   The readouts that only mean something on a gearbox: the HUD that
   shows the two speeds converging, and the H-gate you shift with.
   The walkthrough, transport and stage toggles come from lab-page.js;
   the geometry and kinematics from transmission-scene.js.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var C = TX_COPY;
  var els = {};
  var layerOf = null;

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

  /* ═══ HUD ═══
     Two needles and a pedal. The whole argument of the synchromesh
     layer is one number reaching zero, so Difference gets its own row. */
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

  function paintHud(ctl) {
    var S = ctl.state;
    els.gear.textContent = C.gearNames[S.gear] || "N";
    els.rpm.textContent = Math.round(S.engineRpm) + " rpm";
    els.barFill.style.width = Math.max(0, Math.min(100, S.engineRpm / 6000 * 100)) + "%";
    var tgt = (S.to && ctl.ratios[S.to]) ? Math.abs(S.roadRpm * ctl.ratios[S.to]) : S.engineRpm;
    els.barTarget.style.left = Math.max(0, Math.min(100, tgt / 6000 * 100)) + "%";
    var d = Math.round(S.delta);
    els.delta.textContent = d + " rpm";
    els.delta.classList.toggle("matched", d < 60);
    els.pedal.style.height = Math.round(S.clutch * 100) + "%";
  }

  /* ═══ H-gate ═══ */
  var GATE_X = [18, 48, 78];
  var SLOTS = [
    [1, 0, 0], [3, 1, 0], [5, 2, 0],
    [0, 1, 1],
    [2, 0, 2], [4, 1, 2], [-1, 2, 2]
  ];

  function buildGate(root, api) {
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
      b.addEventListener("click", function () { requestShift(api, sl[0]); });
      els.gateBtns[sl[0]] = b;
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wrap.appendChild(h("div", "mono-label gate-cap", "Gate"));
    root.appendChild(wrap);
  }

  function paintGate(ctl) {
    var S = ctl.state, k;
    els.knob.setAttribute("cx", (18 + S.leverRail * 30).toFixed(1));
    els.knob.setAttribute("cy", (42 - S.leverRow * 28).toFixed(1));
    for (k in els.gateBtns) els.gateBtns[k].classList.toggle("on", String(S.gear) === k);
  }

  function requestShift(api, g) {
    if (!api.layer().free) return;
    if (g === api.ctl.state.gear) return;
    /* no profile argument: this is the one path that asks the scene
       what the current mode makes of a shift */
    if (api.ctl.beginShift(g)) api.demoStarted();
  }

  LabPage.mount({
    copy: C,
    scene: TXScene,
    instruments: {
      build: function (root, api) {
        layerOf = api.layer;
        buildHud(root);
        buildGate(root, api);
        document.addEventListener("keydown", function (e) {
          if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && e.key.length === 1) return;
          var m = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, r: -1, R: -1, n: 0, N: 0 };
          if (m[e.key] !== undefined) { requestShift(api, m[e.key]); e.preventDefault(); }
        });
      },
      layerChanged: function (api) {
        var free = !!api.layer().free;
        Object.keys(els.gateBtns).forEach(function (k) { els.gateBtns[k].disabled = !free; });
      },
      paint: function (api) {
        paintHud(api.ctl);
        paintGate(api.ctl);
      }
    }
  });
})();
