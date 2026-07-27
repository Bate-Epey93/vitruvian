---
name: field-study
description: Build a 3D field study for Vitruvian — a mechanism drawn from primitives in Ink3D and walked through the same failure ladder the rest of the library uses. Use when adding or editing anything under lab/, when authoring geometry or kinematics with Ink3D (revolve, prism, sweep, gearMesh), when writing a scene module or layer set for a machine, or when asked to render a mechanism in 3D. Also use when judging whether a system belongs as a field study at all.
---

# Field study

A field study is one machine, drawn in three dimensions, taken apart along the same
argument the rest of Vitruvian runs on: *here is the failure, here is what was built
to survive it, here is what that cost.* The gearbox at `lab/transmission.html` is the
worked example; read it before building a second one.

The whole thing is four files and no build step:

| file | what it owns |
|---|---|
| `lab/ink3d.js` | the engine. Knows nothing about any machine. Shared. |
| `lab/lab-page.js` | the shell: walkthrough, transport, toggles, camera, theme, a11y. Shared. |
| `lab/<study>-scene.js` | the machine: geometry, kinematics, demo profiles, layers. |
| `lab/<study>-copy.js` | every string. No prose lives in a page or scene file. |
| `lab/<study>-page.js` | only the readouts that mean something on *this* machine. |

`references/ink3d-api.md` is the complete engine surface. `references/scene-contract.md`
is what `lab-page.js` requires of a scene module and a copy object. Read the one you
need; don't guess either.

## First decide whether it should exist

A field study earns its place when the mechanism **is the argument** — when you can
only see why the part exists by watching the failure it prevents. The blocker ring is
a good study because "it stops the sleeve engaging until the speeds agree" is a
sentence, but watching the sleeve get refused is an understanding.

Say no to:

- **Abstract systems.** A message queue has no axis of revolution. `renderer-diagram.js`
  already beats 3D at graphs — 3D buys occlusion and costs legibility.
- **Machines whose story is material, thermal or fluid.** A heat exchanger's argument is
  in the fluid. Ink3D can show what moves; it cannot show what flows.
- **Anything needing compound curvature or deformation.** See the envelope below.

## What the engine can actually make

Two builders carry almost everything: `revolve` (lathe a closed r-z section about local
z) and `prism` (extrude a closed 2D profile along z). `sweep` runs a section along an
arbitrary 3D path and covers what neither can — springs, threads, chains, belts, hoses,
blades that taper and twist.

Motion per part is four things: `spin` about its own axis, `axial` along that same axis,
`dyn` (three euler angles), and `pos`, which a scene may rewrite every frame. That last
one is the escape hatch — path motion, eccentrics and linkages all come from writing
`pos` in the kinematics step.

**In reach:** escapements, cam and follower, ratchet and pawl, planetary gearsets, rack
and pinion, disc brakes, spool valves, pin-tumbler locks, gear pumps, governors, watch
trains, four-stroke and radial engines, the Wankel (an epitrochoid prism on an eccentric
path), clutch packs, sewing-machine and typewriter linkages.

**Hand-built, no helper exists:** bevel, helical and worm gears (`gearMesh` is spur only);
twisted blades are `sweep` with `twist` and `scale`; chains and belts are one prism per
link with `pos` written along the path.

**Out of reach:** compound-curvature shells, imported CAD (no OBJ/STL loader), textures,
shadows, real deformation, and anything photoreal — three quantised washes is the entire
shading model, on purpose.

## The order to build in

**1. Copy first, geometry last.** Write the six layers as prose before drawing anything.
If a layer's failure cannot be stated in one sentence, the layer is wrong, and no amount
of geometry rescues it. The layer set *is* the study; the drawing serves it.

**2. Get the real dimensions.** The gearbox uses a real centre distance, real tooth
counts, and derives module from them (`M_DRIVE = 2 * C / (Z_IN + Z_CD)`). Numbers that
came from the machine make the drawing look right for reasons you don't have to chase.
Where a dimension must be exaggerated to be visible — the gearbox's dog teeth and cones
are — say so in `cutawayNote`. Never silently fake a proportion.

