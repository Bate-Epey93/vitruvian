/* ═══════════════════════════════════════════════════════════════
   THE BEAT — scene, kinematics, and the five escapements
   ───────────────────────────────────────────────────────────────
   Five clock escapements on one bench, all feeding off the same
   wheel train, drawn out of Ink3D primitives.

   World axes: the escapement is a flat machine, so +x is right,
   +y is up, and +z comes at the reader. Everything turns about
   its own z, which means almost every part is a profile extruded
   in z and placed with `spin` — no part rotations at all except
   the verge, whose crown wheel lies on its side.

   Two deliberate distortions, both stated in the copy:

   · ARC. An anchor pendulum really swings four to six degrees.
     Drawn at that size the whole argument of three layers is
     invisible, so each mechanism carries a drawn amplitude and a
     real one. The drawing uses the first, the readout shows the
     second, and they are never confused for each other.

   · RECOIL. Same problem, same answer. A real anchor pushes its
     wheel back a small fraction of a tooth, which at this size
     is a few pixels. The beat tables below overstate it, because
     a recoil escapement that does not visibly recoil is a drawing
     of nothing. What is NOT overstated is which escapements do
     it: the deadbeat and the lever recoil by exactly zero, and no
     amount of dragging the mainspring changes that.

   · RATE. The seconds-per-day figures are the published
     performance of each escapement in a good example of its own
     period. They are a model, not a measurement taken from this
     drawing — the drawing is kinematic and has no physics in it.
     What the model encodes is the one thing the ladder is about:
     how much of the rate the drive force is responsible for.
   ═══════════════════════════════════════════════════════════════ */

