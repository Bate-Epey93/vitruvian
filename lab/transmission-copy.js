/* ═══════════════════════════════════════════════════════════════
   THE GEAR CHANGE — copy
   ───────────────────────────────────────────────────────────────
   All strings live here; the page file contains no prose, the same
   split content.js keeps with engine.js. Two registers per layer:
   the plain statement, and the analogy for someone who has never
   opened a gearbox.
   ═══════════════════════════════════════════════════════════════ */

var TX_COPY = {
  kicker: "Field study · mechanical",
  title: "The Gear Change",
  subtitle: "Six ways of failing to put a spinning shaft into a spinning gear, and the mechanisms each failure forced into existence.",
  intro: "A manual gearbox has one job the driver can feel: connect the engine to the road through one of six ratios, on demand, without destroying anything. Everything below is the safety machinery that grew around that one demand.",

  hint: "Drag to orbit · scroll to zoom · double-click to reset",
  /* the same hint on a touch screen, which has no wheel and no mouse */
  hintTouch: "Drag to turn · pinch to zoom · double-tap to reset",
  cutawayNote: "Dog teeth and cones are drawn coarse and oversized. A real synchro hides all of this in a few millimetres.",

  /* the four headings every layer card carries, in order */
  bands: {
    problem: "The failure",
    solution: "What was built",
    tradeoff: "What it costs",
    atScale: "Under load"
  },
  /* phases that mean something went wrong, so the readout can say so */
  badPhases: ["crash", "grind", "blocked"],
  /* shown on layers the reader can drive themselves */
  freeNote: {
    label: "Free shift",
    text: "The gate is live. Click a slot, or press 1-5, R, N."
  },
  /* the optional mode toggle, and the two scene modes it flips */
  altMode: { label: "1930 mode", on: "1930", off: "modern" },

  layers: [
    {
      name: "The crash box",
      era: "1894 · sliding gears",
      problem: "The first gearboxes moved the gear itself. A lever slid a spur gear along the shaft until its teeth found the teeth of the gear opposite. Both were already turning, at different speeds, and nothing in the mechanism cared.",
      beginner: "Two spinning combs can only be pushed into each other if their teeth are already moving at the same speed. Otherwise the teeth collide instead of interleaving.",
      analogy: "stepping onto a moving escalator that is running at a different speed than your legs.",
      solution: "Nothing. The driver was the mechanism: declutch, wait, guess the speed, and slide. Getting it wrong took a corner off a tooth, permanently.",
      tradeoff: "Every mis-shift was a small, cumulative, unrepairable loss of metal. Gearboxes were consumables.",
      atScale: "The failure is not rare. It happens on the shift you make wrong, which for a new driver is most of them.",
      demoLabel: "Slide a gear into mesh at the wrong speed"
    },
    {
      name: "Constant mesh and dog clutches",
      era: "1920s · the gears stop moving",
      problem: "If sliding a gear is what breaks it, stop sliding gears. Leave every pair permanently meshed and let the unwanted ones spin free on the shaft. Now only a small collar has to move, but the collar and the gear are still at different speeds when they meet.",
      beginner: "The heavy toothed wheels never move again. A small ring of blunt teeth slides across to say 'this gear, now', and that ring is what takes the abuse instead.",
      analogy: "instead of catching a moving carousel, you catch a handle bolted to it.",
      solution: "Gears permanently in mesh; each one free to turn on the mainshaft until a sliding collar of dog teeth locks it to the shaft. The damage moves to a cheap, coarse, replaceable part.",
      tradeoff: "The skill requirement did not go away, it moved. Double-declutching — clutch, neutral, blip, clutch, gear — became the price of a quiet shift.",
      atScale: "Racing gearboxes still use plain dogs. They accept the noise and the skill because dogs engage faster than anything with a friction cone in front of it.",
      demoLabel: "Meet the dogs at mismatched speed"
    },
    {
      name: "Synchromesh",
      era: "1928 · make the speeds agree first",
      problem: "The driver was still the speed-matching mechanism, and the driver is unreliable. The engagement needs to refuse to happen until the two sides are turning together.",
      beginner: "A small cone brake grips the gear and drags it up or down to the shaft's speed. Only when they match does a ring get out of the way and let the collar through.",
      analogy: "a door that will not open until the room behind it has finished moving.",
      solution: "A brass blocker ring between sleeve and gear. Pushed by the sleeve, its cone rubs the gear's cone; while any speed difference remains, the friction twists the ring half a tooth out of index and physically blocks the sleeve. When the difference dies the twisting force dies with it, the ring indexes, and the sleeve passes.",
      tradeoff: "A shift now takes as long as the friction needs. You are waiting on a brake, and you can feel it: this is why a fast shift still feels like it is being negotiated.",
      atScale: "Every mis-shift a driver never learned to make is one this ring refused on their behalf, thousands of times, out of sight.",
      demoLabel: "Watch the blocker ring refuse, then relent"
    },
    {
      name: "One rod at a time",
      era: "interlocks and lockouts",
      problem: "Selecting one gear is solved. Selecting two at once is not: two sleeves engaged on one shaft means two ratios demanding two different mainshaft speeds. The shaft cannot obey both, so something breaks or the wheels lock.",
      beginner: "The lever must be able to reach every gear, and must never be able to reach two.",
      analogy: "a railway interlocking frame: pulling one lever mechanically pins the levers that would contradict it.",
      solution: "An interlock block carrying pins between the selector rods. Moving any rod pushes the pins outward into notches in its neighbours, holding them still. Nothing has to forbid two gears at once, because the mechanism has no way to say it. Reverse gets its own lockout so the gate cannot be entered while moving forward.",
      tradeoff: "The interlock also blocks legitimate mid-shift corrections. Once a rod has moved, the gate is committed until it comes back to centre.",
      atScale: "This is inversion as engineering: list the moves that must never happen, then make the geometry incapable of expressing them.",
      demoLabel: "Try to select a second gear"
    },
    {
      name: "Reverse, the deliberate throwback",
      era: "the one they left alone",
      problem: "Reverse needs the output turning the other way, so it uses a third gear (an idler) between the countershaft and the mainshaft. Two meshes in series reverse the direction. But the idler slides into mesh exactly like an 1894 crash box.",
      beginner: "Reverse is the old machine, still installed. It works because you are supposed to be stopped when you use it.",
      analogy: "a fire door that opens the wrong way on purpose, because you only ever use it standing still.",
      solution: "A sliding idler gear, no synchro, no dogs. The engineering judgement is that a mechanism used once per journey, at zero road speed, does not earn the cost and space of a synchroniser.",
      tradeoff: "Select reverse while the car is still creeping and you hear 1894. That noise is the omitted mechanism announcing itself.",
      atScale: "Some modern boxes did finally synchronise reverse, and the reason was owners, who heard the noise and took it for a defect.",
      demoLabel: "Engage reverse while still rolling"
    },
    {
      name: "The whole shift",
      era: "every layer at once",
      problem: "A shift the driver experiences as one motion is six mechanisms firing in sequence, each one solving a failure the layer before it created.",
      beginner: "Clutch. Neutral. Cross the gate. Wait for the cone. Lock the dogs. Clutch out.",
      analogy: "a single handshake that is really a protocol.",
      solution: "Shift for yourself. Every gate move runs the full sequence and the speeds are real: watch the two needles converge before the sleeve is allowed through.",
      tradeoff: "Turn on 1930 mode to strip the synchromesh back out and feel what the blocker ring was doing for you.",
      atScale: "Six ratios, one lever, one pedal, and not one line of code.",
      demoLabel: "Shift it yourself"
    }
  ],

  phases: {
    idle: "Driving",
    clutchIn: "Clutch in: the engine side is cut loose",
    neutral: "Sleeve back to centre: neutral",
    gate: "Crossing the gate: one rod moves, the rest are pinned",
    synchro: "Cone friction dragging the gear to the shaft's speed",
    lock: "Speeds matched: the sleeve rides over the dogs",
    clutchOut: "Clutch out: torque through the new pair",
    dogTry: "Dogs meeting at different speeds",
    slide: "Gear sliding toward mesh",
    crash: "Clash: metal coming off the teeth",
    grind: "Grinding: nothing matched the idler's speed first",
    blocked: "Blocked: the interlock is already holding that rod",
    recover: "Back to where it started"
  },

  gearNames: { "-1": "R", 0: "N", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" },

  hud: { engine: "Engine", delta: "Difference", gear: "Gear", clutch: "Clutch", gate: "Gate" },
  /* what a part says when the pointer rests on it, keyed by the scene's
     part ids. Name first, then the one thing worth knowing about it. */
  parts: {
    shaftInput: "Input shaft · the engine's end of the box",
    shaftMain: "Mainshaft · the road's end of the box",
    shaftCounter: "Countershaft · always turning with the engine",
    gInMain: "Input gear · 17 teeth",
    gInCounter: "Counter drive gear · 29 teeth",
    /* g is a forward gear number; only 1 to 3 take a suffix other than -th */
    gearCounter: (g, z) => g + (["", "st", "nd", "rd"][g] || "th") + " drive gear · " + z + " teeth",
    gearMain: (g, z) => g + (["", "st", "nd", "rd"][g] || "th") + " gear · " + z + " teeth · free on the shaft",
    gRCounter: "Reverse drive gear · 15 teeth",
    gRMain: "Reverse gear · 30 teeth · fixed to the mainshaft",
    gRIdler: "Reverse idler · slides into mesh, and nothing slows it down first",
    hub34: "3-4 hub · splined to the mainshaft",
    slv34: "3-4 sleeve · the only part the driver actually moves",
    hub12: "1-2 hub · splined to the mainshaft",
    slv12: "1-2 sleeve",
    hub5: "5th hub",
    slv5: "5th sleeve",
    cb4: "4th clutch body · on the input shaft, so 4th is straight through",
    cb3: "3rd clutch body · cone and dog teeth",
    cb2: "2nd clutch body",
    cb1: "1st clutch body",
    cb5: "5th clutch body",
    blocker: "Blocker ring · refuses to index until the speeds agree",
    rod: "Selector rod",
    fork34: "3-4 shift fork",
    fork12: "1-2 shift fork",
    fork5: "5th shift fork",
    forkR: "Reverse fork · no synchro on this one",
    interlock: "Interlock block · two rods can never move at once",
    lever: "Gear lever · the only control the driver has",
    gate: "Gate plate · the H, cut in steel"
  },

  controls: {
    play: "Play", replay: "Replay", pause: "Pause", restart: "Back to start",
    explode: "Exploded", cutaway: "Cutaway", view: "View options",
    reset: "Reset view", scrubLabel: "Scrub the shift"
  },
  a11y: {
    canvas: "Three-dimensional drawing of a five-speed manual gearbox",
    gate: "Gear selector. Press 1 to 5 for a gear, R for reverse, or N for neutral.",
    rmNote: "Reduced motion is on: nothing animates on its own. Use the scrubber to move through each shift."
  },
  companion: {
    kicker: "2D Deconstruct",
    text: "Read the companion Deconstruct of the manual gearbox: the rules it must never break, its trials, and what each part maps to in software.",
    cta: "Open the Deconstruct \u2192",
    href: "../#/study/manual-gearbox"
  },
  footer: "Drawn in code from primitives, with no model file, no library and no build step: the same discipline as the rest of Vitruvian."
};
