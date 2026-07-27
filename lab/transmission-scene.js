/* ═══════════════════════════════════════════════════════════════
   THE GEAR CHANGE — scene, kinematics, and the shift machine
   ───────────────────────────────────────────────────────────────
   A 5-speed rear-drive gearbox built out of Ink3D primitives.

   World axes: +x runs down the shafts (front of the box at -x),
   +y is up, +z is toward the near side. The mainshaft sits on the
   x-axis; the countershaft 100 units below it.

   Every gear's angle is DERIVED from the gear driving it, never
   integrated on its own — that is what keeps teeth interleaving
   instead of drifting through each other. Only the input shaft
   and the mainshaft carry an integrated angle.
   ═══════════════════════════════════════════════════════════════ */

var TXScene = (function () {
  "use strict";

  var TAU = Math.PI * 2, HALF_PI = Math.PI / 2;
  var VIS = 0.02;            // radians of drawn rotation per radian of real shaft rotation
  var C = 100;               // main-to-counter centre distance

  /* axis centres as [y, z] */
  var AX_MAIN = [0, 0];
  var AX_CNT = [-C, 0];
  var AX_IDL = [-69.683, -51.08];   // the only place a circle 59.4 from the counter and 86.4 from the main can sit

  /* A gear's local +x points at world -z and its local +y at world +y,
     because every drivetrain part is rotated to put its axis on world x. */
  function bearing(from, to) { return Math.atan2(to[0] - from[0], -(to[1] - from[1])); }

  /* Driven-gear angle that keeps a tooth of the driver facing a gap of the
     driven at the line of centres, for every angle of the driver. */
  function meshAngle(theta1, phi, Z1, Z2) {
    return phi + Math.PI + Math.PI / Z2 - (Z1 / Z2) * (theta1 - phi);
  }

  var PHI_M2C = bearing(AX_MAIN, AX_CNT);
  var PHI_C2M = bearing(AX_CNT, AX_MAIN);
  var PHI_C2I = bearing(AX_CNT, AX_IDL);
  var PHI_I2M = bearing(AX_IDL, AX_MAIN);

  /* ── the gear set ── */
  var Z_IN = 17, Z_CD = 29, M_DRIVE = 2 * C / (Z_IN + Z_CD);
  var DRIVE = Z_CD / Z_IN;   // countershaft turns this much slower than the input

  var SET = {
    1: { Zc: 16, Zm: 34, x: 188, w: 18 },
    2: { Zc: 26, Zm: 32, x: 112, w: 18 },
    3: { Zc: 28, Zm: 23, x: 78, w: 16 },
    5: { Zc: 32, Zm: 15, x: 282, w: 16 }
  };
  var K;
  for (K in SET) { SET[K].m = 2 * C / (SET[K].Zc + SET[K].Zm); }
  var M_REV = 3.6, Z_RC = 15, Z_RI = 18, Z_RM = 30, X_REV = 216;

  var RATIO = {
    1: DRIVE * SET[1].Zm / SET[1].Zc,
    2: DRIVE * SET[2].Zm / SET[2].Zc,
    3: DRIVE * SET[3].Zm / SET[3].Zc,
    4: 1,
    5: DRIVE * SET[5].Zm / SET[5].Zc,
    "-1": -DRIVE * Z_RM / Z_RC
  };

  /* stations and travel */
  var X_HUB34 = 40, X_HUB12 = 150, X_HUB5 = 246;
  var TRAVEL = 13, IDLER_TRAVEL = 24, X_IDLER_PARK = 240;

  /* Which assembly each gear engages, and which way its sleeve slides. */
  var ASM = {
    1: { hub: "hub12", slv: "slv12", cb: "cb1", blk: "blk1", fork: "fork12", rod: "rod12", dir: 1, rail: 0, row: 1 },
    2: { hub: "hub12", slv: "slv12", cb: "cb2", blk: "blk2", fork: "fork12", rod: "rod12", dir: -1, rail: 0, row: -1 },
    3: { hub: "hub34", slv: "slv34", cb: "cb3", blk: "blk3", fork: "fork34", rod: "rod34", dir: 1, rail: 1, row: 1 },
    4: { hub: "hub34", slv: "slv34", cb: "cb4", blk: "blk4", fork: "fork34", rod: "rod34", dir: -1, rail: 1, row: -1 },
    5: { hub: "hub5", slv: "slv5", cb: "cb5", blk: "blk5", fork: "fork5", rod: "rod5R", dir: 1, rail: 2, row: 1 },
    "-1": { hub: null, slv: null, cb: null, blk: null, fork: "forkR", rod: "rod5R", dir: -1, rail: 2, row: -1 }
  };

  var TORQUE = {
    1: ["shaftInput", "gInMain", "gInCounter", "shaftCounter", "g1Counter", "g1Main", "cb1", "slv12", "hub12", "shaftMain"],
    2: ["shaftInput", "gInMain", "gInCounter", "shaftCounter", "g2Counter", "g2Main", "cb2", "slv12", "hub12", "shaftMain"],
    3: ["shaftInput", "gInMain", "gInCounter", "shaftCounter", "g3Counter", "g3Main", "cb3", "slv34", "hub34", "shaftMain"],
    4: ["shaftInput", "cb4", "slv34", "hub34", "shaftMain"],
    5: ["shaftInput", "gInMain", "gInCounter", "shaftCounter", "g5Counter", "g5Main", "cb5", "slv5", "hub5", "shaftMain"],
    "-1": ["shaftInput", "gInMain", "gInCounter", "shaftCounter", "gRCounter", "gRIdler", "gRMain", "shaftMain"]
  };

  /* rod positions in the transverse plane, as [y, z] */
  var ROD = { rod12: [78, -26], rod34: [86, 0], rod5R: [78, 26] };
  var LEVER_PIVOT = [26, 150, 0];

  /* ── easing ── */
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function easeInOut(x) { x = clamp01(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeOut(x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); }
  function easeIn(x) { x = clamp01(x); return x * x * x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ═══ GEOMETRY ═══ */

  function shaftMesh(r, len) {
    return Ink3D.revolve([r, -len / 2, r, len / 2, 0, len / 2, 0, -len / 2], 16, { tier: 0 });
  }
  /* hub: splined boss keyed to the shaft */
  function hubMesh(rOut, rIn, w) {
    return Ink3D.revolve([rIn, -w / 2, rOut, -w / 2, rOut, w / 2, rIn, w / 2], 16);
  }
  /* sleeve: a collar with a fork groove turned into its outside */
  function sleeveMesh(rOut, rIn, w) {
    var g = rOut - 3.5, h = w / 2, q = w * 0.22;
    return Ink3D.revolve([
      rIn, -h, rOut, -h, rOut, -q, g, -q * 0.6, g, q * 0.6, rOut, q, rOut, h, rIn, h
    ], 16);
  }
  /* blocker (baulk) ring: the cone that has to be spun into agreement first */
  function blockerMesh(r0, r1, w) {
    var h = w / 2;
    var body = Ink3D.revolve([r0 - 3, -h, r0, -h, r1, h, r1 - 3, h], 14);
    return Ink3D.merge(body, Ink3D.dogRingMesh(r1 - 1, r1 + 3.5, w * 0.9, 8, 0.42, 1));
  }
  /* clutch body: the cone and the dog teeth the sleeve finally locks onto.
     Mirroring the section for the other-facing bodies would reverse its
     winding, so flip the point order back to keep normals pointing out. */
  function clutchBodyMesh(rCone, rDog, w, dir) {
    var h = w / 2;
    var sec = [rCone - 8, -h * dir, rCone, h * dir, rCone - 3, h * dir, rCone - 9, -h * dir];
    if (dir < 0) sec = [sec[6], sec[7], sec[4], sec[5], sec[2], sec[3], sec[0], sec[1]];
    var dogs = Ink3D.dogRingMesh(rDog - 3.5, rDog, w * 0.85, 8, 0.45, dir);
    return Ink3D.merge(Ink3D.revolve(sec, 14), dogs);
  }
  /* shift fork: an arc that straddles the sleeve groove, hung off a rod above */
  function forkMesh(rIn, rOut, rodLocal, w) {
    var arc = Ink3D.prism(Ink3D.arcBandProfile(rIn, rOut, 0.28, Math.PI - 0.28, 18), w, { sideTier: 1 });
    var rx = rodLocal[0], ry = rodLocal[1];
    var stem = Ink3D.prism([-4.5, rOut - 3, 4.5, rOut - 3, rx + 5, ry, rx - 5, ry], w * 0.8, { sideTier: 1 });
    var boss = Ink3D.revolve([5.5, -w * 0.55, 10, -w * 0.55, 10, w * 0.55, 5.5, w * 0.55], 12);
    Ink3D.xform(boss, Ink3D.mT(rx, ry, 0));
    return Ink3D.merge(Ink3D.merge(arc, stem), boss);
  }
  /* the gearbox case, as a two-circle outline you can see through */
  function caseMesh(len) {
    var pts = [], i, a;
    for (i = 0; i <= 18; i++) { a = -0.12 + (Math.PI + 0.24) * i / 18; pts.push(Math.cos(a) * 88, Math.sin(a) * 88); }
    for (i = 0; i <= 18; i++) { a = Math.PI - 0.12 + (Math.PI + 0.24) * i / 18; pts.push(Math.cos(a) * 92, Math.sin(a) * 92 - C); }
    return Ink3D.prism(pts, len, { sideTier: 1 });
  }

  /* ═══ SCENE ASSEMBLY ═══ */

  function build(canvas) {
    var sc = Ink3D.scene(canvas);
    var AXROT = [0, HALF_PI, 0];   // put a part's local z on the world x axis
    var P = {};

    function drivetrain(id, mesh, x, axis, opt) {
      opt = opt || {};
      var p = sc.add({
        id: id, mesh: mesh, rot: AXROT,
        pos: [x, axis[0], axis[1]],
        style: opt.style || "solid",
        group: opt.group || "core",
        label: opt.label || "",
        pickable: opt.label ? true : false,
        /* a cutaway that spares half the assembly is not a cutaway —
           everything on the bench takes the plane unless it opts out */
        clippable: opt.clip !== 0,
        explode: opt.explode || [0, 0, 0]
      });
      P[id] = p;
      return p;
    }

    /* shafts */
    drivetrain("shaftInput", shaftMesh(16, 108), -16, AX_MAIN, { label: "Input shaft — the engine's end of the box", clip: 1 });
    drivetrain("shaftMain", shaftMesh(14, 280), 168, AX_MAIN, { label: "Mainshaft — the road's end of the box", clip: 1 });
    drivetrain("shaftCounter", shaftMesh(16, 330), 145, AX_CNT, { label: "Countershaft — always turning with the engine", clip: 1 });

    /* Exploded opens the stack the way it was assembled: along the shaft
       first, so assembly order is legible, then off the shaft by how deep
       in the stack the part sits. Shafts hold still — they are the spine
       everything else came off. The countershaft train drops clear of the
       mainshaft, and the idler leaves along its own centre line, the one
       direction that clears both. */
    var SPREAD = 0.5, MID = 140, DROP = -46;
    function ex(x, lift, dz) { return [(x - MID) * SPREAD, lift, dz || 0]; }
    var LIFT_CB = 26, LIFT_HUB = 54, LIFT_BLK = 78, LIFT_SLV = 100;
    var X_IDLER = [(X_IDLER_PARK - MID) * SPREAD, 46, -74];

    /* the constant-mesh drive pair: the engine reaches the countershaft and never lets go */
    drivetrain("gInMain", Ink3D.gearMesh(Z_IN, M_DRIVE, 16, 16), 0, AX_MAIN, { label: "Input gear · 17 teeth", explode: ex(0, 0) });
    drivetrain("gInCounter", Ink3D.gearMesh(Z_CD, M_DRIVE, 16, 16), 0, AX_CNT, { label: "Counter drive gear · 29 teeth", explode: ex(0, DROP) });

    /* speed gears — counter half fixed to the shaft, main half free to spin until a sleeve says otherwise */
    [1, 2, 3, 5].forEach(function (g) {
      var s = SET[g];
      drivetrain("g" + g + "Counter", Ink3D.gearMesh(s.Zc, s.m, s.w, 16), s.x, AX_CNT,
        { group: "g" + g, explode: ex(s.x, DROP), label: g + (g === 1 ? "st" : g === 2 ? "nd" : g === 3 ? "rd" : "th") + " drive gear · " + s.Zc + " teeth" });
      drivetrain("g" + g + "Main", Ink3D.gearMesh(s.Zm, s.m, s.w, 15), s.x, AX_MAIN,
        { group: "g" + g, explode: ex(s.x, 0), label: g + (g === 1 ? "st" : g === 2 ? "nd" : g === 3 ? "rd" : "th") + " gear · " + s.Zm + " teeth · free on the shaft" });
    });

    /* reverse: two meshes in series, which is the whole trick — the output comes back the other way */
    drivetrain("gRCounter", Ink3D.gearMesh(Z_RC, M_REV, 14, 16), X_REV, AX_CNT, { group: "gR", explode: ex(X_REV, DROP), label: "Reverse drive gear · 15 teeth" });
    drivetrain("gRMain", Ink3D.gearMesh(Z_RM, M_REV, 14, 15), X_REV, AX_MAIN, { group: "gR", explode: ex(X_REV, 0), label: "Reverse gear · 30 teeth · fixed to the mainshaft" });
    drivetrain("gRIdler", Ink3D.gearMesh(Z_RI, M_REV, 14, 9), X_IDLER_PARK, AX_IDL, { group: "gR", explode: X_IDLER, label: "Reverse idler · slides into mesh, and nothing slows it down first" });

    /* synchro assemblies */
    P.hub34 = drivetrain("hub34", hubMesh(30, 14, 14), X_HUB34, AX_MAIN, { group: "dogs", label: "3-4 hub · splined to the mainshaft", clip: 1, explode: ex(X_HUB34, LIFT_HUB) });
    P.slv34 = drivetrain("slv34", sleeveMesh(37, 30, 18), X_HUB34, AX_MAIN, { group: "dogs", label: "3-4 sleeve · the only part the driver actually moves", clip: 1, explode: ex(X_HUB34, LIFT_SLV) });
    P.hub12 = drivetrain("hub12", hubMesh(30, 14, 14), X_HUB12, AX_MAIN, { group: "dogs", label: "1-2 hub · splined to the mainshaft", clip: 1, explode: ex(X_HUB12, LIFT_HUB) });
    P.slv12 = drivetrain("slv12", sleeveMesh(37, 30, 18), X_HUB12, AX_MAIN, { group: "dogs", label: "1-2 sleeve", clip: 1, explode: ex(X_HUB12, LIFT_SLV) });
    P.hub5 = drivetrain("hub5", hubMesh(28, 14, 14), X_HUB5, AX_MAIN, { group: "dogs", label: "5th hub", clip: 1, explode: ex(X_HUB5, LIFT_HUB) });
    P.slv5 = drivetrain("slv5", sleeveMesh(35, 28, 18), X_HUB5, AX_MAIN, { group: "dogs", label: "5th sleeve", clip: 1, explode: ex(X_HUB5, LIFT_SLV) });

    /* clutch bodies (cone + dogs) and the blocker rings that guard them */
    var CB = [
      ["cb4", 20, AX_MAIN, -1, "4th clutch body · on the input shaft, so 4th is straight through"],
      ["cb3", 60, AX_MAIN, 1, "3rd clutch body · cone and dog teeth"],
      ["cb2", 130, AX_MAIN, -1, "2nd clutch body"],
      ["cb1", 170, AX_MAIN, 1, "1st clutch body"],
      ["cb5", 266, AX_MAIN, 1, "5th clutch body"]
    ];
    CB.forEach(function (c) {
      drivetrain(c[0], clutchBodyMesh(25, 27, 13, c[3]), c[1], c[2], { group: "dogs", label: c[4], clip: 1, explode: ex(c[1], LIFT_CB) });
    });
    var BLK = [["blk4", 30, -1], ["blk3", 50, 1], ["blk2", 140, -1], ["blk1", 160, 1], ["blk5", 256, 1]];
    BLK.forEach(function (b) {
      drivetrain(b[0], blockerMesh(26, 23, 6), b[1], AX_MAIN,
        { group: "synchro", label: "Blocker ring · refuses to index until the speeds agree", clip: 1, explode: ex(b[1], LIFT_BLK) });
    });

    /* selector rods, forks, and the interlock that makes two gears at once unsayable */
    /* the 5-R rod gets its own group: the reverse layer needs it without
       dragging the whole gate assembly into a shot about the idler */
    Object.keys(ROD).forEach(function (id) {
      drivetrain(id, shaftMesh(5, 300), 150, ROD[id],
        { group: id === "rod5R" ? "selectR" : "select", label: "Selector rod", clip: 1, explode: [0, 44, 0] });
    });
    function fork(id, x, rodId, rIn, rOut, label) {
      var r = ROD[rodId];
      var local = [-r[1], r[0]];   // world (y,z) → the part's local (x,y)
      var p = sc.add({
        id: id, mesh: forkMesh(rIn, rOut, local, 8), rot: AXROT, pos: [x, 0, 0],
        group: "select", label: label, pickable: true, clippable: true,
        explode: ex(x, LIFT_SLV)   // a fork never leaves the sleeve groove it straddles
      });
      P[id] = p;
      return p;
    }
    fork("fork34", X_HUB34, "rod34", 37, 43, "3-4 shift fork");
    fork("fork12", X_HUB12, "rod12", 37, 43, "1-2 shift fork");
    fork("fork5", X_HUB5, "rod5R", 35, 41, "5th shift fork");
    /* the reverse fork reaches all the way from the top rod down to the idler */
    P.forkR = sc.add({
      id: "forkR",
      mesh: forkMesh(32, 38, [-(ROD.rod5R[1] - AX_IDL[1]), ROD.rod5R[0] - AX_IDL[0]], 8),
      rot: AXROT, pos: [X_IDLER_PARK, AX_IDL[0], AX_IDL[1]], explode: X_IDLER,
      group: "gR", label: "Reverse fork · no synchro on this one", pickable: true, clippable: true
    });

    P.interlock = sc.add({
      id: "interlock", mesh: Ink3D.prism(Ink3D.rectProfile(70, 26, 0, 82), 16, { sideTier: 1 }),
      rot: AXROT, pos: [34, 0, 0], group: "select", clippable: true,
      label: "Interlock block · two rods can never move at once", pickable: true
    });

    /* lever and gate */
    var shaft = shaftMesh(5.5, 92);
    Ink3D.xform(shaft, Ink3D.mT(0, 0, 46));
    var knob = Ink3D.revolve([0, 88, 11, 94, 11, 104, 0, 110], 14);
    var lower = shaftMesh(7, 30);
    Ink3D.xform(lower, Ink3D.mT(0, 0, -15));
    var lever = Ink3D.merge(Ink3D.merge(shaft, knob), lower);
    Ink3D.xform(lever, Ink3D.mRX(-HALF_PI));
    P.lever = sc.add({
      id: "lever", mesh: lever, pos: LEVER_PIVOT, group: "select", clippable: true,
      label: "Gear lever — the only control the driver has", pickable: true
    });

    var plate = Ink3D.prism(Ink3D.rectProfile(96, 74), 4, { sideTier: 1 });
    Ink3D.xform(plate, Ink3D.mRX(HALF_PI));
    P.gate = sc.add({
      id: "gate", mesh: plate, pos: [26, 118, 0], group: "select", style: "dim",
      clippable: true, label: "Gate plate — the H, cut in steel", pickable: true
    });

    P.gearcase = sc.add({
      id: "gearcase", mesh: caseMesh(330), rot: AXROT, pos: [140, 0, 0],
      style: "ghost", group: "case", clippable: true, label: ""
    });

    return { scene: sc, parts: P };
  }

  /* ═══ SHIFT PROFILES ═══
     A shift is a pure function of one normalised parameter, so the same
     definition serves autoplay, the scrubber, and reduced motion. */

  var PROFILES = {
    modern: { dur: 2600, segs: [
      ["clutchIn", 0, 0.14], ["neutral", 0.14, 0.26], ["gate", 0.26, 0.44],
      ["synchro", 0.44, 0.74], ["lock", 0.74, 0.84], ["clutchOut", 0.84, 1]
    ] },
    teach: { dur: 4800, segs: [
      ["clutchIn", 0, 0.10], ["neutral", 0.10, 0.19], ["gate", 0.19, 0.32],
      ["synchro", 0.32, 0.78], ["lock", 0.78, 0.88], ["clutchOut", 0.88, 1]
    ] },
    noSynchro: { dur: 2500, segs: [
      ["clutchIn", 0, 0.14], ["neutral", 0.14, 0.26], ["gate", 0.26, 0.44],
      ["dogTry", 0.44, 0.64], ["crash", 0.64, 0.84], ["recover", 0.84, 1]
    ] },
    noDogs: { dur: 2400, segs: [
      ["clutchIn", 0, 0.14], ["neutral", 0.14, 0.26], ["gate", 0.26, 0.44],
      ["slide", 0.44, 0.66], ["crash", 0.66, 0.84], ["recover", 0.84, 1]
    ] },
    interlock: { dur: 2500, segs: [
      ["clutchIn", 0, 0.12], ["gate", 0.12, 0.42], ["blocked", 0.42, 0.72], ["recover", 0.72, 1]
    ] },
    reverse: { dur: 3000, segs: [
      ["clutchIn", 0, 0.13], ["neutral", 0.13, 0.24], ["gate", 0.24, 0.44],
      ["slide", 0.44, 0.70], ["grind", 0.70, 0.86], ["clutchOut", 0.86, 1]
    ] }
  };

  function segAt(profile, t) {
    var segs = PROFILES[profile].segs, i;
    for (i = 0; i < segs.length; i++) {
      if (t < segs[i][2] || i === segs.length - 1) {
        return { name: segs[i][0], u: clamp01((t - segs[i][1]) / (segs[i][2] - segs[i][1])), i: i };
      }
    }
    return { name: segs[0][0], u: 0, i: 0 };
  }

  /* ═══ CONTROLLER ═══ */

  function create(canvas) {
    var built = build(canvas), sc = built.scene, P = built.parts;

    var S = {
      gear: 4, target: 4, clutch: 0,
      engineRpm: 2400, roadRpm: 2400 / RATIO[4],
      phase: "idle", phaseU: 0, delta: 0, crashed: false, blocked: false,
      profile: "modern", baseProfile: "modern", t: 0, playing: false, shake: 0,
      thInput: 0, thMain: 0, thCounter: 0,
      leverRail: 1, leverRow: -1,
      rod: { rod12: 0, rod34: 0, rod5R: 0 },
      sleeve: { slv12: 0, slv34: 0, slv5: 0 },
      block: { blk1: 0, blk2: 0, blk3: 0, blk4: 0, blk5: 0 },
      idler: 0, slideGear: 0, phaseAdj: {}, mode: "modern"
    };

    var listeners = [];
    var lastPhase = "";
    var hidden = {};
    var accented = [];
    var cameraHome = null;

    function emit(kind, payload) { listeners.forEach(function (fn) { fn(kind, payload); }); }

    /* ── kinematics: one integrated angle per driving shaft, everything else derived ── */
    function kinematics(dt) {
      var omegaIn = S.engineRpm * TAU / 60 * VIS;
      var omegaMain = S.roadRpm * TAU / 60 * VIS;
      S.thInput += omegaIn * dt;
      S.thMain += omegaMain * dt;
      S.thCounter = meshAngle(S.thInput, PHI_M2C, Z_IN, Z_CD);

      P.shaftInput.spin = S.thInput;
      P.gInMain.spin = S.thInput;
      P.cb4.spin = S.thInput;
      P.shaftMain.spin = S.thMain;
      P.shaftCounter.spin = S.thCounter;
      P.gInCounter.spin = S.thCounter;

      [1, 2, 3, 5].forEach(function (g) {
        var s = SET[g], adj = S.phaseAdj[g] || 0;
        P["g" + g + "Counter"].spin = S.thCounter;
        var a = meshAngle(S.thCounter, PHI_C2M, s.Zc, s.Zm) + adj;
        P["g" + g + "Main"].spin = a;
        P["cb" + g].spin = a;
      });
      /* the sliding-gear demo keys its gear to the shaft instead — that is the whole problem */
      if (S.slideGear) {
        P["g" + S.slideGear + "Main"].spin = S.thMain;
        P["g" + S.slideGear + "Main"].axial = S.slideAxial || 0;
      } else {
        P.g2Main.axial = 0;
      }

      P.gRCounter.spin = S.thCounter;
      var thIdler = meshAngle(S.thCounter, PHI_C2I, Z_RC, Z_RI);
      P.gRIdler.spin = thIdler;
      P.gRMain.spin = meshAngle(thIdler, PHI_I2M, Z_RI, Z_RM) + (S.phaseAdj[-1] || 0);

      /* hubs, sleeves and the mainshaft turn together */
      ["hub12", "hub34", "hub5", "slv12", "slv34", "slv5"].forEach(function (id) { P[id].spin = S.thMain; });
      P.slv12.axial = S.sleeve.slv12;
      P.slv34.axial = S.sleeve.slv34;
      P.slv5.axial = S.sleeve.slv5;
      P.fork12.axial = S.sleeve.slv12;
      P.fork34.axial = S.sleeve.slv34;
      P.fork5.axial = S.sleeve.slv5;
      P.rod12.axial = S.rod.rod12;
      P.rod34.axial = S.rod.rod34;
      P.rod5R.axial = S.rod.rod5R;
      P.gRIdler.axial = S.idler;
      P.forkR.axial = S.idler;

      /* a blocker ring rides its gear, held half a tooth out of index until the speeds agree */
      [1, 2, 3, 5].forEach(function (g) {
        var s = SET[g];
        P["blk" + g].spin = meshAngle(S.thCounter, PHI_C2M, s.Zc, s.Zm) + S.block["blk" + g] * Math.PI / 8;
      });
      P.blk4.spin = S.thInput + S.block.blk4 * Math.PI / 8;

      P.lever.dyn[0] = (S.leverRail - 1) * 0.30;
      P.lever.dyn[2] = S.leverRow * 0.26;

      sc.invalidate();
    }

    /* ── pose: everything the shift machine controls, as a function of t ── */
    function pose(t) {
      var prof = S.profile, sg = segAt(prof, t), a = ASM[S.from] || null, b = ASM[S.to] || null;
      var engaged = TRAVEL;
      S.phase = sg.name; S.phaseU = sg.u;
      S.crashed = false; S.blocked = false; S.shake = 0;

      /* clutch pedal */
      if (sg.name === "clutchIn") S.clutch = easeOut(sg.u);
      else if (sg.name === "clutchOut") S.clutch = 1 - easeInOut(sg.u);
      else S.clutch = sg.i === 0 ? 0 : 1;

      /* the sleeve we are leaving */
      var leaving = 0;
      if (sg.i <= 0) leaving = 1;
      else if (sg.name === "neutral") leaving = 1 - easeInOut(sg.u);
      if (a && a.slv) S.sleeve[a.slv] = leaving * engaged * a.dir;
      if (S.from === -1) S.idler = leaving * -IDLER_TRAVEL;

      /* The rail change. Under the interlock demo the lever never gets there:
         the pins stop it just under halfway, which is the point. */
      var reach = prof === "interlock" ? 0.45 : 1;
      var gateU = sg.name === "gate" ? reach * easeInOut(sg.u) : (sg.i > (prof === "interlock" ? 0 : 2) ? reach : 0);
      var fromRail = a ? a.rail : 1, toRail = b ? b.rail : 1;
      S.leverRail = lerp(fromRail, toRail, gateU);
      var fromRow = (sg.i <= 0 && a) ? a.row : 0;
      S.leverRow = sg.i <= 1 && a ? fromRow * (1 - (sg.name === "neutral" ? easeInOut(sg.u) : 0)) : 0;

      /* the row change and the sleeve we are entering */
      var enter = 0;
      if (sg.name === "synchro") enter = 0.62 * easeOut(sg.u);
      else if (sg.name === "lock") enter = 0.62 + 0.38 * easeIn(sg.u);
      else if (sg.name === "clutchOut") enter = 1;
      else if (sg.name === "dogTry") enter = 0.80 * easeOut(sg.u);
      else if (sg.name === "slide") enter = 0.88 * easeOut(sg.u);
      else if (sg.name === "crash") enter = 0.80 - 0.16 * Math.sin(sg.u * Math.PI * 6) * (1 - sg.u);
      else if (sg.name === "grind") enter = 0.86 + 0.14 * easeOut(sg.u);
      else if (sg.name === "recover") enter = 0.7 * (1 - easeInOut(sg.u));

      if (b && b.slv && sg.i >= 3) S.sleeve[b.slv] = enter * engaged * b.dir;
      if (sg.i >= 2) S.leverRow = (b ? b.row : 0) * Math.min(1, enter * 1.6 + (sg.name === "gate" ? 0 : 0));
      if (S.to === -1 && sg.i >= 3) S.idler = -enter * IDLER_TRAVEL;

      /* the sliding-gear crash box has no sleeve at all: the whole gear travels */
      if (prof === "noDogs") {
        S.slideGear = 2;
        S.slideAxial = -34 * (1 - enter);
        S.sleeve.slv12 = 0;
      } else { S.slideGear = 0; S.slideAxial = 0; }

      /* rods follow their forks; the interlock pins the rest */
      S.rod.rod12 = S.sleeve.slv12;
      S.rod.rod34 = S.sleeve.slv34;
      S.rod.rod5R = S.to === -1 || S.from === -1 ? (S.idler / IDLER_TRAVEL) * TRAVEL : S.sleeve.slv5;
      S.sleeve.slv5 = Math.max(-TRAVEL, Math.min(TRAVEL, S.rod.rod5R));

      /* speeds: road holds through the shift, the engine side is what has to move */
      var targetRpm = S.to && RATIO[S.to] ? Math.abs(S.roadRpm * RATIO[S.to]) : 850;
      var startRpm = S.startRpm;
      if (sg.i === 0) S.engineRpm = startRpm;
      else if (sg.name === "neutral" || sg.name === "gate") S.engineRpm = lerp(startRpm, startRpm * 0.86, easeOut(sg.i === 1 ? sg.u : 1));
      else if (sg.name === "synchro") S.engineRpm = lerp(startRpm * 0.86, targetRpm, easeOut(sg.u));
      else S.engineRpm = targetRpm;
      S.delta = Math.abs(S.engineRpm - targetRpm);

      /* the blocker ring holds half a tooth out of index until the difference dies */
      var blkKey = b && b.blk;
      Object.keys(S.block).forEach(function (k) { S.block[k] = 0; });
      if (blkKey && (sg.name === "synchro")) S.block[blkKey] = 1 - easeOut(Math.max(0, (sg.u - 0.55) / 0.45));
      else if (blkKey && sg.i >= 4) S.block[blkKey] = 0;
      else if (blkKey && sg.name === "dogTry") S.block[blkKey] = 0;

      /* failure branches */
      if (sg.name === "crash") {
        S.crashed = true;
        S.engineRpm = startRpm * 0.86;
        S.delta = Math.abs(S.engineRpm - targetRpm);
        S.shake = (1 - sg.u) * 2.4;
      }
      if (sg.name === "grind") { S.crashed = S.roadRpm > 60; S.shake = S.crashed ? (1 - sg.u) * 1.8 : 0; }
      if (sg.name === "blocked") {
        S.blocked = true;
        S.leverRail = lerp(fromRail, toRail, 0.45 + 0.06 * Math.sin(sg.u * Math.PI * 5));
        S.leverRow = 0;
        S.shake = 0;
      }
      if (prof === "interlock" && sg.name === "recover") {
        S.leverRail = lerp(lerp(fromRail, toRail, 0.45), fromRail, easeInOut(sg.u));
        S.leverRow = (a ? a.row : 0) * easeInOut(sg.u);
        S.sleeve[a.slv] = engaged * a.dir;
        S.clutch = 1 - easeInOut(sg.u);
      }
      if ((prof === "noSynchro" || prof === "noDogs") && sg.name === "recover") {
        S.leverRow = 0; S.leverRail = toRail; S.gear = 0;
      }

      /* engagement bookkeeping: lock the dog phase so the teeth line up when
         they meet. A demo that ends in `recover` never engaged anything —
         that is the whole argument of the layer. */
      if (sg.i >= 4 && !S.crashed && S.to && sg.name !== "recover") {
        if (S.gear !== S.to) {
          S.gear = S.to;
          lockPhase(S.to);
        }
      } else if (sg.i >= 1 && sg.i <= 3 && S.gear !== 0 && prof !== "interlock") {
        S.gear = 0;
      }

      applyTorque();
      if (S.phase !== lastPhase) { lastPhase = S.phase; emit("phase", S.phase); }
    }

    /* when the dogs meet, they meet at whatever tooth lined up — record it once */
    function lockPhase(g) {
      if (g === -1) {
        var thIdler = meshAngle(S.thCounter, PHI_C2I, Z_RC, Z_RI);
        var raw = meshAngle(thIdler, PHI_I2M, Z_RI, Z_RM);
        S.phaseAdj[-1] = snapTo(S.thMain - raw);
        return;
      }
      var s = SET[g];
      if (!s) return;
      S.phaseAdj[g] = snapTo(S.thMain - meshAngle(S.thCounter, PHI_C2M, s.Zc, s.Zm));
    }
    function snapTo(d) { var step = TAU / 8; return Math.round(d / step) * step; }

    function applyTorque() {
      accented.forEach(function (id) { if (P[id]) P[id].style = P[id]._base || "solid"; });
      accented = [];
      if (S.crashed) {
        var f = ["slv12", "slv34", "slv5"];
        if (S.to && ASM[S.to] && ASM[S.to].slv) f = [ASM[S.to].slv, ASM[S.to].cb];
        if (S.profile === "noDogs") f = ["g2Main", "g2Counter"];
        if (S.to === -1) f = ["gRIdler", "gRMain"];
        f.forEach(function (id) { if (P[id] && !hidden[id]) { P[id].style = "failure"; accented.push(id); } });
        return;
      }
      if (S.blocked) {
        ["interlock", "rod12", "rod5R"].forEach(function (id) { if (P[id]) { P[id].style = "failure"; accented.push(id); } });
        return;
      }
      if (S.clutch > 0.5 || !S.gear) return;
      (TORQUE[S.gear] || []).forEach(function (id) {
        if (P[id] && !hidden[id] && P[id]._base !== "ghost") { P[id].style = "accent"; accented.push(id); }
      });
    }
    /* accent is a temporary coat; strip it before restyling */
    function clearAccent() {
      accented.forEach(function (id) { if (P[id]) P[id].style = P[id]._base || "solid"; });
      accented = [];
    }

    /* 1930 mode is not a different animation, it is a missing component.
       Take the blocker rings off the bench so the absence is visible, not
       merely asserted — the layer still decides what is on the bench at all. */
    function applySynchroVisibility() {
      var stripped = S.mode === "1930";
      sc.parts.forEach(function (p) {
        if (p.group !== "synchro") return;
        p.visible = !hidden[p.id] && !stripped;
      });
      sc.invalidate();
    }

    /* which shift a layer's demo should run, given the mode. Only a
       synchronised shift has synchromesh to take away; the layers that are
       already arguing about its absence keep their own profile. */
    function profileFor(name) {
      if (S.mode === "1930" && (name === "modern" || name === "teach")) return "noSynchro";
      return name;
    }

    /* ── idle: with a gear in and the clutch out, the car is simply driving ── */
    function idleStep(dt) {
      if (sc.reducedMotion) return;
      if (S.gear && S.clutch < 0.1) {
        S.roadRpm = Math.min(S.roadRpm + 40 * dt, 3400 / Math.abs(RATIO[S.gear]));
        S.engineRpm = Math.abs(S.roadRpm * RATIO[S.gear]);
      } else if (!S.gear) {
        S.engineRpm += (900 - S.engineRpm) * Math.min(1, dt * 1.6);
      }
    }

    /* ── public surface ── */
    var ctl = {
      scene: sc, parts: P, state: S, ratios: RATIO,
      SET: SET, ASM: ASM,

      on: function (fn) { listeners.push(fn); },

      /* start a shift; the machine takes it from there */
      beginShift: function (to, profile) {
        if (S.playing) return false;
        S.from = S.gear || 4;
        S.to = to;
        S.baseProfile = profile || "modern";
        S.profile = profileFor(S.baseProfile);
        S.startRpm = S.engineRpm;
        S.t = 0;
        S.playing = !sc.reducedMotion;
        pose(0);
        if (sc.reducedMotion) emit("scrubbable", 1);
        emit("shift", { from: S.from, to: to, profile: S.profile });
        return true;
      },
      seek: function (u) {
        S.t = clamp01(u);
        S.playing = false;
        pose(S.t);
        kinematics(0);
      },
      play: function () {
        if (sc.reducedMotion) return false;
        if (S.t >= 1) S.t = 0;
        S.playing = true;
        return true;
      },
      pause: function () { S.playing = false; },

      /* per-layer scene configuration */
      applyLayer: function (cfg) {
        clearAccent();
        hidden = {};
        sc.parts.forEach(function (p) {
          var show = cfg.groups.indexOf(p.group) >= 0 || cfg.groups.indexOf("*") >= 0;
          if (cfg.hide && cfg.hide.indexOf(p.id) >= 0) show = false;
          p.visible = show;
          if (!show) hidden[p.id] = 1;
          p.style = p._base = (cfg.ghost && cfg.ghost.indexOf(p.group) >= 0) ? "ghost"
                  : (cfg.dim && cfg.dim.indexOf(p.group) >= 0) ? "dim"
                  : (p.id === "gearcase" ? "ghost" : p.id === "gate" ? "dim" : "solid");
        });
        sc.clip = cfg.cutaway ? [0, 0, 1, 4] : null;
        sc.explodeAmount = cfg.explode || 0;
        this.camera(cfg.camera);
        /* the mode is the reader's, not the layer's: it survives the walk
           unless a layer insists on one */
        if (cfg.mode) S.mode = cfg.mode;
        applySynchroVisibility();
        S.gear = cfg.gear == null ? 4 : cfg.gear;
        S.roadRpm = cfg.roadRpm == null ? 1700 : cfg.roadRpm;
        S.engineRpm = S.gear ? Math.abs(S.roadRpm * RATIO[S.gear]) : 900;
        S.clutch = 0;
        S.slideGear = 0; S.idler = 0;
        Object.keys(S.sleeve).forEach(function (k) { S.sleeve[k] = 0; });
        Object.keys(S.rod).forEach(function (k) { S.rod[k] = 0; });
        if (S.gear && ASM[S.gear] && ASM[S.gear].slv) S.sleeve[ASM[S.gear].slv] = TRAVEL * ASM[S.gear].dir;
        S.leverRail = S.gear && ASM[S.gear] ? ASM[S.gear].rail : 1;
        S.leverRow = S.gear && ASM[S.gear] ? ASM[S.gear].row : 0;
        S.from = S.gear; S.to = cfg.demo ? cfg.demo.to : S.gear;
        S.baseProfile = cfg.demo ? cfg.demo.profile : "modern";
        S.profile = profileFor(S.baseProfile);
        S.startRpm = S.engineRpm;
        S.t = 0; S.playing = false; S.phase = "idle"; S.crashed = false; S.blocked = false;
        applyTorque();
        kinematics(0);
      },

      camera: function (c) {
        if (!c) return;
        sc.camera.yaw = c.yaw; sc.camera.pitch = c.pitch;
        sc.camera.target = c.target.slice();
        sc.camera.dist = sc.fitDistance(c.radius);
        cameraHome = { yaw: c.yaw, pitch: c.pitch, target: c.target.slice(), radius: c.radius };
        sc.invalidate();
      },
      resetCamera: function () { if (cameraHome) this.camera(cameraHome); },
      orbit: function (dx, dy) {
        sc.camera.yaw += dx * 0.006;
        sc.camera.pitch = Math.max(-1.35, Math.min(1.35, sc.camera.pitch + dy * 0.006));
        sc.invalidate();
      },
      dolly: function (f) {
        sc.camera.dist = Math.max(120, Math.min(4000, sc.camera.dist * f));
        sc.invalidate();
      },
      setExplode: function (v) { sc.explodeAmount = v; sc.invalidate(); },
      setCutaway: function (on) { sc.clip = on ? [0, 0, 1, 4] : null; sc.invalidate(); },
      setMode: function (m) {
        S.mode = m;
        applySynchroVisibility();
        /* recompute from what the layer asked for, so toggling back restores
           the layer's own shift rather than a generic one */
        if (!S.playing) { S.profile = profileFor(S.baseProfile); pose(S.t); }
      },
      /* what Play would run right now on this layer */
      demoProfile: function (cfg) { return profileFor(cfg && cfg.demo ? cfg.demo.profile : "modern"); },

      hoverLabel: function (x, y) {
        var p = sc.pick(x, y);
        return p && p.label ? p.label : null;
      },

      start: function () {
        sc.start(function (dt) {
          if (S.playing) {
            S.t += dt * 1000 / PROFILES[S.profile].dur;
            if (S.t >= 1) { S.t = 1; S.playing = false; emit("done", S.gear); }
            pose(S.t);
          } else if (S.phase === "idle" || S.t >= 1) {
            idleStep(dt);
          }
          sc.animating = S.playing || (!sc.reducedMotion && (S.gear !== 0 || S.engineRpm > 10));
          kinematics(sc.reducedMotion ? 0 : dt);
        });
      }
    };

    return ctl;
  }

  /* ═══ LAYERS ═══
     Each entry says what is on the bench, where the camera stands, and
     which demo the layer is arguing with. */
  var LAYERS = [
    {
      id: "crash-box",
      groups: ["core", "g2"], hide: ["gInMain", "gInCounter"],
      camera: { yaw: -0.72, pitch: 0.36, target: [112, -50, 0], radius: 168 },
      demo: { profile: "noDogs", from: 0, to: 2 },
      gear: 0, roadRpm: 900
    },
    {
      id: "constant-mesh",
      groups: ["core", "g1", "g2", "g3", "dogs"],
      hide: ["blk1", "blk2", "blk3", "blk4", "blk5", "hub5", "slv5", "cb5"],
      camera: { yaw: -0.66, pitch: 0.34, target: [110, -45, 0], radius: 215 },
      demo: { profile: "noSynchro", from: 3, to: 2 },
      gear: 3, roadRpm: 1500
    },
    {
      id: "synchromesh",
      groups: ["core", "g3", "dogs", "synchro"],
      hide: ["hub12", "slv12", "hub5", "slv5", "cb1", "cb2", "cb5", "blk1", "blk2", "blk5",
             "shaftCounter", "g3Counter", "gInMain", "gInCounter"],
      camera: { yaw: -0.5, pitch: 0.30, target: [48, 2, 0], radius: 68 },
      cutaway: true,
      demo: { profile: "teach", from: 4, to: 3 },
      gear: 4, roadRpm: 1500
    },
    {
      id: "selection",
      groups: ["core", "g1", "g2", "g3", "dogs", "select", "selectR"],
      hide: ["hub5", "slv5", "cb5", "blk5"],
      dim: ["core", "g1", "g2", "g3"],
      camera: { yaw: -0.78, pitch: 0.16, target: [100, 34, 0], radius: 195 },
      demo: { profile: "interlock", from: 3, to: 1 },
      gear: 3, roadRpm: 1500
    },
    {
      id: "reverse",
      groups: ["core", "gR", "dogs", "selectR"],
      hide: ["cb1", "cb2", "cb3", "cb4", "hub34", "slv34", "hub12", "slv12"],
      dim: ["core"],
      camera: { yaw: -0.95, pitch: 0.30, target: [212, -56, -20], radius: 150 },
      demo: { profile: "reverse", from: 0, to: -1 },
      gear: 0, roadRpm: 150
    },
    {
      id: "synthesis",
      groups: ["*"],
      camera: { yaw: -0.62, pitch: 0.34, target: [128, -46, 0], radius: 255 },
      demo: { profile: "modern", from: 4, to: 3 },
      gear: 4, roadRpm: 1700, free: true
    }
  ];

  return { create: create, LAYERS: LAYERS, RATIO: RATIO, PROFILES: PROFILES, SET: SET };
})();
