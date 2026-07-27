/* ═══════════════════════════════════════════════════════════════
   INK3D — a small 3D engine that draws like a technical plate
   ───────────────────────────────────────────────────────────────
   Canvas 2D, no dependencies, no build step. Filled polygons in
   three quantised paper washes plus ink outlines: silhouettes
   heavy, creases light, hatching on the darkest wash. Colours are
   read from the app's CSS custom properties, so light/dark theme
   flips come free.

   Knows nothing about transmissions — see transmission-scene.js.
   Same discipline as the rest of the app: no innerHTML, no CDN.
   ═══════════════════════════════════════════════════════════════ */

var Ink3D = (function () {
  "use strict";

  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var EMPTY_DASH = [];

  /* ── mat4: row-major, translation in the fourth column ── */
  function mIdent() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mMul(a, b) {
    var o = new Array(16), r, c, k, s;
    for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) {
      s = 0;
      for (k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
      o[r * 4 + c] = s;
    }
    return o;
  }
  function mT(x, y, z) { return [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]; }
  function mRX(a) { var c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]; }
  function mRY(a) { var c = Math.cos(a), s = Math.sin(a); return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]; }
  function mRZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]; }

  /* ── colour helpers (numeric mixing — canvas can't be trusted with color-mix) ── */
  function parseColor(str, fallback) {
    if (!str) return fallback;
    str = String(str).trim();
    var m;
    if (str.charAt(0) === "#") {
      if (str.length === 4) return [parseInt(str[1] + str[1], 16), parseInt(str[2] + str[2], 16), parseInt(str[3] + str[3], 16)];
      if (str.length >= 7) return [parseInt(str.substr(1, 2), 16), parseInt(str.substr(3, 2), 16), parseInt(str.substr(5, 2), 16)];
    }
    m = str.match(/rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      if (p.length >= 3) return [p[0], p[1], p[2]];
    }
    return fallback;
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function css(c, alpha) {
    var s = "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ",";
    return s + (alpha == null ? 1 : alpha) + ")";
  }

  /* ═══ MESH BUILDERS ═══
     A mesh is { v:[x,y,z,...], f:[{i:[idx…], n:[x,y,z], t:tier}],
                 e:[{a,b,f0,f1,c:crease,t:tier}], w:[[idx…]] }
     Local +z is the axis of revolution / extrusion. Faces are wound
     counter-clockwise seen from outside. Tier 1 faces are the first
     thing the perf governor drops. */

  function faceNormal(v, idx) {
    /* Newell — stable for the slightly non-planar quads a revolve makes */
    var nx = 0, ny = 0, nz = 0, i, a, b;
    for (i = 0; i < idx.length; i++) {
      a = idx[i] * 3; b = idx[(i + 1) % idx.length] * 3;
      nx += (v[a + 1] - v[b + 1]) * (v[a + 2] + v[b + 2]);
      ny += (v[a + 2] - v[b + 2]) * (v[a] + v[b]);
      nz += (v[a] - v[b]) * (v[a + 1] + v[b + 1]);
    }
    var L = Math.hypot(nx, ny, nz) || 1;
    return [nx / L, ny / L, nz / L];
  }

  function bakeEdges(mesh, creaseDeg) {
    var cosLimit = Math.cos((creaseDeg == null ? 32 : creaseDeg) * Math.PI / 180);
    var map = Object.create(null), i, j, f, a, b, key, rec;
    for (i = 0; i < mesh.f.length; i++) {
      f = mesh.f[i];
      for (j = 0; j < f.i.length; j++) {
        a = f.i[j]; b = f.i[(j + 1) % f.i.length];
        if (a === b) continue;
        key = a < b ? a + "_" + b : b + "_" + a;
        rec = map[key];
        if (rec) { if (rec.f1 < 0) rec.f1 = i; }
        else map[key] = { a: a < b ? a : b, b: a < b ? b : a, f0: i, f1: -1 };
      }
    }
    mesh.e = [];
    for (key in map) {
      rec = map[key];
      var crease = true;
      if (rec.f1 >= 0) {
        var n0 = mesh.f[rec.f0].n, n1 = mesh.f[rec.f1].n;
        crease = (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) < cosLimit;
      }
      rec.c = crease;
      rec.t = (rec.f1 >= 0 && !crease) ? 1 : 0;
      mesh.e.push(rec);
    }
    return mesh;
  }

  function finalize(v, f, wires) {
    var mesh = { v: v, f: f, e: [], w: wires || [] }, i;
    for (i = 0; i < f.length; i++) if (!f[i].n) f[i].n = faceNormal(v, f[i].i);
    return bakeEdges(mesh);
  }

  /* prism — extrude a closed 2D profile (flat [x,y,…], CCW) along z */
  function prism(profile, w, opt) {
    opt = opt || {};
    var n = profile.length / 2, v = [], f = [], i, hw = w / 2, front = [], back = [];
    for (i = 0; i < n; i++) { v.push(profile[i * 2], profile[i * 2 + 1], hw); front.push(i); }
    for (i = 0; i < n; i++) { v.push(profile[i * 2], profile[i * 2 + 1], -hw); back.push(n + i); }
    if (!opt.openCaps) {
      f.push({ i: front.slice(), t: 0 });
      f.push({ i: back.slice().reverse(), t: 0 });
    }
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      f.push({ i: [i, n + i, n + j, j], t: opt.sideTier == null ? 1 : opt.sideTier });
    }
    return finalize(v, f, opt.wires);
  }

  /* revolve — spin a closed section (flat [r,z,…], CCW in the r-z plane) about z */
  function revolve(section, segs, opt) {
    opt = opt || {};
    segs = segs || 14;
    var np = section.length / 2, v = [], f = [], rings = [], i, j, ang, r, z, base;
    for (i = 0; i < np; i++) {
      r = section[i * 2]; z = section[i * 2 + 1];
      base = v.length / 3;
      if (r <= 1e-6) { v.push(0, 0, z); rings.push(null); }
      else {
        for (j = 0; j < segs; j++) { ang = j / segs * Math.PI * 2; v.push(Math.cos(ang) * r, Math.sin(ang) * r, z); }
        rings.push(base);
      }
      if (rings[i] === null) rings[i] = -(base + 1);   // negative marks the shared apex vertex
    }
    function vi(i, j) { var b = rings[i]; return b < 0 ? (-b - 1) : b + (j % segs); }
    for (i = 0; i < np; i++) {
      var i2 = (i + 1) % np;
      for (j = 0; j < segs; j++) {
        var a = vi(i, j), b = vi(i, j + 1), c = vi(i2, j + 1), d = vi(i2, j);
        var quad = [a, b, c, d].filter(function (x, k, arr) { return arr.indexOf(x) === k; });
        if (quad.length < 3) continue;
        f.push({ i: quad, t: opt.tier == null ? 0 : opt.tier });
      }
    }
    return finalize(v, f, opt.wires);
  }

  /* merge — combine meshes, optionally moving one into place first */
  function merge(a, b, offset) {
    var base = a.v.length / 3, i, j;
    for (i = 0; i < b.v.length; i += 3) {
      a.v.push(b.v[i] + (offset ? offset[0] : 0), b.v[i + 1] + (offset ? offset[1] : 0), b.v[i + 2] + (offset ? offset[2] : 0));
    }
    for (i = 0; i < b.f.length; i++) {
      var f = b.f[i], idx = [];
      for (j = 0; j < f.i.length; j++) idx.push(f.i[j] + base);
      a.f.push({ i: idx, n: f.n, t: f.t });
    }
    for (i = 0; i < b.w.length; i++) {
      a.w.push(b.w[i].map(function (x) { return x + base; }));
    }
    /* rebake so silhouettes still work across the seam — the two halves
       share no vertices, so nothing gets welded that shouldn't be */
    return bakeEdges(a);
  }

  /* rotate a mesh in place (used when a sub-part sits crosswise) */
  function xform(mesh, m) {
    var i, x, y, z;
    for (i = 0; i < mesh.v.length; i += 3) {
      x = mesh.v[i]; y = mesh.v[i + 1]; z = mesh.v[i + 2];
      mesh.v[i]     = m[0] * x + m[1] * y + m[2] * z + m[3];
      mesh.v[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
      mesh.v[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
    }
    for (i = 0; i < mesh.f.length; i++) mesh.f[i].n = faceNormal(mesh.v, mesh.f[i].i);
    return mesh;
  }

  /* ── profile generators ── */

  /* A spur gear, drawn honestly enough to mesh: straight flanks, tip
     narrower than root so a mating tooth always finds daylight in the
     gap. Tooth arc at the pitch circle ≈ 0.43 of the pitch — the rest
     is the backlash you can see. */
  function gearProfile(Z, module, opt) {
    opt = opt || {};
    var p = Math.PI * 2 / Z;
    var rp = module * Z / 2;
    var ra = rp + module * (opt.add == null ? 0.85 : opt.add);
    var rf = rp - module * (opt.ded == null ? 1.0 : opt.ded);
    var ht = p * (opt.tip == null ? 0.17 : opt.tip);
    var hr = p * (opt.root == null ? 0.27 : opt.root);
    var out = [], i, a;
    for (i = 0; i < Z; i++) {
      a = i * p;
      out.push(Math.cos(a - hr) * rf, Math.sin(a - hr) * rf);
      out.push(Math.cos(a - ht) * ra, Math.sin(a - ht) * ra);
      out.push(Math.cos(a + ht) * ra, Math.sin(a + ht) * ra);
      out.push(Math.cos(a + hr) * rf, Math.sin(a + hr) * rf);
    }
    return out;
  }
  function circleProfile(r, segs) {
    var out = [], i;
    segs = segs || 20;
    for (i = 0; i < segs; i++) { var a = i / segs * Math.PI * 2; out.push(Math.cos(a) * r, Math.sin(a) * r); }
    return out;
  }
  function rectProfile(w, h, cx, cy) {
    cx = cx || 0; cy = cy || 0;
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2];
  }
  /* an arc band — the body of a shift fork */
  function arcBandProfile(rIn, rOut, a0, a1, segs) {
    var out = [], i, a;
    segs = segs || 16;
    for (i = 0; i <= segs; i++) { a = a0 + (a1 - a0) * i / segs; out.push(Math.cos(a) * rOut, Math.sin(a) * rOut); }
    for (i = segs; i >= 0; i--) { a = a0 + (a1 - a0) * i / segs; out.push(Math.cos(a) * rIn, Math.sin(a) * rIn); }
    return out;
  }

  /* ── composite builders ── */

  function gearMesh(Z, module, width, bore, opt) {
    var m = prism(gearProfile(Z, module, opt), width, { sideTier: 1 });
    if (bore) {
      var base = m.v.length / 3, i, segs = 14, loopA = [], loopB = [];
      for (i = 0; i < segs; i++) {
        var a = i / segs * Math.PI * 2;
        m.v.push(Math.cos(a) * bore, Math.sin(a) * bore, width / 2 + 0.01);
        loopA.push(base + i);
      }
      base = m.v.length / 3;
      for (i = 0; i < segs; i++) {
        var b = i / segs * Math.PI * 2;
        m.v.push(Math.cos(b) * bore, Math.sin(b) * bore, -width / 2 - 0.01);
        loopB.push(base + i);
      }
      m.w.push(loopA, loopB);
    }
    return m;
  }

  /* A ring of chamfered dog teeth — the thing that actually locks a
     gear to its shaft, and the thing that used to lose the fight. */
  function dogRingMesh(rIn, rOut, width, n, chamfer, dir) {
    var mesh = { v: [], f: [], e: [], w: [] }, i;
    var half = Math.PI / n * 0.34, hw = width / 2;
    var tipC = dir >= 0 ? hw : -hw, backC = dir >= 0 ? -hw : hw;
    for (i = 0; i < n; i++) {
      var a = i * Math.PI * 2 / n;
      var pts = [], k, ang;
      /* trapezoid in the r-θ plane, tapered at the leading end */
      var prof = [
        [rIn, -half], [rOut, -half * 0.72], [rOut, half * 0.72], [rIn, half]
      ];
      var tipProf = [
        [rIn, -half * (1 - chamfer)], [rOut, -half * 0.72 * (1 - chamfer)],
        [rOut, half * 0.72 * (1 - chamfer)], [rIn, half * (1 - chamfer)]
      ];
      var base = mesh.v.length / 3;
      for (k = 0; k < 4; k++) { ang = a + prof[k][1]; mesh.v.push(Math.cos(ang) * prof[k][0], Math.sin(ang) * prof[k][0], backC); }
      for (k = 0; k < 4; k++) { ang = a + tipProf[k][1]; mesh.v.push(Math.cos(ang) * tipProf[k][0], Math.sin(ang) * tipProf[k][0], tipC); }
      var B = base, T = base + 4;
      var order = dir >= 0
        ? [[B + 3, B + 2, B + 1, B], [T, T + 1, T + 2, T + 3]]
        : [[B, B + 1, B + 2, B + 3], [T + 3, T + 2, T + 1, T]];
      mesh.f.push({ i: order[0], t: 0 }, { i: order[1], t: 0 });
      for (k = 0; k < 4; k++) {
        var j = (k + 1) % 4;
        mesh.f.push(dir >= 0 ? { i: [B + k, T + k, T + j, B + j], t: 0 } : { i: [B + j, T + j, T + k, B + k], t: 0 });
      }
    }
    for (i = 0; i < mesh.f.length; i++) mesh.f[i].n = faceNormal(mesh.v, mesh.f[i].i);
    return bakeEdges(mesh, 28);
  }

  /* ═══ SCENE ═══ */

  function Scene(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.parts = [];
    this.byId = Object.create(null);
    this.camera = { yaw: -0.62, pitch: 0.42, dist: 900, target: [70, -50, 0], fov: 22 * Math.PI / 180 };
    this.explodeAmount = 0;
    this.clip = null;
    this.lod = 0;
    this.dirty = true;
    this.animating = false;
    this.stats = { faces: 0, ms: 0 };
    this.reducedMotion = RM;
    this._pal = null;
    this._hatch = null;
    this._queue = [];
    this._raf = 0;
    this._frames = [];
    this._light = [-0.38, 0.72, 0.58];
    var L = Math.hypot(this._light[0], this._light[1], this._light[2]);
    this._light = [this._light[0] / L, this._light[1] / L, this._light[2] / L];
    this.readTokens();
    this.resize();
  }

  Scene.prototype.add = function (spec) {
    var p = {
      id: spec.id,
      mesh: spec.mesh,
      pos: spec.pos ? spec.pos.slice() : [0, 0, 0],
      rot: spec.rot ? spec.rot.slice() : [0, 0, 0],
      explode: spec.explode ? spec.explode.slice() : [0, 0, 0],
      dyn: [0, 0, 0],
      spin: 0,
      axial: 0,
      style: spec.style || "solid",
      visible: spec.visible !== false,
      pickable: !!spec.pickable,
      clippable: !!spec.clippable,
      label: spec.label || "",
      group: spec.group || "",
      _sx: null, _sy: null, _sd: null, _box: null
    };
    this.parts.push(p);
    this.byId[p.id] = p;
    return p;
  };
  Scene.prototype.get = function (id) { return this.byId[id]; };
  Scene.prototype.invalidate = function () { this.dirty = true; };

  Scene.prototype.readTokens = function () {
    var s = getComputedStyle(document.documentElement);
    function tok(name, fb) { return parseColor(s.getPropertyValue(name), fb); }
    var ink = tok("--ink", [20, 20, 22]);
    var panel = tok("--panel", [251, 250, 246]);
    var line = tok("--line", [216, 212, 200]);
    var faint = tok("--faint", [185, 181, 168]);
    var muted = tok("--muted", [138, 135, 125]);
    var accent = tok("--accent", [14, 122, 99]);
    var accentDeep = tok("--accent-deep", [10, 87, 72]);
    var accentWash = tok("--accent-wash", [226, 240, 236]);
    var failure = tok("--failure", [194, 47, 47]);
    var failureWash = tok("--failure-wash", [248, 231, 231]);

    function washes(base, toward) {
      return [css(mix(base, toward, 0.02)), css(mix(base, toward, 0.13)), css(mix(base, toward, 0.24))];
    }
    this._pal = {
      solid:   { wash: washes(panel, ink), stroke: css(ink), soft: css(ink, 0.42), hatch: true },
      dim:     { wash: washes(panel, line), stroke: css(muted), soft: css(muted, 0.4), hatch: false },
      accent:  { wash: washes(accentWash, accent), stroke: css(accentDeep), soft: css(accent, 0.5), hatch: true },
      failure: { wash: washes(failureWash, failure), stroke: css(failure), soft: css(failure, 0.5), hatch: true },
      ghost:   { wash: null, stroke: css(faint, 0.8), soft: css(faint, 0.45), hatch: false }
    };
    /* the section: material the cut plane passes through, and the inside
       walls it exposes behind that material. Section hatch is coarser and
       one-way — the convention, and the only way a cut this wide stays
       legible next to the shading hatch. */
    this._cutFill = css(mix(panel, ink, 0.09));
    this._cutBack = css(mix(panel, ink, 0.19));
    this._sectionInk = css(ink, 0.38);
    this._section = null;
    this._hatchInk = css(ink, 0.30);
    this._hatch = null;
    this.dirty = true;
  };

  /* Two hatch angles, handed out so that neighbours never match: without it
     a shaft, its hub and its sleeve section into one undifferentiated mass. */
  Scene.prototype._sectionPattern = function (dir) {
    if (this._section && this._section[dir]) return this._section[dir];
    if (!this._section) this._section = [];
    var S = 9, c = document.createElement("canvas");
    c.width = S; c.height = S;
    var g = c.getContext("2d");
    g.strokeStyle = this._sectionInk;
    g.lineWidth = 1;
    g.beginPath();
    if (dir) {
      g.moveTo(0, 0); g.lineTo(S, S);
      g.moveTo(-1, S - 1); g.lineTo(1, S + 1);
      g.moveTo(S - 1, -1); g.lineTo(S + 1, 1);
    } else {
      g.moveTo(0, S); g.lineTo(S, 0);
      g.moveTo(-1, 1); g.lineTo(1, -1);
      g.moveTo(S - 1, S + 1); g.lineTo(S + 1, S - 1);
    }
    g.stroke();
    this._section[dir] = this.ctx.createPattern(c, "repeat");
    return this._section[dir];
  };

  Scene.prototype._hatchPattern = function () {
    if (this._hatch) return this._hatch;
    var S = 6, c = document.createElement("canvas");
    c.width = S; c.height = S;
    var g = c.getContext("2d");
    g.strokeStyle = this._hatchInk;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, S); g.lineTo(S, 0);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(S - 1, S + 1); g.lineTo(S + 1, S - 1);
    g.stroke();
    this._hatch = this.ctx.createPattern(c, "repeat");
    return this._hatch;
  };

  Scene.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (this._w === w && this._h === h && this._dpr === dpr) return;
    this._w = w; this._h = h; this._dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dirty = true;
  };

  /* distance that frames a sphere of the given radius */
  Scene.prototype.fitDistance = function (radius, pad) {
    var aspect = (this._w || 1) / (this._h || 1);
    var vFov = this.camera.fov;
    var hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    var f = Math.min(vFov, hFov) / 2;
    return radius / Math.tan(f) * (pad == null ? 1.12 : pad);
  };

  Scene.prototype._world = function (p) {
    var m = mT(p.pos[0] + p.explode[0] * this.explodeAmount,
               p.pos[1] + p.explode[1] * this.explodeAmount,
               p.pos[2] + p.explode[2] * this.explodeAmount);
    if (p.rot[0]) m = mMul(m, mRX(p.rot[0]));
    if (p.rot[1]) m = mMul(m, mRY(p.rot[1]));
    if (p.rot[2]) m = mMul(m, mRZ(p.rot[2]));
    if (p.dyn[0]) m = mMul(m, mRX(p.dyn[0]));
    if (p.dyn[1]) m = mMul(m, mRY(p.dyn[1]));
    if (p.dyn[2]) m = mMul(m, mRZ(p.dyn[2]));
    if (p.axial) m = mMul(m, mT(0, 0, p.axial));
    if (p.spin) m = mMul(m, mRZ(p.spin));
    return m;
  };

  Scene.prototype._view = function () {
    var c = this.camera;
    var m = mT(-c.target[0], -c.target[1], -c.target[2]);
    m = mMul(mRY(c.yaw), m);
    m = mMul(mRX(c.pitch), m);
    return mMul(mT(0, 0, -c.dist), m);
  };

  /* ═══ SECTIONING ═══
     A cutaway that merely drops the faces in front of the plane leaves a
     ragged, hollow shell: faces straddling the plane vanish whole, and the
     opening shows nothing behind it. These two do it properly — clip the
     polygon on the plane, then fill the ring the cut exposes. */

  /* Sutherland–Hodgman against one plane, in world space.
     Returns INSIDE when the ring is untouched, OUTSIDE when it is wholly
     removed, else the surviving ring as flat world [x,y,z,…]. */
  var CLIP_IN = 1, CLIP_OUT = 2;
  function clipRing(idx, wx, wy, wz, pl) {
    var n = idx.length, i, ai, bi, sa, sb, t, out, anyOut = false, anyIn = false;
    for (i = 0; i < n; i++) {
      ai = idx[i];
      if (wx[ai] * pl[0] + wy[ai] * pl[1] + wz[ai] * pl[2] - pl[3] > 0) anyOut = true;
      else anyIn = true;
      if (anyOut && anyIn) break;
    }
    if (!anyOut) return CLIP_IN;
    if (!anyIn) return CLIP_OUT;
    out = [];
    for (i = 0; i < n; i++) {
      ai = idx[i]; bi = idx[(i + 1) % n];
      sa = wx[ai] * pl[0] + wy[ai] * pl[1] + wz[ai] * pl[2] - pl[3];
      sb = wx[bi] * pl[0] + wy[bi] * pl[1] + wz[bi] * pl[2] - pl[3];
      if (sa <= 0) out.push(wx[ai], wy[ai], wz[ai]);
      if ((sa > 0) !== (sb > 0)) {
        t = sa / (sa - sb);
        out.push(wx[ai] + (wx[bi] - wx[ai]) * t,
                 wy[ai] + (wy[bi] - wy[ai]) * t,
                 wz[ai] + (wz[bi] - wz[ai]) * t);
      }
    }
    return out.length >= 9 ? out : CLIP_OUT;
  }

  /* Where the plane crosses a closed mesh, the per-face crossing segments
     stitch into rings — the cross-section of the material itself. Adjacent
     faces share a mesh edge, so both sides interpolate the same point;
     quantising absorbs the last-bit difference when the edge is walked
     in opposite directions. */
  function sectionRings(mesh, wx, wy, wz, pl) {
    var faces = mesh.f, i, j, f, idx, len, ai, bi, sa, sb, t, hit;
    var segs = [];
    for (i = 0; i < faces.length; i++) {
      f = faces[i]; idx = f.i; len = idx.length; hit = null;
      for (j = 0; j < len; j++) {
        ai = idx[j]; bi = idx[(j + 1) % len];
        sa = wx[ai] * pl[0] + wy[ai] * pl[1] + wz[ai] * pl[2] - pl[3];
        sb = wx[bi] * pl[0] + wy[bi] * pl[1] + wz[bi] * pl[2] - pl[3];
        if ((sa > 0) === (sb > 0)) continue;
        t = sa / (sa - sb);
        if (!hit) hit = [];
        hit.push(wx[ai] + (wx[bi] - wx[ai]) * t,
                 wy[ai] + (wy[bi] - wy[ai]) * t,
                 wz[ai] + (wz[bi] - wz[ai]) * t);
      }
      if (hit && hit.length === 6) segs.push(hit);
    }
    if (segs.length < 3) return null;

    function key(a, b, c) { return Math.round(a * 32) + "," + Math.round(b * 32) + "," + Math.round(c * 32); }
    var ends = Object.create(null), used = new Array(segs.length), rings = [], k, s, cand, nxt, guard;
    for (i = 0; i < segs.length; i++) {
      for (j = 0; j < 2; j++) {
        k = key(segs[i][j * 3], segs[i][j * 3 + 1], segs[i][j * 3 + 2]);
        if (ends[k]) ends[k].push(i); else ends[k] = [i];
      }
    }
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      var ring = [segs[i][0], segs[i][1], segs[i][2]];
      var ex = segs[i][3], ey = segs[i][4], ez = segs[i][5];
      for (guard = 0; guard <= segs.length; guard++) {
        ring.push(ex, ey, ez);
        cand = ends[key(ex, ey, ez)];
        nxt = -1;
        if (cand) for (j = 0; j < cand.length; j++) if (!used[cand[j]]) { nxt = cand[j]; break; }
        if (nxt < 0) break;
        used[nxt] = 1;
        s = segs[nxt];
        if (key(s[0], s[1], s[2]) === key(ex, ey, ez)) { ex = s[3]; ey = s[4]; ez = s[5]; }
        else { ex = s[0]; ey = s[1]; ez = s[2]; }
      }
      if (ring.length >= 9) rings.push(ring);
    }
    return rings.length ? rings : null;
  }

  Scene.prototype.render = function () {
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var ctx = this.ctx, W = this._w, H = this._h, dpr = this._dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var V = this._view();
    var focal = (H / 2) / Math.tan(this.camera.fov / 2);
    var cx = W / 2, cy = H / 2;
    var q = this._queue;
    q.length = 0;

    var pi, p, i, j, k, m, mv, n3, x, y, z, vx, vy, vz, inv;
    var lightX = this._light[0], lightY = this._light[1], lightZ = this._light[2];
    var clip = this.clip;

    /* clipping makes vertices the mesh never had, so they project here
       rather than out of the part's cached screen arrays */
    var projDepth = 0;
    function projRing(w) {
      var out = new Float64Array(w.length / 3 * 2), n = w.length / 3, q, px, py, pz, pd, dsum = 0;
      for (q = 0; q < n; q++) {
        px = w[q * 3]; py = w[q * 3 + 1]; pz = w[q * 3 + 2];
        var ax = V[0] * px + V[1] * py + V[2] * pz + V[3];
        var ay = V[4] * px + V[5] * py + V[6] * pz + V[7];
        var az = V[8] * px + V[9] * py + V[10] * pz + V[11];
        pd = -az; if (pd < 1) pd = 1;
        dsum += pd;
        out[q * 2] = cx + ax * (focal / pd);
        out[q * 2 + 1] = cy - ay * (focal / pd);
      }
      projDepth = dsum / n;
      return out;
    }
    function ringArea(pts) {
      var s = 0, q, n = pts.length / 2;
      for (q = 0; q < n; q++) s += pts[q * 2] * pts[((q + 1) % n) * 2 + 1] - pts[((q + 1) % n) * 2] * pts[q * 2 + 1];
      return s;
    }

    for (pi = 0; pi < this.parts.length; pi++) {
      p = this.parts[pi];
      if (!p.visible) { p._box = null; continue; }
      m = this._world(p);
      mv = mMul(V, m);
      var v = p.mesh.v, nv = v.length / 3;
      var sx = p._sx && p._sx.length === nv ? p._sx : (p._sx = new Float64Array(nv));
      var sy = p._sy && p._sy.length === nv ? p._sy : (p._sy = new Float64Array(nv));
      var sd = p._sd && p._sd.length === nv ? p._sd : (p._sd = new Float64Array(nv));
      var wx = p._wx && p._wx.length === nv ? p._wx : (p._wx = new Float64Array(nv));
      var wy = p._wy && p._wy.length === nv ? p._wy : (p._wy = new Float64Array(nv));
      var wz = p._wz && p._wz.length === nv ? p._wz : (p._wz = new Float64Array(nv));
      var bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, bd = 1e9;
      for (i = 0; i < nv; i++) {
        x = v[i * 3]; y = v[i * 3 + 1]; z = v[i * 3 + 2];
        wx[i] = m[0] * x + m[1] * y + m[2] * z + m[3];
        wy[i] = m[4] * x + m[5] * y + m[6] * z + m[7];
        wz[i] = m[8] * x + m[9] * y + m[10] * z + m[11];
        vx = mv[0] * x + mv[1] * y + mv[2] * z + mv[3];
        vy = mv[4] * x + mv[5] * y + mv[6] * z + mv[7];
        vz = mv[8] * x + mv[9] * y + mv[10] * z + mv[11];
        var d = -vz;
        if (d < 1) d = 1;
        sd[i] = d;
        inv = focal / d;
        sx[i] = cx + vx * inv;
        sy[i] = cy - vy * inv;
        if (sx[i] < bx0) bx0 = sx[i];
        if (sx[i] > bx1) bx1 = sx[i];
        if (sy[i] < by0) by0 = sy[i];
        if (sy[i] > by1) by1 = sy[i];
        if (d < bd) bd = d;
      }
      p._box = p.pickable ? [bx0, by0, bx1, by1, bd] : null;

      var pal = this._pal[p.style] || this._pal.solid;
      var faces = p.mesh.f, front = p._front && p._front.length === faces.length ? p._front : (p._front = new Uint8Array(faces.length));
      var ghost = p.style === "ghost";
      var cut = !!clip && p.clippable;

      for (i = 0; i < faces.length; i++) {
        var f = faces[i];
        if (f.t > 0 && this.lod >= 1) { front[i] = 0; continue; }
        var idx = f.i, len = idx.length;
        /* signed screen area — negative means we are looking at the outside */
        var area = 0, depth = 0, a0, b0;
        for (j = 0; j < len; j++) {
          a0 = idx[j]; b0 = idx[(j + 1) % len];
          area += sx[a0] * sy[b0] - sx[b0] * sy[a0];
          depth += sd[a0];
        }
        front[i] = area < 0 ? 1 : 0;
        if (ghost) continue;
        depth /= len;

        /* shade from the world normal, lit from over the viewer's left shoulder */
        n3 = f.n;
        var nx = m[0] * n3[0] + m[1] * n3[1] + m[2] * n3[2];
        var ny = m[4] * n3[0] + m[5] * n3[1] + m[6] * n3[2];
        var nz = m[8] * n3[0] + m[9] * n3[1] + m[10] * n3[2];
        var lam = nx * lightX + ny * lightY + nz * lightZ;
        var band = lam > 0.45 ? 0 : (lam > -0.05 ? 1 : 2);

        if (!cut) {
          if (!front[i] || Math.abs(area) < 3) continue;
          q.push({ k: 0, d: depth, p: p, idx: idx, pal: pal, band: band });
          continue;
        }

        /* sectioned: the far side of the wall is what the opening reveals,
           so back faces are drawn too — flat and unlit, behind the cut */
        var r = clipRing(idx, wx, wy, wz, clip);
        if (r === CLIP_OUT) continue;
        if (r === CLIP_IN) {
          if (!front[i] || Math.abs(area) < 3) continue;
          q.push({ k: 0, d: depth, p: p, idx: idx, pal: pal, band: band });
          continue;
        }
        var pts = projRing(r);
        if (Math.abs(ringArea(pts)) < 3) continue;
        if (front[i]) q.push({ k: 0, d: projDepth, p: p, pts: pts, pal: pal, band: band });
        else q.push({ k: 0, d: projDepth, p: p, pts: pts, pal: pal, band: band, flat: this._cutBack });
      }

      /* fill the ring the cut exposes, so a sliced solid reads as solid */
      if (cut && !ghost) {
        var rings = sectionRings(p.mesh, wx, wy, wz, clip);
        if (rings) {
          var capPts = [], capD = 0;
          for (i = 0; i < rings.length; i++) { capPts.push(projRing(rings[i])); capD += projDepth; }
          q.push({ k: 3, d: capD / rings.length - 1.5, p: p, rings: capPts, pal: pal, hand: pi & 1 });
        }
      }

      var edges = p.mesh.e;
      for (i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (e.t > 0 && this.lod >= 1) continue;
        var f0 = e.f0, f1 = e.f1, sil;
        if (f0 === -2) sil = true;                       /* merged sub-mesh: keep every baked edge */
        else if (f1 < 0) sil = !!front[f0];
        else sil = front[f0] !== front[f1];
        if (!sil && !e.c) continue;
        if (!sil && !front[f0] && !front[f1]) continue;
        if (ghost && !sil) continue;
        var ed = (sd[e.a] + sd[e.b]) * 0.5 - 0.8;
        if (cut) {
          /* trim the line to the plane rather than dropping it whole —
             dropping is what made the cut edge look torn */
          var da = wx[e.a] * clip[0] + wy[e.a] * clip[1] + wz[e.a] * clip[2] - clip[3];
          var db = wx[e.b] * clip[0] + wy[e.b] * clip[1] + wz[e.b] * clip[2] - clip[3];
          if (da > 0 && db > 0) continue;
          if (da > 0 || db > 0) {
            var tt = da / (da - db);
            var wpt = [wx[e.a] + (wx[e.b] - wx[e.a]) * tt,
                       wy[e.a] + (wy[e.b] - wy[e.a]) * tt,
                       wz[e.a] + (wz[e.b] - wz[e.a]) * tt];
            var ip = projRing(wpt);
            if (da > 0) q.push({ k: 1, d: ed, p: p, ax: ip[0], ay: ip[1], bx: sx[e.b], by: sy[e.b], pal: pal, sil: sil, ghost: ghost });
            else q.push({ k: 1, d: ed, p: p, ax: sx[e.a], ay: sy[e.a], bx: ip[0], by: ip[1], pal: pal, sil: sil, ghost: ghost });
            continue;
          }
        }
        q.push({ k: 1, d: ed, p: p, a: e.a, b: e.b, pal: pal, sil: sil, ghost: ghost });
      }

      var wires = p.mesh.w;
      if (this.lod < 1) {
        for (i = 0; i < wires.length; i++) {
          var loop = wires[i], wd = 0;
          if (cut) {
            var wr = clipRing(loop, wx, wy, wz, clip);
            if (wr === CLIP_OUT) continue;
            if (wr !== CLIP_IN) {
              q.push({ k: 2, d: projDepth - 1.0, p: p, pts: projRing(wr), pal: pal, open: true });
              continue;
            }
          }
          for (j = 0; j < loop.length; j++) wd += sd[loop[j]];
          q.push({ k: 2, d: wd / loop.length - 1.0, p: p, loop: loop, pal: pal });
        }
      }
    }

    q.sort(function (A, B) { return B.d - A.d; });

    var hatch = (this.lod < 2) ? this._hatchPattern() : null;
    var section = clip ? [this._sectionPattern(0), this._sectionPattern(1)] : null;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (i = 0; i < q.length; i++) {
      var it = q[i];
      var psx = it.p._sx, psy = it.p._sy;
      if (it.k === 0) {
        ctx.beginPath();
        if (it.pts) {
          ctx.moveTo(it.pts[0], it.pts[1]);
          for (j = 1; j < it.pts.length / 2; j++) ctx.lineTo(it.pts[j * 2], it.pts[j * 2 + 1]);
        } else {
          var ii = it.idx;
          ctx.moveTo(psx[ii[0]], psy[ii[0]]);
          for (j = 1; j < ii.length; j++) ctx.lineTo(psx[ii[j]], psy[ii[j]]);
        }
        ctx.closePath();
        ctx.fillStyle = it.flat || it.pal.wash[it.band];
        ctx.fill();
        /* while a cut is open, hatching means "the plane passes through here"
           and nothing else — the shading hatch would read as a second cut */
        if (!it.flat && !clip && it.band === 2 && hatch && it.pal.hatch) { ctx.fillStyle = hatch; ctx.fill(); }
      } else if (it.k === 1) {
        ctx.beginPath();
        if (it.ax != null) { ctx.moveTo(it.ax, it.ay); ctx.lineTo(it.bx, it.by); }
        else { ctx.moveTo(psx[it.a], psy[it.a]); ctx.lineTo(psx[it.b], psy[it.b]); }
        if (it.ghost) { ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = it.pal.stroke; }
        else if (it.sil) { ctx.setLineDash(EMPTY_DASH); ctx.lineWidth = 1.5; ctx.strokeStyle = it.pal.stroke; }
        else { ctx.setLineDash(EMPTY_DASH); ctx.lineWidth = 0.85; ctx.strokeStyle = it.pal.soft; }
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);
      } else if (it.k === 3) {
        /* the section face: one path of every ring, so bores read as holes */
        ctx.beginPath();
        for (k = 0; k < it.rings.length; k++) {
          var rg = it.rings[k];
          ctx.moveTo(rg[0], rg[1]);
          for (j = 1; j < rg.length / 2; j++) ctx.lineTo(rg[j * 2], rg[j * 2 + 1]);
          ctx.closePath();
        }
        ctx.fillStyle = this._cutFill;
        ctx.fill("evenodd");
        if (section && it.pal.hatch) { ctx.fillStyle = section[it.hand]; ctx.fill("evenodd"); }
        ctx.setLineDash(EMPTY_DASH);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = it.pal.stroke;
        ctx.stroke();
      } else {
        ctx.beginPath();
        if (it.pts) {
          ctx.moveTo(it.pts[0], it.pts[1]);
          for (j = 1; j < it.pts.length / 2; j++) ctx.lineTo(it.pts[j * 2], it.pts[j * 2 + 1]);
          if (!it.open) ctx.closePath();
        } else {
          var lp = it.loop;
          ctx.moveTo(psx[lp[0]], psy[lp[0]]);
          for (j = 1; j < lp.length; j++) ctx.lineTo(psx[lp[j]], psy[lp[j]]);
          ctx.closePath();
        }
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = it.pal.soft;
        ctx.stroke();
      }
    }

    this.stats.faces = q.length;
    this.stats.ms = ((window.performance && performance.now) ? performance.now() : 0) - t0;
    this.dirty = false;
    this._govern(this.stats.ms);
  };

  /* Perf governor: if frames get expensive, shed the rim detail first,
     then the hatching. Climbs back up only after a sustained easy patch. */
  Scene.prototype._govern = function (ms) {
    var f = this._frames;
    f.push(ms);
    if (f.length > 40) f.shift();
    if (f.length < 30) return;
    var avg = 0, i;
    for (i = 0; i < f.length; i++) avg += f[i];
    avg /= f.length;
    if (avg > 20 && this.lod < 2) { this.lod++; f.length = 0; }
    else if (avg < 8 && this.lod > 0) { this.lod--; f.length = 0; }
  };

  Scene.prototype.start = function (tick) {
    var self = this, last = 0;
    cancelAnimationFrame(this._raf);
    /* A page that loads in a background tab must still have a frame waiting
       when it comes forward — otherwise `dirty` is already false and the
       canvas stays empty. */
    if (!this._visWired) {
      this._visWired = true;
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { last = 0; self.dirty = true; }
      });
    }
    function frame(now) {
      self._raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (tick) tick(dt, now);
      if (self.dirty || self.animating) self.render();
    }
    this._raf = requestAnimationFrame(frame);
  };
  Scene.prototype.stop = function () { cancelAnimationFrame(this._raf); this._raf = 0; };

  Scene.prototype.pick = function (x, y) {
    var best = null, i, p, b;
    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i]; b = p._box;
      if (!b) continue;
      if (x < b[0] - 2 || x > b[2] + 2 || y < b[1] - 2 || y > b[3] + 2) continue;
      if (!best || b[4] < best._box[4]) best = p;
    }
    return best;
  };

  return {
    reducedMotion: RM,
    scene: function (canvas) { return new Scene(canvas); },
    prism: prism,
    revolve: revolve,
    merge: merge,
    xform: xform,
    gearMesh: gearMesh,
    dogRingMesh: dogRingMesh,
    gearProfile: gearProfile,
    circleProfile: circleProfile,
    rectProfile: rectProfile,
    arcBandProfile: arcBandProfile,
    mRX: mRX, mRY: mRY, mRZ: mRZ, mT: mT, mMul: mMul, mIdent: mIdent
  };
})();