var ESCScene = (function () {
  "use strict";

  var TAU = Math.PI * 2, HALF_PI = Math.PI / 2, D2R = Math.PI / 180;

  /* ── layout ──────────────────────────────────────────────────
     The escape wheel is the origin. Everything else is placed
     relative to it, so swapping escapements swaps only what sits
     above the wheel. */
  var Z_ESC = 30;                  // teeth on the escape wheel
  var R_ESC = 60;                  // tip radius
  var R_RIM = 50;                  // inside of the rim
  var W_ESC = 5;                   // wheel thickness
  var TOOTH = TAU / Z_ESC;

  var ARBOR_Y = 86;                // pallet arbor, above the wheel
  var SPAN = 90 * D2R;             // the anchor straddles 7.5 teeth
  var PAL_R = R_ESC;               // pallets meet the wheel at the tips

  var BAL_Y = 150;                 // balance wheel centre, above the lever
  var R_BAL = 54;
  var ROLL_R = 15;                 // the roller jewel's orbit
  var LEVER_ARC = 9 * Math.PI / 180;   // total lever travel, banking pin to banking pin

  /* The verge rigs. A verge staff stands off the crown wheel's face by
     the length of its flags, and which way "off" points is the whole
     difference between the two layers that use it:

     · FOLIOT  the crown's axis is horizontal, the staff vertical, and
               the oscillator swings in the horizontal plane. A foliot
               does not care about gravity, so this works.
     · VERGE+PENDULUM  a pendulum is driven by gravity and cannot swing
               about a vertical axis, so the whole rig is turned on its
               side: the crown's axis goes across, the staff comes at
               the reader, and the pendulum swings in the drawing plane.

     Both use one mesh, built with the staff along local z and the flags
     reaching along local +y. Each rig is a rotation of that. */
  var FLAG_LEN = 17, STAFF_OFF = 26, FLAG_Z = 56;

  /* the train: a great wheel driving a pinion on the escape arbor */
  var Z_PIN = 8, Z_GW = 48, M_TRAIN = 3.2;
  var C_TRAIN = M_TRAIN * (Z_PIN + Z_GW) / 2;
  var GW_X = -C_TRAIN;

  /* ── how each escapement behaves ─────────────────────────────
     drawnArc  degrees of oscillator swing on screen
     realArc   degrees it swings in the machine itself
     bias      seconds per day at half wind, the residual error
     drift     seconds per day across the full range of the wind
     The ladder is `drift`, and only `drift`. `bias` is not
     monotonic and is not supposed to be: a lever watch is less
     accurate than a Graham regulator and still beat it, because
     being carried does not disturb it. */
  var MECH = {
    foliot:   { drawnArc: 50,  realArc: 50,  bias: 0,   drift: 1200, wheel: "ratchet", crown: true },
    pendulum: { drawnArc: 45,  realArc: 45,  bias: 12,  drift: 40,   wheel: "ratchet", crown: true },
    anchor:   { drawnArc: 16,  realArc: 5,   bias: 8,   drift: 12,   wheel: "ratchet" },
    deadbeat: { drawnArc: 14,  realArc: 4,   bias: 0.8, drift: 1.5,  wheel: "ratchet" },
    lever:    { drawnArc: 135, realArc: 135, bias: 5,   drift: 0.4,  wheel: "club" }
  };
  var MECH_ORDER = ["foliot", "pendulum", "anchor", "deadbeat", "lever"];

  /* ── the beat ────────────────────────────────────────────────
     u runs 0 → 1 across one beat: one swing of the oscillator,
     one tooth let go. The oscillator angle is the same cosine for
     every mechanism. What differs — the entire study, in five
     curves — is what the escape wheel does while that happens.

     Each entry is a list of [uEnd, toothsAdvanced, phase] waypoints,
     interpolated smoothly. A curve that overshoots 1 and comes back
     is recoil: the wheel driven backwards by the oscillator after
     the tooth has dropped. A curve that sits flat at 1 is dead. A
     curve that sits flat at 0 is an oscillator with nothing
     touching it. */
  var BEAT = {
    /* The verge is in contact for nearly the whole swing and recoils
       hard at the end of it. Worst of both: a long push and a long
       shove back. */
    foliot: [[0.00, 0.00, "impulse"], [0.78, 1.30, "impulse"], [1.00, 1.00, "recoil"]],
    /* Same escapement, different oscillator. The curve is the verge's;
       what changed is what is hanging off the top of the staff. */
    pendulum: [[0.00, 0.00, "impulse"], [0.78, 1.30, "impulse"], [1.00, 1.00, "recoil"]],
    /* Impulse, drop, then the pendulum's remaining swing pushes the
       wheel back. On the dial this is the second hand stepping
       forward and twitching back, once a second, forever. */
    anchor: [[0.00, 0.00, "lock"], [0.08, 0.05, "release"], [0.45, 1.24, "impulse"],
             [1.00, 1.00, "recoil"]],
    /* The same up to the drop. Then the tooth meets an arc struck
       from the pallet arbor, slides along it at constant radius, and
       the wheel does not move at all. */
    deadbeat: [[0.00, 0.00, "lock"], [0.08, 0.04, "release"], [0.45, 1.00, "impulse"],
               [1.00, 1.00, "dead"]],
    /* Locked for most of the beat with the balance running free, then
       a short window: the roller jewel enters the notch, unlocks,
       takes one impulse, and the next tooth drops onto the other
       pallet. */
    lever: [[0.00, 0.00, "supplementary"], [0.44, 0.00, "supplementary"],
            [0.49, 0.07, "unlock"], [0.59, 1.00, "impulse"], [0.63, 1.00, "drop"],
            [1.00, 1.00, "lock"]]
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t * t * (3 - 2 * t); }

  /* Walk a beat table: returns { w: tooths advanced, phase: name }. */
  function beatAt(name, u) {
    var k = BEAT[name], i;
    u = clamp01(u);
    for (i = 0; i < k.length - 1; i++) {
      if (u <= k[i + 1][0]) {
        var span = k[i + 1][0] - k[i][0];
        var t = span <= 0 ? 1 : ease((u - k[i][0]) / span);
        return { w: k[i][1] + (k[i + 1][1] - k[i][1]) * t, phase: k[i + 1][2] };
      }
    }
    return { w: k[k.length - 1][1], phase: k[k.length - 1][2] };
  }

  /* ═══ profiles ═══════════════════════════════════════════════
     Flat [x,y,…] polygons, counter-clockwise, extruded in z.
     Everything here is drawn at the sizes above, so the numbers
     in the shapes are millimetres on a clock the size of a dinner
     plate. ═══ */

  /* One escape tooth, pointing the way the wheel turns. The back is
     radial and the front is undercut, which is what lets a pallet
     drop clear instead of riding the tooth back up. */
  function ratchetTooth() {
    var rb = R_RIM, rt = R_ESC, a = TOOTH;
    return [
      rb, 0,
      rt * Math.cos(a * 0.62), rt * Math.sin(a * 0.62),
      rb * Math.cos(a * 0.72), rb * Math.sin(a * 0.72)
    ];
  }
  /* A club tooth: the lever escapement puts half the impulse plane on
     the tooth and half on the pallet, so the tip is a flat face rather
     than a point. Four corners instead of three. */
  function clubTooth() {
    var rb = R_RIM, rt = R_ESC, a = TOOTH;
    return [
      rb, 0,
      rt * 0.97 * Math.cos(a * 0.30), rt * 0.97 * Math.sin(a * 0.30),
      rt * Math.cos(a * 0.56), rt * Math.sin(a * 0.56),
      rb * Math.cos(a * 0.70), rb * Math.sin(a * 0.70)
    ];
  }

  /* The anchor. Two slender arms reaching down from the arbor to
     straddle the rim of the wheel, joined by a yoke across the top,
     each ending in a pallet that crosses the tooth circle.

     Walked as one closed loop: up the inside of the entry arm, across
     under the arbor, down the inside of the exit arm, out across the
     exit pallet, up the back of that arm, over the yoke, down the back
     of the entry arm, and back across the entry pallet to where it
     started. Each pallet face is the segment between two named corners,
     so the loop can only close one way.

     The pallet faces are the study:

     · RECOIL   the face runs from the tooth circle inward as the pallet
                turns, so the pallet keeps driving the wheel after the
                tooth has dropped — backwards.
     · DEADBEAT the face is an arc at constant radius from the arbor, so
                the tooth slides along it and the wheel feels nothing.

     Angles are in the arbor's own frame, where the wheel centre is
     straight below at -ARBOR_Y. */
  function anchorProfile(deadbeat) {
    var half = SPAN / 2;
    var e = [-PAL_R * Math.sin(half), PAL_R * Math.cos(half) - ARBOR_Y];
    var x = [ PAL_R * Math.sin(half), PAL_R * Math.cos(half) - ARBOR_Y];
    var rE = Math.hypot(e[0], e[1]), aE = Math.atan2(e[1], e[0]);
    var rX = Math.hypot(x[0], x[1]), aX = Math.atan2(x[1], x[0]);
    var LIFT = 9 * D2R;          // the impulse angle, drawn generously
    var OUT = 6, IN = 10;        // how far a pallet reaches past the tooth circle

    var p = [];
    function put(r, a) { p.push(r * Math.cos(a), r * Math.sin(a)); }
    function xy(X, Y) { p.push(X, Y); }
    /* the locking face, from the outer corner to the inner one. On a
       deadbeat that path is an arc of the tooth circle struck from the
       arbor; on a recoil anchor it is a chord that cuts inward. */
    function lock(r, aOut, aIn) {
      var i, n = 7;
      if (deadbeat) for (i = 0; i < n; i++) put(r, aOut + (aIn - aOut) * (i / n));
      else put(r + OUT, aOut);
      put(r - IN, aIn);
    }

    put(rE - IN, aE + LIFT);                   // entry pallet, inner corner
    put(rE * 0.78, aE + 0.13);                 // up the inside of the entry arm
    xy(-9, -14); xy(9, -14);                 // across, under the arbor
    put(rX * 0.78, aX - 0.13);                 // down the inside of the exit arm
    lock(rX, aX - LIFT, aX);                   // out across the exit pallet
    put(rX * 0.74, aX + 0.02);                 // up the back of the exit arm
    xy(26, 6); xy(11, 15); xy(-11, 15); xy(-26, 6);        // the yoke
    put(rE * 0.74, aE - 0.02);                 // down the back of the entry arm
    lock(rE, aE, aE + LIFT);                   // and the entry pallet closes it
    return p;
  }

  /* The lever: a fork at one end for the roller jewel, two pallet
     jewels straddling the wheel, and a tail. Drawn as one piece
     because that is how a watch lever is made. */
  function leverProfile() {
    var half = SPAN / 2 * 0.55;
    var ex = -PAL_R * Math.sin(half), ey = PAL_R * Math.cos(half) - ARBOR_Y;
    var xx = PAL_R * Math.sin(half), xy = PAL_R * Math.cos(half) - ARBOR_Y;
    return [
      ex - 5, ey - 4, ex + 3, ey + 5,       // entry pallet
      -9, -4, -5, 14,
      -4.5, 40, -9, 46,                      // the fork, reaching up to the roller
      -3.5, 52, -3.5, 44,                    // one horn
      3.5, 44, 3.5, 52,                      // the notch between them
      9, 46, 4.5, 40,
      5, 14, 9, -4,
      xx - 3, xy + 5, xx + 5, xy - 4         // exit pallet
    ];
  }

  function ringSection(rIn, rOut, w) {
    return [rIn, -w / 2, rOut, -w / 2, rOut, w / 2, rIn, w / 2];
  }
  function barProfile(len, th) { return [-len / 2, -th / 2, len / 2, -th / 2, len / 2, th / 2, -len / 2, th / 2]; }

  /* An Archimedean spiral for the hairspring, swept as a thin ribbon.
     This is the part that makes a balance wheel into an oscillator:
     without it the balance is a foliot with better bearings. */
  function spiralPath(r0, r1, turns, seg) {
    var p = [], i, n = Math.round(seg * turns), t, a, r;
    for (i = 0; i <= n; i++) {
      t = i / n; a = t * turns * TAU; r = r0 + (r1 - r0) * t;
      p.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    }
    return p;
  }

  var PROFILES = {
    ratchetTooth: ratchetTooth, clubTooth: clubTooth,
    anchor: anchorProfile, lever: leverProfile
  };

  /* ═══ build ══════════════════════════════════════════════════ */
  function create(canvas) {
    var sc = Ink3D.scene(canvas);
    var P = {};

    function add(spec) { P[spec.id] = sc.add(spec); return P[spec.id]; }

    /* ── the escape wheel, in two tooth forms ──
       A rim with spokes rather than a solid plate: the pallets work
       behind the wheel as often as in front of it, and a solid disc
       hides the whole argument at half the camera angles. */
    function wheelMesh(toothFn) {
      var m = Ink3D.revolve(ringSection(R_RIM - 7, R_RIM, W_ESC), 44, { tier: 1 });
      var i, t;
      for (i = 0; i < Z_ESC; i++) {
        t = Ink3D.prism(toothFn(), W_ESC);
        Ink3D.xform(t, Ink3D.mRZ(i * TOOTH));
        m = Ink3D.merge(m, t);
      }
      /* four crossings and a hub, as a wheel of this period would be cut.
         Two full-diameter bars, so four arms — not four bars, which
         would give eight and read as a disc. */
      for (i = 0; i < 2; i++) {
        var sp = Ink3D.prism(barProfile(R_RIM * 2 - 12, 7), W_ESC * 0.7);
        Ink3D.xform(sp, Ink3D.mRZ(i * HALF_PI));
        m = Ink3D.merge(m, sp);
      }
      return Ink3D.merge(m, Ink3D.revolve(ringSection(0, 13, W_ESC * 1.6), 20));
    }

    add({ id: "escRatchet", mesh: wheelMesh(ratchetTooth), group: "wheelR",
          pos: [0, 0, 0], label: "Escape wheel — pointed teeth", pickable: true, clippable: true });
    add({ id: "escClub", mesh: wheelMesh(clubTooth), group: "wheelC",
          pos: [0, 0, 0], label: "Escape wheel — club teeth", pickable: true, clippable: true });

    /* ── the train behind it ──
       A great wheel and a pinion, so the mainspring has somewhere to
       be. Shown dim on most layers: it is the thing the escapement is
       arguing with, not the argument. */
    add({ id: "pinion", mesh: Ink3D.gearMesh(Z_PIN, M_TRAIN, 9, 5),
          group: "train", pos: [0, 0, -W_ESC - 6], label: "Escape pinion", pickable: true });
    add({ id: "greatWheel", mesh: Ink3D.gearMesh(Z_GW, M_TRAIN, 7, 10),
          group: "train", pos: [GW_X, 0, -W_ESC - 7], label: "Great wheel — the mainspring's", pickable: true });
    add({ id: "barrel", mesh: Ink3D.revolve(ringSection(0, 30, 22), 30, { tier: 1 }),
          group: "train", pos: [GW_X, 0, -W_ESC - 24], label: "Mainspring barrel", pickable: true });

    /* ── crown wheel and verge (layers 1 and 2) ──
       The one part of this bench that is not flat. A crown wheel's
       teeth point along its axis, and the verge staff crosses its
       face at a right angle, which is exactly why the staff has to
       swing through eighty degrees to let one tooth by. */
    (function () {
      var m = Ink3D.revolve(ringSection(R_RIM - 8, R_ESC, 6), 40, { tier: 1 }), i;
      /* local x runs round the rim, local y along the axis, local z out
         radially — so this matrix stands each tooth up on the face */
      var STAND = [0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1];
      for (i = 0; i < Z_ESC; i++) {
        var t = Ink3D.prism([0, 0, 9, 0, 0, 15], 7);
        Ink3D.xform(t, STAND);
        Ink3D.xform(t, Ink3D.mMul(Ink3D.mRZ(i * TOOTH), Ink3D.mT(R_ESC - 9, 0, 3)));
        m = Ink3D.merge(m, t);
      }
      m = Ink3D.merge(m, Ink3D.revolve(ringSection(0, 11, 8), 18));
      add({ id: "crown", mesh: m, group: "crown", pos: [0, 0, 0],
            label: "Crown wheel", pickable: true });
    })();

    (function () {
      /* The verge staff, built along local z, with two flags reaching
         along local +y about ninety-five degrees apart around the staff.
         That angle is the escapement: one flag has to be entering the
         tooth circle as the other leaves it. */
      var m = Ink3D.revolve(ringSection(0, 5, 160), 14, { tier: 1 });
      function flag(z, about) {
        /* a flat paddle lying in the staff's own radial plane */
        var f = Ink3D.prism([0, -3.5, FLAG_LEN, -3.5, FLAG_LEN, 3.5, 0, 3.5], 5);
        /* stand it up: local x out along +y, local z stays the staff axis */
        Ink3D.xform(f, [0, 0, 0, 0,  1, 0, 0, 0,  0, 1, 0, z,  0, 0, 0, 1]);
        return Ink3D.xform(f, Ink3D.mRZ(about));
      }
      m = Ink3D.merge(m, flag(FLAG_Z, 0));
      m = Ink3D.merge(m, flag(-FLAG_Z, Math.PI * 0.53));
      add({ id: "vergeF", mesh: m, group: "verge",
            pos: [0, 0, STAFF_OFF], rot: [-HALF_PI, 0, 0],
            label: "Verge staff and pallet flags", pickable: true });
      add({ id: "vergeP", mesh: m, group: "vergeP",
            pos: [STAFF_OFF, 0, 0], rot: [0, 0, HALF_PI],
            label: "Verge staff and pallet flags", pickable: true });
    })();

    /* the foliot: a bar with two weights, and no period of its own */
    (function () {
      var m = Ink3D.prism(barProfile(168, 9), 9), i;
      for (i = 0; i < 2; i++) {
        var w = Ink3D.revolve(ringSection(0, 14, 11), 16);
        Ink3D.xform(w, Ink3D.mT(i ? 62 : -62, 0, 0));
        m = Ink3D.merge(m, w);
      }
      /* laid flat, on top of the vertical staff: a foliot swings
         horizontally, which is why it works and why it is useless */
      add({ id: "foliot", mesh: m, group: "foliot",
            pos: [0, 96, STAFF_OFF], rot: [-HALF_PI, 0, 0],
            label: "Foliot — a flywheel, not a timekeeper", pickable: true });
    })();

    /* the pendulum, hung on the same axis as the verge. A real clock
       drives it through a crutch and hangs it on a suspension spring;
       co-axial is a simplification, and a short one — a seconds
       pendulum is a metre long and this one is not. */
    (function () {
      var m = Ink3D.prism(barProfile(7, 196), 5);
      Ink3D.xform(m, Ink3D.mT(0, -98, 0));
      m = Ink3D.merge(m, Ink3D.xform(Ink3D.revolve(ringSection(0, 30, 9), 28, { tier: 1 }),
                                     Ink3D.mT(0, -196, 0)));
      add({ id: "pendVerge", mesh: m, group: "pendV", pos: [STAFF_OFF, 0, 0],
            label: "Pendulum — period from length, not from push", pickable: true });
      /* behind the wheel, not through it. A real clock hangs the
         pendulum off the back plate and drives it through a crutch;
         putting it a plate's depth back is the cheapest way to say so
         without drawing the crutch. */
      add({ id: "pendAnchor", mesh: m, group: "pendA", pos: [0, ARBOR_Y, -26],
            label: "Pendulum — period from length, not from push", pickable: true });
    })();

    /* ── anchor and deadbeat ── */
    add({ id: "anchor", mesh: Ink3D.prism(anchorProfile(false), 8), group: "anchor",
          pos: [0, ARBOR_Y, 0], label: "Anchor — flat pallets, so it recoils",
          pickable: true, clippable: true });
    add({ id: "deadbeat", mesh: Ink3D.prism(anchorProfile(true), 8), group: "deadbeat",
          pos: [0, ARBOR_Y, 0], label: "Deadbeat pallets — locking faces struck from the arbor",
          pickable: true, clippable: true });
    add({ id: "arbor", mesh: Ink3D.revolve(ringSection(0, 7, 26), 16), group: "pivot",
          pos: [0, ARBOR_Y, 0], label: "Pallet arbor", pickable: true });

    /* ── the lever escapement ── */
    add({ id: "lever", mesh: Ink3D.prism(leverProfile(), 6), group: "lever",
          pos: [0, ARBOR_Y, 0], label: "Lever — locked except for one moment a beat",
          pickable: true, clippable: true });
    /* banking pins: the lever rests on one or the other, and draw holds
       it there against anything short of a dropped watch */
    [-1, 1].forEach(function (s, i) {
      add({ id: "bank" + i, mesh: Ink3D.revolve(ringSection(0, 3.2, 14), 12), group: "lever",
            pos: [s * 16, ARBOR_Y + 48, 0], label: "Banking pin", pickable: true });
    });

    (function () {
      /* balance wheel: a rim on two arms, and the hairspring that
         turns it into an oscillator */
      var m = Ink3D.revolve(ringSection(R_BAL - 7, R_BAL, 7), 46, { tier: 1 }), i;
      for (i = 0; i < 2; i++) {
        var sp = Ink3D.prism(barProfile(R_BAL * 2 - 10, 6), 5);
        Ink3D.xform(sp, Ink3D.mRZ(i * Math.PI / 2));
        m = Ink3D.merge(m, sp);
      }
      m = Ink3D.merge(m, Ink3D.revolve(ringSection(0, 8, 12), 16));
      add({ id: "balance", mesh: m, group: "balance", pos: [0, BAL_Y, 10],
            label: "Balance wheel", pickable: true });

      var hair = Ink3D.sweep([0, -0.9, 1.6, -0.9, 1.6, 0.9, 0, 0.9],
                             spiralPath(10, 34, 4.25, 54), { sideTier: 0 });
      add({ id: "hairspring", mesh: hair, group: "balance", pos: [0, BAL_Y, 22],
            label: "Hairspring — the balance's period lives here", pickable: true });

      /* the roller table under the balance, and the one jewel that
         touches the lever */
      var roll = Ink3D.revolve(ringSection(0, 19, 6), 24);
      add({ id: "roller", mesh: roll, group: "balance", pos: [0, BAL_Y, 0],
            label: "Roller table", pickable: true });
      add({ id: "rollerJewel", mesh: Ink3D.prism([-2.6, -2.6, 2.6, -2.6, 2.6, 2.6, -2.6, 2.6], 9),
            group: "balance", pos: [0, BAL_Y, 0], label: "Roller jewel — the only contact", pickable: true });
    })();

    /* the plate, for depth. Ghosted on every layer: it is the bench,
       not the machine. */
    add({ id: "plate", mesh: Ink3D.revolve(ringSection(0, 132, 5), 44, { tier: 2 }),
          group: "plate", pos: [0, 30, -46], label: "Back plate" });

    /* ═══ state ══════════════════════════════════════════════ */
    var S = {
      mech: "anchor",
      drive: 0.5,              // 0 nearly run down, 1 fully wound
      t: 0,                    // position within the current beat
      beats: 0,                // whole beats since the layer was applied
      playing: false,
      phase: "idle",
      mode: "real",            // "slow" draws the beat at a quarter speed
      amp: 16,
      free: false
    };
    var listeners = [], cameraHome = null, hidden = {};
    function emit(kind, payload) { listeners.forEach(function (fn) { fn(kind, payload); }); }
    function lastPhase(p) { if (p !== S.phase) { S.phase = p; emit("phase", p); } }

    /* ── the one place the wheel's angle is decided ──
       Everything downstream of the escape wheel is derived from it,
       never integrated on its own, which is what keeps the pinion's
       teeth inside the great wheel's gaps instead of drifting
       through them. */
    function bearing(from, to) { return Math.atan2(to[1] - from[1], to[0] - from[0]); }
    function meshAngle(theta1, phi, Z1, Z2) {
      return phi + Math.PI + Math.PI / Z2 - (Z1 / Z2) * (theta1 - phi);
    }
    var PHI_P2G = bearing([0, 0], [GW_X, 0]);

    function pose(u) {
      var m = MECH[S.mech];
      var b = beatAt(S.mech, u);
      var dir = (S.beats % 2) ? -1 : 1;           // beats alternate direction
      var arc = S.amp * D2R;
      /* the oscillator: one swing per beat, extreme to extreme */
      var theta = -Math.cos(Math.PI * clamp01(u)) * arc * dir;

      /* the wheel: whole beats already escaped, plus this beat's curve */
      var wheel = -(S.beats + b.w) * TOOTH;
      lastPhase(b.phase);

      P.escRatchet.spin = wheel;
      P.escClub.spin = wheel;
      P.pinion.spin = wheel;
      P.greatWheel.spin = meshAngle(wheel, PHI_P2G, Z_PIN, Z_GW);
      P.barrel.spin = P.greatWheel.spin;

      if (m.crown) {
        /* The crown wheel and its staff are one rig turned two ways;
           which parts are on screen was settled when the layer was
           applied, so here they are simply all driven. */
        P.crown.spin = wheel;
        P.crown.rot = S.mech === "pendulum" ? [0, HALF_PI, 0] : [0, 0, 0];
        P.vergeF.spin = theta;
        P.vergeP.spin = theta;
        P.foliot.spin = theta;
        P.pendVerge.spin = theta;
      } else {
        P.anchor.spin = theta;
        P.deadbeat.spin = theta;
        P.pendAnchor.spin = theta;
        /* The lever does NOT follow the balance. It is locked against
           one banking pin, flicks across while the tooth escapes, and
           is locked against the other — which is what "detached" means
           and the whole claim of this layer. So it is driven by the
           wheel's own progress through the beat, not by theta: flat,
           flick, flat. */
        P.lever.spin = dir * (b.w - 0.5) * 2 * LEVER_ARC;
        P.balance.spin = theta;
        P.hairspring.spin = theta;
        P.roller.spin = theta;
        P.rollerJewel.spin = theta;
        /* the jewel rides the underside of the roller, so it is in the
           fork at mid-swing and nowhere near it the rest of the time */
        P.rollerJewel.pos = [Math.sin(theta) * ROLL_R, BAL_Y - Math.cos(theta) * ROLL_R, 0];
      }
      sc.invalidate();
    }

    /* ── the rate model ──
       Two numbers, and the study comes apart if they are read as one.
       `rate` is how wrong the clock is. `drift` is how much of that
       the mainspring is responsible for, which is the only figure
       that improves at every rung. */
    function rateNow() {
      var m = MECH[S.mech];
      return m.bias + m.drift * (S.drive - 0.5) * 2;
    }

    /* Amplitude follows the drive on every escapement ever built. What
       differs between them is whether the RATE follows the amplitude,
       which is the whole ladder. */
    function ampScale() { return 0.74 + 0.26 * S.drive; }
    function applyAmp() { S.amp = MECH[S.mech].drawnArc * ampScale(); }

    function visibilityFor(cfg) {
      var m = MECH[S.mech];
      sc.parts.forEach(function (p) {
        var show = cfg.groups.indexOf(p.group) >= 0 || cfg.groups.indexOf("*") >= 0;
        if (cfg.hide && cfg.hide.indexOf(p.id) >= 0) show = false;
        /* a layer asks for "the escapement"; which parts that means is
           the scene's business, not the layer's */
        if (p.group === "wheelR") show = show && m.wheel === "ratchet";
        if (p.group === "wheelC") show = show && m.wheel === "club";
        if (p.group === "crown") show = show && !!m.crown;
        if (p.group === "verge") show = show && S.mech === "foliot";
        if (p.group === "vergeP" || p.group === "pendV") show = show && S.mech === "pendulum";
        if (p.group === "foliot") show = show && S.mech === "foliot";
        if (p.group === "pendA") show = show && (S.mech === "anchor" || S.mech === "deadbeat");
        if (p.group === "anchor") show = show && S.mech === "anchor";
        if (p.group === "deadbeat") show = show && S.mech === "deadbeat";
        if (p.group === "lever" || p.group === "balance") show = show && S.mech === "lever";
        if (p.group === "pivot") show = show && !m.crown;
        p.visible = show;
        if (!show) hidden[p.id] = 1;
        p.style = p._base =
          (cfg.ghost && cfg.ghost.indexOf(p.group) >= 0) ? "ghost"
          : (cfg.dim && cfg.dim.indexOf(p.group) >= 0) ? "dim"
          : (p.group === "plate") ? "ghost"
          : "solid";
      });
      sc.invalidate();
    }

    var layerCfg = null;

    /* ── public surface ── */
    var ctl = {
      scene: sc, parts: P, state: S, mechs: MECH, order: MECH_ORDER,

      on: function (fn) { listeners.push(fn); },

      rate: rateNow,
      drift: function () { return MECH[S.mech].drift; },
      /* the swing the real machine makes at this wind, which is not the
         swing on screen wherever the drawing exaggerates a small arc */
      realArc: function () { return MECH[S.mech].realArc * ampScale(); },

      setMech: function (name) {
        if (!MECH[name] || name === S.mech) return false;
        S.mech = name;
        S.beats = 0; S.t = 0; S.playing = false;
        applyAmp();
        if (layerCfg) visibilityFor(layerCfg);
        pose(0);
        emit("mech", name);
        return true;
      },
      setDrive: function (v) {
        S.drive = clamp01(v);
        applyAmp();
        pose(S.t);
        emit("drive", S.drive);
      },

      /* a demo here is a run of beats, not a one-off move: the
         argument is what the wheel does over and over */
      beginDemo: function (demo) {
        if (!demo) return false;
        if (demo.mech) this.setMech(demo.mech);
        S.beats = 0; S.t = 0;
        S.playing = !sc.reducedMotion;
        pose(0);
        if (sc.reducedMotion) emit("scrubbable", 1);
        emit("demo", S.mech);
        return true;
      },
      demoProfile: function (cfg) { return (cfg && cfg.demo && cfg.demo.mech) || S.mech; },

      seek: function (u) { S.t = clamp01(u); S.playing = false; pose(S.t); },
      play: function () {
        if (sc.reducedMotion) return false;
        if (S.t >= 1) S.t = 0;
        S.playing = true;
        return true;
      },
      pause: function () { S.playing = false; },

      applyLayer: function (cfg) {
        layerCfg = cfg;
        hidden = {};
        if (cfg.mech) S.mech = cfg.mech;
        if (cfg.drive != null) S.drive = cfg.drive;
        S.free = !!cfg.free;
        S.beats = 0; S.t = 0; S.playing = false; S.phase = "idle";
        applyAmp();
        visibilityFor(cfg);
        sc.clip = cfg.cutaway ? [0, 0, 1, 4] : null;
        sc.explodeAmount = cfg.explode || 0;
        this.camera(cfg.camera);
        if (cfg.mode) S.mode = cfg.mode;
        pose(0);
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
        sc.camera.dist = Math.max(90, Math.min(4000, sc.camera.dist * f));
        sc.invalidate();
      },
      setExplode: function (v) { sc.explodeAmount = v; sc.invalidate(); },
      setCutaway: function (on) { sc.clip = on ? [0, 0, 1, 4] : null; sc.invalidate(); },
      setMode: function (m) { S.mode = m; },

      hoverLabel: function (x, y) {
        var p = sc.pick(x, y);
        return p && p.label ? p.label : null;
      },

      start: function () {
        sc.start(function (dt) {
          if (S.playing) {
            /* a beat a second is the clock's own pace; slow mode is for
               reading the locking, which is over in a few milliseconds
               on anything real */
            S.t += dt / (S.mode === "slow" ? 4 : 1);
            while (S.t >= 1) { S.t -= 1; S.beats++; }
            pose(S.t);
          }
          sc.animating = S.playing;
        });
      }
    };

    applyAmp();
    pose(0);
    return ctl;
  }

  /* ═══ LAYERS ═══
     Each entry says which escapement is on the bench, where the
     camera stands, and how far wound the mainspring starts. */
  var LAYERS = [
    {
      id: "foliot",
      mech: "foliot", drive: 0.8,
      groups: ["plate", "train", "crown", "verge", "foliot"],
      dim: ["train"],
      camera: { yaw: -0.70, pitch: 0.28, target: [0, 44, 12], radius: 168 },
      demo: { mech: "foliot" }
    },
    {
      id: "pendulum",
      mech: "pendulum", drive: 0.5,
      groups: ["plate", "train", "crown", "vergeP", "pendV"],
      dim: ["train"],
      camera: { yaw: -0.34, pitch: 0.15, target: [8, -48, 0], radius: 196 },
      demo: { mech: "pendulum" }
    },
    {
      id: "anchor",
      mech: "anchor", drive: 0.5,
      groups: ["plate", "train", "wheelR", "anchor", "pivot", "pendA"],
      dim: ["train", "plate"],
      camera: { yaw: -0.15, pitch: 0.10, target: [0, 24, 0], radius: 124 },
      demo: { mech: "anchor" }
    },
    {
      id: "deadbeat",
      mech: "deadbeat", drive: 0.5,
      groups: ["plate", "train", "wheelR", "deadbeat", "pivot", "pendA"],
      hide: ["plate", "barrel"],
      camera: { yaw: -0.11, pitch: 0.07, target: [0, 50, 0], radius: 94 },
      demo: { mech: "deadbeat" }
    },
    {
      id: "lever",
      mech: "lever", drive: 0.5,
      groups: ["plate", "train", "wheelC", "lever", "pivot", "balance"],
      dim: ["train"],
      camera: { yaw: -0.19, pitch: 0.12, target: [0, 94, 0], radius: 152 },
      demo: { mech: "lever" }
    },
    {
      id: "synthesis",
      mech: "lever", drive: 0.5,
      groups: ["*"],
      dim: ["train"],
      camera: { yaw: -0.40, pitch: 0.22, target: [0, 56, 0], radius: 200 },
      demo: { mech: "lever" }, free: true
    }
  ];

  return { create: create, LAYERS: LAYERS, MECH: MECH, order: MECH_ORDER,
           PROFILES: PROFILES, BEAT: BEAT };
})();