**3. Derive, never integrate twice.** This is the rule that keeps a mechanism honest over
long runs. Integrate an angle for the *driving* member only; derive every driven member
from the thing driving it. The gearbox integrates `thInput` and `thMain` and derives all
seven meshes through `meshAngle`, so the train cannot drift out of phase no matter how
long it runs. Two independently integrated shafts will separate, and it will look like a
rendering bug rather than the arithmetic error it is.

**4. A demo is a pure function of one normalised `t`.** Write the motion as `pose(t)`,
never as a stateful animation. One definition then serves autoplay, the scrubber and
reduced motion identically — which is the only way the reduced-motion path can be a real
path rather than a degraded one. Profiles are named segment lists (`clutchIn`, `gate`,
`crash`…); `segAt(profile, t)` gives you the segment and a local 0..1.

**5. Layers control the stage, not the geometry.** A layer entry says what is on the
bench (`groups`, `hide`), where the camera stands, whether it is sectioned, and which
demo it argues with. Build every part once; let layers reveal them.

## Things that will bite you

**Winding.** Faces are CCW seen from outside. `revolve` wants its section CCW in the r-z
plane; mirroring a section for a part that faces the other way reverses the winding, so
flip the point order back (see `clutchBodyMesh`). Backfaces are culled, so a part with
inverted winding renders as a hole, not as a warning.

**The axis convention.** Local +z is the axis of revolution and extrusion. The gearbox
puts shafts on world x with `AXROT = [0, HALF_PI, 0]`. Pick one and hold it.

**LOD tiers.** `f.t > 0` faces are the first thing the perf governor drops at lod ≥ 1.
`prism` defaults its walls to tier 1; `sweep` defaults to tier 0 because for a swept part
the wall *is* the part. If your object vanishes under load, that is why.

**Sectioning wants closed meshes.** `sectionRings` stitches crossing segments into rings.
An open mesh yields open rings and fills wrong. Every builder produces closed solids —
keep it that way, and set `clippable` on everything on the bench. A cutaway that spares
half the assembly reads as a bug, because it is one.

**Painter's algorithm.** Sorting is per face by mean depth. Interpenetrating solids
z-fight. Meshing gear teeth survive because they are thin and sort individually; two
overlapping blocks will not.

**Merged sub-meshes.** `merge` marks the seam with `f0 === -2` so every baked edge stays
drawn. Don't merge parts that need to move independently — merge is for one rigid part
built from several pieces.

## Verify in the browser, not by reading

Serve with the `deconstructor` launch config and open `lab/<study>.html?debug=1`, which
exposes the controller as `window.__lab` and prints frame cost. Then check, at minimum:

- **Interference.** Sweep every mesh pair that should mesh and assert no polygon overlap.
  The gearbox verified all seven meshes: zero clashes, ~0.8 units of visible backlash.
- **Closed and manifold.** Every edge shared by exactly two faces; every wall normal
  pointing away from the part's own axis or path.
- **Toggle truth.** Walk every layer in both modes and assert each button's lit state
  matches the scene state it claims to control. This is where the gearbox's real bugs
  were: buttons lit over state a layer had quietly reset.
- **Both mode outcomes.** Sample `pose(t)` across 0..1 and check the phase sequence
  differs the way the copy promises.
- **Frame cost.** Median under ~8 ms with every toggle on; the governor sheds detail at 20.

A stale service worker will serve you old files and waste an hour. If a change doesn't
appear, unregister it and clear caches before debugging anything else.

## Shipping

Add the new files to `SHELL` in `sw.js`, bump `CACHE_VERSION` and `CONFIG.appVersion`
together, add a card in `renderLibrary()` in `engine.js`, and write the CHANGELOG entry.
The comment in `sw.js` means it: bump on every deploy, including content edits.
