# Field study candidates

Systems that could be built as field studies, judged against what Ink3D can actually
draw and what makes a mechanism worth drawing at all.

A candidate qualifies on two counts. **The mechanism has to be the argument** — you can
only see why the part exists by watching the failure it prevents. And **the geometry has
to be reachable**: solids of revolution, constant-section extrusions, and sections swept
along a path, moving by spin, slide, pivot, or a path you compute per frame.

Effort assumes the shell and the engine as they stand today. *Small* is a few days of
geometry over an existing pattern; *large* means new engine capability or a lot of
hand-authored geometry.

Built studies are registered in `FIELD_STUDIES` in `content.js`, which is what puts the
3D chip on a matching Deconstruct. Adding one here changes nothing until it ships.

## Strong candidates

Every one of these is a failure ladder before it is a drawing.

| System | The ladder | Effort |
|---|---|---|
| **Escapement** | Gravity runs the train down in seconds → verge lets it down in beats → anchor stops recoil → deadbeat stops it properly → detent removes friction from the impulse. The anchor is one prism, the escape wheel one gear-like revolve. | Small |
| **Differential** | Rigid axle scrubs its tyres in a turn → open differential lets the wheels differ → and now one spinning wheel takes all the torque → limited-slip → locker. The mechanism *is* the tradeoff. | Medium — bevel gears have no builder |
| **Disc brake** | Drum fades when hot → disc sheds heat → pad tapers unevenly → floating caliper → vented and cross-drilled. Everything is a revolve or a slide. | Small |
| **Four-stroke engine** | Intake, compression, power, exhaust, and the valve timing that has to agree with the crank. Piston slides, crank spins, conrod takes `pos` and `dyn` per frame. Cam and follower come free. | Medium |
| **Pin-tumbler lock** | Warded lock is defeated by a blank → pin tumblers → the shear line is pickable → security pins → sidebar. The failure and the fix are both visible at 3mm. | Small |
| **Ratchet and pawl** | Load creeps back → pawl catches → single pawl has coarse resolution → double pawl → silent ratchet. Tiny geometry, complete argument. | Small |
| **Governor (flyweight)** | Engine runs away under falling load → flyweights fly out → linkage closes the throttle → hunting → damping. Pivoting links, all `dyn`. | Small |
| **Hydraulic spool valve** | Open-centre wastes flow → closed centre → spool overlap causes deadband → underlap leaks. Concentric revolves sliding in a bore; sections beautifully. | Small |
| **Planetary gearset** | One ratio → hold the ring for reduction → hold the carrier to reverse → compound sets. `gearMesh` already does everything needed. | Small |
| **Rack and pinion steering** | Worm-and-sector wanders → rack and pinion is direct → and now it kicks back → damping → variable ratio. The rack is a prism with a tooth profile. | Small |
| **Cam and follower** | Flat follower jams → roller → the profile has to be continuous in acceleration or it hammers. This one argues about *maths* through geometry, which is rare and good. | Small |
| **Sewing machine** | The needle cannot pass through the cloth and come back with thread → lockstitch, shuttle, and the timing between them. A genuinely surprising mechanism. | Medium |

## Reachable, but the geometry is hand-built

Worth doing, but budget for authoring shapes no helper makes.

| System | What's missing | Effort |
|---|---|---|
| **Turbocharger** | Blades are twisted and tapered — `sweep` with `twist` and `scale` does it, but every blade is authored by hand and the hub is a revolve they merge onto. | Medium |
| **Lead screw / ballscrew** | The thread is `sweep` along `helixPath`, which now exists. The recirculating ball path in a ballscrew is a second sweep along a closed loop. | Medium |
| **Bicycle drivetrain** | The chain is one prism per link with `pos` written along the path each frame. ~50 parts. Derailleur geometry is the interesting half. | Medium |
| **Wankel** | The rotor is an epitrochoid prism on an eccentric path — `pos` per frame plus `spin`. Apex seals are the whole failure story and they are small. | Medium |
| **Worm drive / worm gear** | The worm is `sweep` along a helix; the wheel needs a throated tooth form that `gearProfile` does not make. | Medium |
| **Clock striking train** | Count wheel vs rack-and-snail is a real failure ladder (the count wheel loses sync and cannot recover). Mostly gears and levers, but many of them. | Large |
| **Torque converter** | Curved vanes come out crude — `prism` and `sweep` both give ruled surfaces, and a converter vane is doubly curved. Drawable, not honest. | Large |

## Not worth building

Recorded so the question does not get re-asked.

- **Every software system in the library.** A message queue has no axis of revolution.
  `renderer-diagram.js` already beats 3D at graphs — 3D buys occlusion and costs
  legibility. This is the single most important line in this file.
- **Heat exchangers, condensers, carburettors, refrigeration.** The argument is in the
  fluid and the phase change. Ink3D can show what moves; it cannot show what flows, and
  a drawing that implies otherwise is worse than no drawing.
- **Springs and dampers as a subject.** `sweep` can now draw a coil, but it cannot
  compress one — there is no per-part scale, and a spring whose whole point is deflection
  drawn rigid is a lie.
- **Anything with a compound-curvature shell.** Car bodies, turbine casings, propellers,
  boat hulls. `prism` gives constant section; `revolve` gives one axis. Neither reaches
  a doubly curved surface.
- **Sealing, gaskets, bearings under load.** The story is contact pressure and material,
  which three quantised paper washes cannot carry.
- **Anything requiring imported CAD.** No OBJ/STL loader, by design — the footer claim
  that these are drawn from primitives rather than a model file is load-bearing.

## What would widen the field

- **A bevel and helical gear builder** alongside `gearMesh`. Unlocks the differential
  properly, plus worm drives and most automotive final drives. Highest value.
- **Per-part `scale` in `Scene._world`.** Three lines. Unlocks springs that actually
  compress, and every mechanism whose argument is deflection.
- **A doubly curved surface builder** — a lofted patch between two profiles. Would reach
  turbine and pump vanes honestly. Largest of the three, and the one to do last.
