/* ═══════════════════════════════════════════════════════════════
   THE BEAT — instruments
   ───────────────────────────────────────────────────────────────
   The readouts that only mean something on an escapement: the rate
   and drive-sensitivity pair, and the mainspring the reader drags
   to move them. The walkthrough, transport and stage toggles come
   from lab-page.js; the geometry and kinematics from
   escapement-scene.js.

   The whole study is one interaction: drag the mainspring and watch
   which escapements care. So the mainspring is live on every layer,
   not only the free one — a control that argues the point is not a
   control you hide until the end.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var C = ESC_COPY;
  var els = {};
  var api = null;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* A signed seconds-per-day figure. Under a tenth of a second the
     sign is noise, so it is dropped rather than rounded into a claim
     the model cannot support. */
  function sd(v) {
    var a = Math.abs(v);
    if (a < 0.1) return "0 s/day";
    var n = a >= 100 ? Math.round(a) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
    return (v > 0 ? "+" : "−") + n + " s/day";
  }
  /* Past a couple of minutes a day, seconds stop meaning anything. */
  function rateText(v) {
    var a = Math.abs(v);
    if (a >= 120) return (v > 0 ? "+" : "−") + Math.round(a / 60) + " min/day";
    return sd(v);
  }

  /* ═══ HUD ═══
     Rate on top because it is what a clock owner feels; sensitivity
     under it because it is what the ladder is actually about. The
     bar is the sensitivity on a log scale — four orders of magnitude
     separate the foliot from the lever, and a linear bar would show
     every escapement after the first as empty. */
  function buildHud(root) {
    var hud = h("div", "hud");

    var left = h("div", "hud-mech");
    els.mech = h("div", "hud-mech-n", "Anchor");
    left.appendChild(els.mech);
    els.era = h("div", "mono-label", "");
    left.appendChild(els.era);
    hud.appendChild(left);

    var meters = h("div", "hud-meters");

    var r1 = h("div", "hud-row");
    r1.appendChild(h("span", "mono-label", C.hud.rate));
    els.rate = h("span", "hud-num big", "0 s/day");
    r1.appendChild(els.rate);
    meters.appendChild(r1);

    var r2 = h("div", "hud-row");
    r2.appendChild(h("span", "mono-label", C.hud.drift));
    els.drift = h("span", "hud-num", "0");
    r2.appendChild(els.drift);
    meters.appendChild(r2);

    var bar = h("div", "hud-bar");
    els.barFill = h("div", "hud-bar-fill");
    bar.appendChild(els.barFill);
    meters.appendChild(bar);

    var r3 = h("div", "hud-row fine");
    r3.appendChild(h("span", "mono-label", C.hud.amp));
    els.amp = h("span", "hud-num", "");
    r3.appendChild(els.amp);
    meters.appendChild(r3);

    hud.appendChild(meters);
    root.appendChild(hud);
  }

  /* log10 of the sensitivity, mapped so 0.1 s/day is empty and
     2000 s/day is full */
  function driftBar(d) {
    var lo = Math.log(0.1), hi = Math.log(2000);
    return Math.max(2, Math.min(100, (Math.log(Math.max(d, 0.1)) - lo) / (hi - lo) * 100));
  }

  function paintHud(ctl) {
    var S = ctl.state, d = ctl.drift();
    els.mech.textContent = C.mechNames[S.mech] || S.mech;
    els.rate.textContent = rateText(ctl.rate());
    els.rate.classList.toggle("matched", Math.abs(ctl.rate()) < 2);
    els.drift.textContent = "±" + (d >= 100 ? Math.round(d / 60) + " min" : d >= 10 ? Math.round(d) + " s" : d.toFixed(1) + " s") + " / day";
    els.barFill.style.width = driftBar(d) + "%";
    els.barFill.classList.toggle("wide", d > 30);
    /* the real swing, and the drawn one beside it only where the two
       differ — which is exactly the layers where five degrees would
       otherwise be a straight line */
    var real = ctl.realArc(), drawn = S.amp;
    els.amp.textContent = Math.round(real) + "°"
      + (Math.abs(drawn - real) > 1 ? " · drawn " + Math.round(drawn) + "°" : "");
  }

  /* ═══ the mainspring ═══
     One slider, live everywhere. Everything above it moves when it
     moves, which is the entire argument of the page. */
  function buildDrive(root) {
    var wrap = h("div", "drive-wrap");
    wrap.appendChild(h("div", "mono-label", C.hud.drive));
    els.drive = document.createElement("input");
    els.drive.type = "range";
    els.drive.className = "scrub drive-range";
    els.drive.min = "0"; els.drive.max = "1"; els.drive.step = "0.01"; els.drive.value = "0.5";
    els.drive.setAttribute("aria-label", C.a11y.drive);
    els.drive.addEventListener("input", function () {
      api.ctl.setDrive(parseFloat(els.drive.value));
    });
    wrap.appendChild(els.drive);
    var ends = h("div", "drive-ends");
    ends.appendChild(h("span", "mono-label", C.driveLabels.low));
    ends.appendChild(h("span", "mono-label", C.driveLabels.high));
    wrap.appendChild(ends);
    root.appendChild(wrap);
  }

  /* ═══ the bench ═══
     Five buttons, one per escapement. Live only where the layer says
     so — before the synthesis each layer is making one argument, and
     letting the reader swap mechanisms mid-argument loses it. */
  function buildBench(root) {
    var wrap = h("div", "bench-wrap");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", C.a11y.mech);
    els.benchBtns = {};
    ESCScene.order.forEach(function (name, i) {
      var b = h("button", "bench-btn", C.mechNames[name]);
      b.setAttribute("aria-label", C.mechNames[name] + ", number " + (i + 1));
      b.addEventListener("click", function () { pick(name); });
      els.benchBtns[name] = b;
      wrap.appendChild(b);
    });
    root.appendChild(wrap);
    els.bench = wrap;
  }

  function pick(name) {
    if (!api.layer().free) return;
    if (api.ctl.setMech(name)) {
      api.ctl.play();
      api.demoStarted();
    }
  }

  function paintBench(ctl) {
    var k;
    for (k in els.benchBtns) els.benchBtns[k].classList.toggle("on", ctl.state.mech === k);
  }

  LabPage.mount({
    copy: C,
    scene: ESCScene,
    instruments: {
      build: function (root, a) {
        api = a;
        buildHud(root);
        buildDrive(root);
        buildBench(root);
        document.addEventListener("keydown", function (e) {
          if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && e.key.length === 1) return;
          var i = "12345".indexOf(e.key);
          if (i >= 0) { pick(ESCScene.order[i]); e.preventDefault(); }
        });
      },
      layerChanged: function (a) {
        var free = !!a.layer().free;
        els.bench.classList.toggle("live", free);
        Object.keys(els.benchBtns).forEach(function (k) { els.benchBtns[k].disabled = !free; });
        els.drive.value = String(a.ctl.state.drive);
        els.era.textContent = (C.layers[a.layerIndex()] || {}).era || "";
      },
      paint: function (a) {
        paintHud(a.ctl);
        paintBench(a.ctl);
      }
    }
  });
})();
