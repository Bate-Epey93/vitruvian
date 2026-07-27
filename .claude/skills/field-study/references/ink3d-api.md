# Ink3D — complete surface

Canvas 2D, no dependencies, no build step. A mesh is
`{ v:[x,y,z,…], f:[{i:[idx…], n:[x,y,z], t:tier}], e:[{a,b,f0,f1,c,t}], w:[[idx…]] }`.
Faces are wound **CCW seen from outside**. Local **+z is the axis** of revolution and
extrusion. Tier-1 faces are the first thing the perf governor drops.

## Mesh builders

```js
Ink3D.revolve(section, segs, opt)
```
Spin a closed section about local z. `section` is flat `[r,z, r,z, …]`, **CCW in the r-z
plane**. `r <= 1e-6` collapses to a shared apex vertex, which is how you cap a cone or
close a shaft end. `opt.tier` (default 0), `opt.wires`.

```js
Ink3D.prism(profile, w, opt)
```
Extrude a closed 2D profile `[x,y, …]` (CCW) along z, centred: front cap at `+w/2`, back
at `-w/2`. `opt.openCaps` leaves both ends open, `opt.sideTier` (**default 1**),
`opt.wires`.

```js
Ink3D.sweep(profile, path, opt)
```
Run a closed 2D profile along a 3D path `[x,y,z, …]`. The section frame is
parallel-transported, so a path turning through vertical does not flip the section
inside out; on a closed path the residual the frame fails to close by is measured and
spread over the loop.

- `opt.closed` — join last station to first. **The path must not repeat the first point.**
- `opt.twist` — total radians across the whole path, applied linearly
- `opt.scale` — number, per-station array, or `fn(u, k)` — tapers
- `opt.up` — preferred section normal at the first station; ignored if parallel to the
  first tangent
- `opt.openCaps`, `opt.sideTier` (**default 0** — for a swept part the wall is the part)

```js
Ink3D.helixPath(r, pitch, turns, segsPerTurn, opt)
```
Returns a path. `pitch` is z per turn. `opt.phase`, `opt.z0`. Feed it to `sweep` with
`circleProfile` for a coil spring, `rectProfile` for a square thread.

```js
Ink3D.gearMesh(Z, module, width, bore, opt)      // spur only
Ink3D.dogRingMesh(rIn, rOut, width, n, chamfer, dir)
```
`gearMesh` is `prism(gearProfile(...))` plus two bore wire-loops. `dir` on `dogRingMesh`
is +1 or −1 for which way the teeth chamfer.

## Profile generators

```js
Ink3D.gearProfile(Z, module, opt)   // opt.add .85, .ded 1.0, .tip .17, .root .27
Ink3D.circleProfile(r, segs)        // segs default 20
Ink3D.rectProfile(w, h, cx, cy)     // centred on cx,cy (default 0,0)
Ink3D.arcBandProfile(rIn, rOut, a0, a1, segs)
```
`gearProfile` draws straight flanks with the tip narrower than the root, so a mating
tooth always finds daylight. Tooth arc at the pitch circle ≈ 0.43 of the pitch — the
rest is backlash you can see.

## Composition

```js
Ink3D.merge(a, b, offset)   // mutates and returns a; rebakes edges
Ink3D.xform(mesh, m)        // mutates in place, recomputes normals
Ink3D.mT(x,y,z) mRX(a) mRY(a) mRZ(a) mMul(a,b) mIdent()
```
Matrices are row-major with translation in the fourth column. `merge` marks the seam
with `f0 === -2` so every baked edge stays drawn across it. Merge only pieces of one
rigid part — merged geometry cannot move independently.

## Scene

```js
var sc = Ink3D.scene(canvas);
```

| property | meaning |
|---|---|
| `camera` | `{yaw, pitch, dist, target:[x,y,z], fov}` |
| `explodeAmount` | 0..1, multiplies every part's `explode` vector |
| `clip` | `null`, or `[nx, ny, nz, d]` — geometry with `p·n > d` is cut away |
| `lod` | 0..2, driven by the governor; 1 drops tier-1 faces, 2 drops hatching |
| `stats` | `{faces, ms}` — `faces` is queue length, not triangles |
| `reducedMotion` | mirrors the media query |
| `parts`, `byId` | the part list and an id index |

```js
sc.add(spec)          // → part
sc.get(id)
sc.invalidate()       // mark dirty; call after any state change
sc.readTokens()       // re-read CSS custom properties (theme flip)
sc.resize()
sc.fitDistance(radius, pad)   // camera distance that frames a sphere; pad default 1.12
sc.render()
sc.start(tick)        // rAF loop, tick(dt in seconds)
sc.stop()
sc.pick(x, y)         // → part or null; needs pickable:true
```

### Part spec

```js
sc.add({
  id, mesh,
  pos:   [x,y,z],      // default 0,0,0
  rot:   [rx,ry,rz],   // fixed orientation, applied X then Y then Z
  explode: [x,y,z],    // direction and distance under Exploded
  style: "solid",      // solid | dim | accent | failure | ghost
  visible: true,
  pickable: false,     // required for pick() and hover labels
  clippable: false,    // required to be cut by sc.clip
  label: "",           // hover tooltip
  group: ""            // layers show and hide by group
});
```

Transform order in `_world`: `pos + explode*amount`, then `rot` XYZ, then `dyn` XYZ,
then `axial` along local z, then `spin` about local z.

### Runtime fields a scene writes each frame

| field | meaning |
|---|---|
| `spin` | radians about the part's own local z |
| `axial` | translation along local z — sleeves, valves, plungers |
| `dyn[0..2]` | animated euler angles, applied after `rot` |
| `pos` | plain array; rewrite it for path motion, eccentrics, linkages |
| `style` | swap to `accent` or `failure` to mark a torque path or a break |

### Styles

`solid` (paper washes + hatch), `dim` (flattened, no hatch), `accent` (the live torque
path), `failure` (what just broke), `ghost` (dashed silhouette only, no fill — for cases
and enclosures).

All five read from the app's CSS custom properties, so a theme flip costs one
`readTokens()`.

## Sectioning

Set `sc.clip = [nx, ny, nz, d]`. For every `clippable` part the renderer clips each
polygon on the plane, draws the interior wall the opening reveals, and fills the rings
the cut exposes with a coarse one-way hatch. Neighbouring parts alternate hatch angle.
A ring enclosed by another is punched out of it as a bore. While a cut is open the
shading hatch stands down, so hatching means only "the plane passes through here".

This needs **closed meshes** — an open mesh gives open rings and fills wrong. Every
builder produces closed solids.
