/* ═══════════════════════════════════════════════════════════════
   THE BEAT — copy
   ───────────────────────────────────────────────────────────────
   All strings live here; the page file contains no prose, the same
   split content.js keeps with engine.js. Two registers per layer:
   the plain statement, and the analogy for someone who has never
   opened a clock.

   The numbers in this file are the published performance of each
   escapement in a good example of its own period, not measurements
   taken from this drawing. They are here because the ladder only
   makes sense if the sizes are real.
   ═══════════════════════════════════════════════════════════════ */

var ESC_COPY = {
  kicker: "Field study · mechanical",
  title: "The Beat",
  subtitle: "Five ways of letting a wound spring down slowly, and why each one was not slow enough.",
  intro: "A clock is two machines married badly. One stores energy and wants to release all of it at once. The other counts. The escapement is the joint between them, and almost every advance in timekeeping for six hundred years was a change to that joint.",

  hint: "Drag to orbit · scroll to zoom · double-click to reset",
  cutawayNote: "Three things here are drawn larger than life. Pallets and teeth, because a wristwatch escapement is the width of a fingernail. The swing, because an anchor pendulum really moves five degrees and five degrees is nothing to look at — the readout shows the real figure beside the drawn one. And the recoil, because an escapement that does not visibly recoil is a drawing of nothing. Which escapements recoil at all is not exaggerated: two of these five do it exactly zero times.",

  /* the four headings every layer card carries, in order */
  bands: {
    problem: "The failure",
    solution: "What was built",
    tradeoff: "What it costs",
    atScale: "Under load"
  },
  /* phases that mean something went wrong, so the readout can say so */
  badPhases: ["runaway", "recoil", "stall", "trip"],
  /* shown on layers the reader can drive themselves */
  freeNote: {
    label: "Free bench",
    text: "Every escapement is on the bench. Pick one, then drag the mainspring."
  },
  /* the optional third stage toggle, and the two scene modes it flips */
  altMode: { label: "Slow motion", on: "slow", off: "real" },

  layers: [
    {
      name: "The foliot",
      era: "c.1300 · the first escapement",
      problem: "A weight on a rope turns a wheel train. Nothing in that sentence mentions time. Left alone the weight falls, the train screams up to speed, and a day of stored energy is gone in about four seconds.",
      beginner: "Winding a clock stores a fall. Without something to let that fall out in small pieces, it is not a clock, it is a dropped stone with gears attached.",
      analogy: "pouring a jug out through a tap instead of over the lip.",
      solution: "A crown wheel with saw teeth, and a vertical staff across its face carrying two flags set about ninety degrees apart. A tooth pushes one flag, the staff turns, the other flag swings into the path of a tooth on the far side and stops the wheel. The wheel is let down one tooth per swing. At the top of the staff a weighted bar, the foliot, carries the momentum across.",
      tradeoff: "The foliot is a flywheel, not a timekeeper. It has no period of its own — it swings as fast as it is pushed. Push harder and the clock runs faster, which is exactly what a heavy weight does, and what a nearly-unwound weight stops doing.",
      atScale: "Fifteen minutes a day was a good one. Monastery clocks were reset against a sundial whenever the sun was out, and the hour hand was the only hand worth fitting.",
      demoLabel: "Let it down, one tooth per swing"
    },
    {
      name: "The pendulum",
      era: "1656 · Huygens",
      problem: "The foliot's rate is set by whatever is pushing it. Any change in the drive — a heavier weight, a dry pivot, a cold morning thickening the oil — is a change in the time.",
      beginner: "Replace the thing that swings as hard as you push it with a thing that swings at its own speed no matter how you push it.",
      analogy: "a child on a swing, who takes the same time per swing whether you push gently or hard. Only the height changes.",
      solution: "Hang the oscillator instead of balancing it. A pendulum's period comes from its length and from gravity, and almost not at all from how hard it is pushed. The same verge and crown wheel, now with a pendulum where the foliot was.",
      tradeoff: "The verge needs a wide swing to work — eighty degrees or more. A pendulum is only truly isochronous at small arcs: over about five degrees the period grows with the swing, so the drive force leaks back into the rate through the width of the arc instead of through the speed of the bar.",
      atScale: "From fifteen minutes a day to about fifteen seconds. One change, a sixty-fold improvement, and the minute hand becomes worth fitting.",
      demoLabel: "Swing wide, as the verge demands"
    },
    {
      name: "The anchor",
      era: "c.1670 · Clement",
      problem: "The wide arc is the verge's fault, not the pendulum's. The geometry puts the pallets across the face of the wheel, and that forces the staff through a large angle for every tooth.",
      beginner: "Move the pallets to the rim of the wheel instead of across its face, and the same tooth can be caught with a much smaller movement.",
      analogy: "catching a door by its handle rather than by its hinge — far less movement at your end for the same movement at the door.",
      solution: "An anchor straddling the rim of the escape wheel, pivoted above it, with a pallet reaching down on each side. The pendulum now works through four to six degrees, deep in the region where its period does not care about its amplitude. It also makes the long seconds pendulum practical, and with it the longcase clock.",
      tradeoff: "The pallet faces are flat, so after a tooth drops, the pendulum's remaining swing drives the wheel backwards. That is recoil: the whole train, and the weight behind it, are pushed back against the pendulum every beat. The drive force is coupled to the pendulum again, through a different door.",
      atScale: "Ten seconds a day in a good longcase, and visible on the dial: watch the second hand of a recoil clock and it steps forward, then twitches back, every beat.",
      demoLabel: "Watch the wheel step back after each drop"
    },
    {
      name: "The deadbeat",
      era: "1715 · Graham",
      problem: "Recoil hands the mainspring a lever on the pendulum. Any change in drive force changes how hard the wheel pushes back, and so changes the arc and the rate.",
      beginner: "After the pallet catches a tooth, give the pendulum somewhere to go that does not move the wheel at all.",
      analogy: "a revolving door with a stop: push past it and your hand slides along the stop. The door does not come back at you.",
      solution: "Shape each locking face as an arc of a circle centred on the pallet arbor. While the pendulum finishes its swing, the tooth slides along that arc at a constant radius, so it exerts no turning force on the wheel and takes none. The wheel is dead between beats, which is the name.",
      tradeoff: "The impulse is still handed over by one piece of steel sliding on another under the full pressure of the train. That contact needs oil. Oil thickens, creeps, and goes acid, so the rate drifts over months in a way the mechanism cannot correct.",
      atScale: "A second a day in a decent regulator, and a quarter of that in a good one on a stone wall in a cellar. This is the escapement that ran observatories until electricity arrived.",
      demoLabel: "Slide along the locking arc, no recoil"
    },
    {
      name: "The detached lever",
      era: "1754 · Mudge",
      problem: "Every escapement so far keeps a hand on the oscillator for the whole of its swing. A pendulum in a cellar can live with that. A balance wheel in a pocket, being carried, turned over and knocked, cannot — and none of this works lying on its side anyway, because the pendulum's restoring force is gravity.",
      beginner: "Let go of the oscillator. Touch it once per swing, for as little time as possible, and leave it alone the rest of the time.",
      analogy: "keeping a swing going with one push per pass, your hand off the chains in between, rather than walking alongside holding on.",
      solution: "A balance wheel with a hairspring, which gives a period from spring and inertia and does not care which way up it is. Between it and the escape wheel sits a lever. For most of the vibration the lever is locked against a banking pin and the balance is free. Once per swing a jewel on the balance's roller enters the lever's notch, unlocks it, receives one impulse, and leaves. Draw — a few degrees of angle cut into the locking faces — makes train pressure pull the lever back into lock instead of out of it, and a guard pin riding a safety roller stops the lever unlocking out of turn when the watch is knocked.",
      tradeoff: "More parts, smaller parts, and every one of them critical. The lever escapement has about a dozen adjustments that must all be right at once, which is why watchmaking became a trade of its own rather than a branch of blacksmithing.",
      atScale: "Not more accurate than a Graham regulator — a good wristwatch keeps a few seconds a day where the regulator keeps a fraction of one. It is accurate while being carried, which the regulator is not at any price. Essentially every mechanical watch made since 1900 uses this escapement.",
      demoLabel: "Unlock, impulse, and let go"
    },
    {
      name: "Five joints",
      era: "the whole ladder",
      problem: "Each escapement on this bench was built because the one before it coupled the drive force to the rate through some path its maker had not noticed.",
      beginner: "The question was never “how do I measure time”. It was always “how do I stop the thing that drives the clock from having an opinion about the clock”.",
      analogy: "five attempts at the same hinge, each one closing a gap the last one left open.",
      solution: "Pick a mechanism and drag the mainspring. The rate readout is the whole argument: the foliot swings with it, the pendulum resists, the anchor leaks it back through recoil, the deadbeat nearly stops it, and the lever lets go of the balance entirely.",
      tradeoff: "Six hundred years for four orders of magnitude, and the last one was bought by giving up contact rather than by making contact better.",
      atScale: "Every one of these is still running somewhere. The lever by the hundred million.",
      demoLabel: "Change the drive and watch the rate"
    }
  ],

  phases: {
    idle: "Beating",
    lock: "Locked — the tooth resting on a pallet",
    release: "Unlocking — the pallet clearing the tooth",
    impulse: "Impulse — the one push this swing gets",
    drop: "Drop — the next tooth falling onto the other pallet",
    dead: "Dead — the tooth sliding on the locking arc, wheel still",
    recoil: "Recoil — the pendulum driving the wheel backwards",
    runaway: "Runaway — nothing is metering the train",
    supplementary: "Free — the balance swinging with nothing touching it",
    unlock: "The roller jewel entering the notch",
    trip: "Tripped — the lever unlocked out of turn",
    stall: "Stalled — not enough drive to clear the lock",
    recover: "Back to where it started"
  },

  mechNames: {
    foliot: "Foliot",
    pendulum: "Verge",
    anchor: "Anchor",
    deadbeat: "Deadbeat",
    lever: "Lever"
  },

  hud: {
    rate: "Rate",
    drift: "Drive sensitivity",
    beat: "Beat",
    amp: "Amplitude",
    drive: "Mainspring"
  },
  /* The two readouts are not the same claim, and the study falls apart if
     they are read as one. Rate is how wrong the clock is. Sensitivity is
     how much of that wrongness the drive force is responsible for, which
     is the only number that improves all the way down the ladder. */
  hudNote: {
    rate: "Seconds gained or lost per day, for a good example of this escapement.",
    drift: "How much of that rate moves when the mainspring does. This is the number the ladder is about."
  },
  driveLabels: { low: "Nearly run down", mid: "Half wound", high: "Fully wound" },

  controls: {
    play: "Play", replay: "Replay", pause: "Pause", restart: "Back to start",
    explode: "Exploded", cutaway: "Cutaway",
    reset: "Reset view", scrubLabel: "Scrub the beat"
  },
  a11y: {
    canvas: "Three-dimensional drawing of a clock escapement",
    mech: "Escapement on the bench. Press 1 to 5 to change it.",
    drive: "Mainspring force, from nearly run down to fully wound.",
    rmNote: "Reduced motion is on: nothing animates on its own. Use the scrubber to move through each beat."
  },
  footer: "Drawn from primitives, not from a model file. No library, no build step — the same discipline as the rest of Vitruvian."
};
