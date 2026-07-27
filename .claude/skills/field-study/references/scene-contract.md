# What `lab-page.js` requires

```js
LabPage.mount({ copy: MY_COPY, scene: MyScene, instruments: {…} });
```

Script order in the HTML matters: copy, `ink3d.js`, `lab-page.js`, scene, page.

## The scene module

```js
var MyScene = (function () {
  function create(canvas) { … return ctl; }
  var LAYERS = [ … ];
  return { create: create, LAYERS: LAYERS };
})();
```

`create(canvas)` returns a controller. The shell calls exactly these:

| method | contract |
|---|---|
| `scene` | the `Ink3D.scene` instance (property, not a method) |
| `state` | live state object; the shell reads `t`, `playing`, `phase`, `shake`, `crashed`, `mode` |
| `on(fn)` | register `fn(kind, payload)`; emit `"phase"` and `"done"` |
| `beginDemo(demo)` | run a layer's `demo` block verbatim — put the machine where the demo starts, then start it |
| `seek(u)` | pose at normalised `u`, stop playing |
| `play()` / `pause()` | resume / halt |
| `applyLayer(cfg)` | configure the stage for a layer entry |
| `camera(c)` / `resetCamera()` | `c` is `{yaw, pitch, target, radius}` |
| `orbit(dx, dy)` / `dolly(f)` | pointer camera control |
| `setExplode(v)` / `setCutaway(on)` | 0..1 and boolean |
| `setMode(m)` | optional; only needed if the copy declares `altMode` |
| `hoverLabel(x, y)` | → string or null |
| `start()` | begin the rAF loop |

The shell never touches machine state directly. That is why `beginDemo` exists: putting
the gear where a demo starts is something only the machine knows, so the shell hands the
layer's `demo` block over untouched rather than reaching into `state`.

### `applyLayer` must reset the stage completely

Every layer entry is a full description, not a delta. Reset visibility, styles, camera,
clip, explode and all mechanism state on every call. Two rules that cost real bugs on the
gearbox:

- **Do not reset what the reader owns.** The alt mode is the reader's setting and survives
  walking between layers: `if (cfg.mode) S.mode = cfg.mode;`, never `S.mode = cfg.mode || "base"`.
- **Keep the layer's declared demo profile separate from the resolved one.** Store
  `S.baseProfile` (what the layer asked for) alongside `S.profile` (what the mode makes of
  it), so toggling the mode back restores the layer's own shift rather than a generic one.

### A layer entry

```js
{
  id: "constant-mesh",              // URL hash; stable, kebab-case
  groups: ["core", "g1", "g2"],     // or ["*"] for everything
  hide: ["partId", …],              // exceptions within those groups
  dim: ["group", …],                // rendered flat, out of the argument
  ghost: ["group", …],              // dashed silhouette only
  cutaway: true,                    // section this layer by default
  explode: 0,                       // 0..1 default for this layer
  camera: { yaw, pitch, target:[x,y,z], radius },
  demo: { profile: "…", from: …, to: … },   // opaque to the shell
  free: true                        // reader may drive it themselves
}
```

`demo` is passed straight to `beginDemo`; its shape is entirely yours beyond the shell
needing it to exist for the Play button to do anything.

### Demo profiles

A demo is a pure function of one normalised `t` — never a stateful animation. One
definition then serves autoplay, the scrubber and reduced motion identically.

```js
var PROFILES = {
  modern: { dur: 2600, segs: [
    ["clutchIn", 0, 0.14], ["neutral", 0.14, 0.26], ["gate", 0.26, 0.44],
    ["synchro", 0.44, 0.74], ["lock", 0.74, 0.84], ["clutchOut", 0.84, 1]
  ] }
};
```

`segAt(profile, t)` → `{name, u, i}` where `u` is 0..1 within the segment. `pose(t)`
derives every moving part from that and nothing else. Emit `"phase"` when the segment
name changes; emit `"done"` when `t` reaches 1.

## The copy object

```js
var MY_COPY = {
  kicker, title, subtitle, intro, footer,
  hint,                       // the drag/zoom hint over the stage
  cutawayNote,                // optional; shown on layers with cutaway:true

  bands: { problem, solution, tradeoff, atScale },   // the four card headings
  badPhases: ["crash", …],                          // phases the readout marks as failure
  freeNote: { label, text },                        // optional; shown on free:true layers
  altMode: { label, on, off },                       // optional third toggle + its two scene modes

  layers: [ { name, era, problem, beginner, analogy,
              solution, tradeoff, atScale, demoLabel }, … ],
  phases: { idle: "…", … },     // one line per segment name, keyed by name
  controls: { play, replay, pause, restart, explode, cutaway, reset, scrubLabel },
  a11y: { canvas, rmNote, … }
};
```

`layers` must be the same length and order as `scene.LAYERS`. `phases` needs an entry for
every segment name any profile uses, plus `idle`.

Two registers per layer, and they are not interchangeable: `problem` is the plain
statement, `beginner` is the same fact for someone who has never opened one of these,
`analogy` is rendered after the word "Like".

## Instruments

Optional. The readouts that only mean something on this machine — a gauge, a selector, a
pressure trace.

```js
instruments: {
  build: function (root, api) { … },       // once, into the stage wrapper
  layerChanged: function (api) { … },      // optional; after every layer render
  paint: function (api) { … }              // every frame — keep it cheap
}
```

`api` gives you `ctl`, `copy`, `reducedMotion`, `layer()`, `layerIndex()`, `h()`, and
`demoStarted()`. Call `demoStarted()` whenever an instrument kicks off motion itself, so
the transport button and scrubber agree with what is on screen.

`paint` runs inside the rAF loop. Write to the DOM only what changed.

## The shell already handles

Layer stepper and hash routing, the demo transport (play/pause/replay/scrub), the three
stage toggles and **resyncing them from real scene state on every layer change**, theme,
pointer orbit / pinch / wheel / double-click reset, hover labels, `ResizeObserver`
refit, the aria-live phase announcement, reduced motion, and the `?debug=1` overlay that
exposes the controller as `window.__lab`.

Do not reimplement any of it in a study.
