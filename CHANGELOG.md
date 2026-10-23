# Changelog

All notable changes to **Vitruvian** — a zero-backend, installable PWA that deconstructs any system into a failure-driven, layer-by-layer rebuild with a growing diagram.

Live at <https://bate-epey93.github.io/vitruvian/>. The format follows [Keep a Changelog](https://keepachangelog.com/); this project versions the app (`CONFIG.appVersion`) and the service-worker cache (`CACHE_VERSION`) together, bumped on every deploy.

## [2.0.0] · 2026-10-22 · A new face
### Changed
- **The diagram is upstream's hand-drawn renderer from 1.40.0.** An earlier v2 draft redrew it in draw.io's style; that work was dropped in favour of the Rough.js version, which is still in progress.
- **The whole interface is redrawn on one design system.** Warm off-white paper and graphite ink, with colour kept for meaning only: teal for the fix and your progress, red for what breaks, amber for load and money, violet for proposals. Monospace now shows up only where the content is code or numbers, so the small all-caps labels that used to sit on every card are gone.
- **The header is light and translucent.** The brand sits on the left, and Library, Track, Models and Drill live in a centred nav island that marks where you are. While you read, the island shrinks to icons and the audience switch takes the middle. On phones the island moves to a tab bar along the bottom edge and steps aside while you read.
- **Real icons.** Thin-line SVG icons replace the unicode glyphs (◇ ◈ ↻ ⚙ ▶ ⟲ ⇉ ⌁) in the header and the diagram tools.
- **The landing page shows the product working.** A split hero puts the pitch on the left and, on the right, a live Deconstruct (the URL shortener) building itself layer by layer. Below it, three numbers read from the library itself and a bento of what Vitruvian is and how to use it.
- **The library opens with a command bar** for naming a system, and each card now carries the system's one-line essence and a strip with one bar per layer that fills as you reveal them.
- **The diagram's tools sit in one dock** under the diagram: the key, the layer scrubber, and a single toolbar with Pulse, Load, Replay, Races, Spine and GIF.
- **The layer stepper is a floating pill** that stays pinned over the prose, with a filled Next button so the way forward is obvious.
- **Each layer is four steps instead of one long page.** The problem: the diagram rewinds to the state before the layer, what fails turns red, and the failure replays once by itself. Your guess: pick which rule is about to break (each rule shows its text now, not "INV 3"), and sketch a fix if you like, with the same two hints as before. The solution: the full layer name, what was built, and the thinking model, with the new parts arriving in teal; Before, or holding B, flips the diagram back to the state it replaced. The tradeoff: what the solution costs, how it holds under load with the load path already traced, and the rules it defends, with the lenses, analogy, For engineers and Probe folded under Go deeper. The reading level decides which fold starts open.
- **One timeline replaces the step dots, Prev/Next and the scrubber.** It sits under the diagram: Meet, every layer, Trials, Transfer. Finished layers are teal and the current one shows its name. The scrubber moved the picture without moving your place, so the two could disagree; that can't happen now. Arrow keys move a step, Shift with an arrow moves a layer.
- **The diagram toolbar shows what the step can use.** Replay while you read the problem, Before while you read the solution, Pulse always. Races, Spine and GIF moved into a Lab tools menu with one line each on what they show.
- **The next move is always on screen.** Every step ends in a sticky footer with one primary button, and Skip to the fix is there unless Strict mode is on.
- **Strict mode replaces Challenge mode.** The guess is offered on every layer and never blocks. Strict mode, from the ⋯ menu or Settings, keeps the fix shut until you've sketched yours. The ⋯ menu can also show each layer as one long page, the way v1 did.
- **Generated text gets the same editing the app's own copy got.** A new `voice.js` defines the house voice once: no dashes, no stock AI vocabulary ("crucial", "seamless", "genius"…), no "not X, it is Y", no colon reveals, no theatrical openers, aphorisms, signposting, filler, or runs of clipped fragments. The same list, with a before-and-after pair for each, now goes into all four prompts (Deconstruct, Check my answer, Probe this layer, Graft); before, three of them only banned em dashes. After a Deconstruct validates, an offline checker flags any string that still trips a rule, and only those strings go back to the model in one short call that names each problem. A rewrite is kept only if it is cleaner and about the same length, and only if the whole document still validates; if the call fails, the original text stays. Short answers get a rewrite only when they carry more than one tell. It can be switched off in Settings, and the progress screen shows it as "Editing for voice".
- **The prompt's own example stopped teaching a tell.** The railway exemplar said "Its genius is not the engine; it is the invisible discipline of separation", and that exact shape had turned up in four sample essences.
- **The samples were edited to the same standard.** 28 strings across 13 samples, mostly "not X, it is Y" and stock words, rewritten by hand with the facts unchanged. `tools/validate.js` now runs the same checker and fails any sample with a tell, so they can't creep back in. The sample version is bumped so installed copies pick up the edits.
- **Meet the system is two short steps.** The overview used to front-load six blocks of abstract parts before anything broke. Now it opens on the essence and a few checkable facts, then the rules the system must never break. The timeline's Meet segment opens up to show both.
- **The System sheet holds the reference material.** What it's for, the rules, who wants what, the pieces, what flows and the limits now live in a side panel opened from a new System sheet button in the header, from any step, without losing your place. Escape closes it.
- **Rules carry their text everywhere.** The one-page view's guess and the Graft verdict's Threatens and Strengthens rows used "INV 3" with the meaning in a hover tooltip. Every place a rule appears now shows "Rule 3" with its text beside it.
- **Home is built around your own Deconstructs.** Naming a system or dissecting a design you're building comes first, then Your Deconstructs, then the samples, which are there to show what a Deconstruct looks like. Library and Drill are renamed Home and Practice, and the Track screen is gone: the samples are examples, not a course.
- **Models pages teach the idea.** Each thinking model has a page showing every place it appears in your library side by side, with the diagram at that layer, plus a short Spot it quiz on failures you haven't read and its names in other fields. Engineering vocabulary is a tab of Models.
- **Practice replaces Drill, and nothing is ever due.** A round of questions on layers you've read, whenever you want one: which thinking model cracks a failure and which rule it attacks are checked on the spot; recalling the fix or its cost shows the answer to compare against.
- **Transfer opens with a recap** of every layer and the thinking model it used, each one a link back to that layer.
- **Graft asks for your call first.** The verdict is requested the moment you run a change. While it's judged you say whether the change improves the system, is a real tradeoff or works against it, and which rule it puts most at risk. The verdict then shows your call beside it, and saved grafts keep it.
- **A Deconstruct is readable while it generates.** The essence and the rules stream in first, so they appear under the progress bar as soon as each one is complete.
- **Dissect asks three questions** instead of offering one blank box: what it does and who uses it, what must never go wrong, and where the load will come from, plus an optional fourth for anything else.
- **Settings starts with how you learn.** Reading level, Strict mode, replaying each failure on the diagram (new, on by default) and the one-page view come first. The API key, model, generation speed and voice editing sit together under Deconstructing your own systems, then backups, then About.
- **On a phone the step card is a sheet over the diagram.** Drag its handle between three heights, or tap it (or use the arrow keys on it) to step through them. The diagram takes whatever room the sheet leaves, and the height you pick is remembered.
- **Three first-run tips replace the cold start.** The first time a Deconstruct opens, three short tips ring the timeline, the step card and the diagram. Skip or Escape ends them, and Settings can show them again. The tutorial is now the Field guide, with entries for the phone sheet and the guess-first Graft.
- **Field studies read like a Deconstruct.** The gear change uses the same timeline and the same four-step card: the problem with its demo, your guess (kept on this device), the solution beside your guess and the demo again, then the tradeoff. Arrow keys walk the steps; Shift with an arrow jumps a layer.
- **Step tabs use short names** (Problem, Guess, Solution, Tradeoff) so they fit on one line on a phone. The heading above the card keeps the full name.
- **Moving through a Deconstruct is announced.** Each step change puts keyboard focus on the new step's heading without scrolling, and a live region says where you are, for example "Layer 2 of 6. The solution." Escape closes Lab tools and returns focus to its button.

### Fixed
- **Reading counts as progress.** Only the challenge gate used to mark a layer done, and gates have been off by default since 1.3, so a reader who finished a whole system still saw 0 of 6 on its card, 0 of 19 on Track and nothing in Drill. Reaching a layer's solution now marks it done. Existing installs are backfilled once from how far each reader got.
- A handful of toasts and labels still used em dashes. They now read as plain sentences.

## [2.4.0] — 2026-10-24 · It says when a system is also a machine

### Added
- **A Deconstruct can now tell you it is also a machine you could turn.** While writing a document, the model decides whether the subject is a physical mechanism worth drawing in three dimensions, and if it is, it records what moves and the failure ladder a field study of it would show. The reader sees that at the end of the document: what the mechanism does, in one monospace line, and the ladder in prose.
- **The card is a description, not a link.** No study of these is built yet, and offering to open something that does not exist is worse than offering nothing, so the card says so in as many words. The one live target inside it is a button — "I'd use this" — that records your interest on the device and nothing else. Nothing is sent anywhere.
- **The library collects them.** Under Field studies there is now a Candidates list: every flagged system you have deconstructed that has no study built, with its effort estimate and the ones you said you would use ranked first. It is a queue, in the open, rather than a promise.

### Changed
- **The bar for flagging is deliberately high.** A subject qualifies only when the mechanism is the argument and the geometry is reachable: solids of revolution, constant-section extrusions, or sections swept along a path, moving by spinning, sliding, pivoting or following a computed path. Gears, escapements, brakes, locks, pawls, valves, linkages and engines pass. Software does not — a message queue has no axis of revolution — so almost every Deconstruct carries no such card at all.

## [2.3.0] — 2026-10-23 · The app explains itself as you go
### Added
- **Thirteen tips that fire as you reach each part of the app**, one at a time, once each. They replace the three-card first-run tour, which ran in your first two minutes and could say nothing useful about Graft because you would not open Graft for a week.
- **They are on by default and stay on.** "On" costs one card the first time you meet each feature and nothing afterwards. The card itself carries an off switch, because the moment you stop wanting tips is while you are reading one, not later in Settings.
- **Settings has a Tips block**: the toggle, a count of how many are still to come, and *Show them all again* to walk the app from the start.
- A tip whose target is not on the page is skipped rather than queued, so a tip about a button this system does not have simply never fires.

### Changed
- Anyone who sat through the old three-card tour keeps those three marked as read; the other ten are new and will still appear.

## [2.2.1] — 2026-10-23 · The key agrees with itself
### Fixed
- **On a phone the contextual tools were drawn across the audience switch.** System sheet, Sequence and Graft need about 440px of bar alongside the brand, the B/E/D switch and the menu; below that their container overflowed to the left and the buttons landed on top of the switch. They now move into the ⋯ menu on narrow screens, where they click the very same buttons, so each tool has one handler rather than two that can drift. Exactly one home at every width: verified at 375px and 856px.
- **The key was drawn two different ways.** Kind entries were clean vector while the icon entries were hand-drawn, so the key disagreed with the diagram and with itself. Every entry now goes through the same sketch pass.
- **Queue and gateway were unreadable at 11px.** Three small boxes blurred into one, and two posts with a short arrow read as nothing. Queue is three uprights, a line of things waiting; gateway is an arch you pass through.
- Entries sort by the label you read rather than the id behind it, so the list is no longer alphabetical by a name nobody sees.

## [2.2.0] — 2026-10-23 · The key points at the diagram
### Added
- **The key now lists only the glyphs this diagram actually uses**, and it changes as you scrub. The railway shows four entries; YouTube's storage tier shows object store, edge cache, log and queue. Each one is drawn through the same glyph table and the same hand-drawn pass as the node, so the key is not a picture of the mark, it is the mark.
- **Tap any entry to light the nodes that carry it.** Asking "which of these is the cache" is now a tap rather than a hunt. Tap again to clear.

### Fixed
- **Cards had lost their side padding, so text sat flush against the border.** Two unrelated features had both claimed the class name `spot-card`: the diagram's tappable cards, and the Spot-it practice rows added in 2.0. The practice rule won on source order and stripped the horizontal padding from every card it touched. The practice row is now `spot-q`. Under load goes from 0px of breathing room back to 18px, and the problem and solution cards were quietly starved the same way.

### Changed
- The compact step label reads **Your guess** rather than **Guess**, matching the full label it abbreviates.

## [2.1.0] — 2026-10-23 · Nodes look like what they are
### Added
- **An optional `icon` on any node**, naming the concrete thing behind the role: database, cache, blob, index, log, queue, cdn, gateway. It draws as a small hand-drawn mark inside the shape, through the same Rough.js pass as everything else.
- **The four kinds got sharper marks too.** An actor is a person, a process is a gear, a store is still shelves, a channel is still an arrow passing through.

### Changed
- **The 19 sample systems are annotated**, 63 nodes in all. YouTube's raw upload is a blob, its transcode queue a queue, its edge caches a globe. Existing installs re-seed to pick them up.

### Notes
- **Kind and icon are kept apart on purpose, and the railway sample is the proof.** A kind is the timeless role a node plays: a store is anywhere things wait, whether that is a Postgres table, a warehouse shelf or a railway timetable. An icon is the concrete thing a particular field happens to use for that role. Because the icon is optional, the railway Deconstruct carries none at all — Station A, Timetable and Shared track draw their kinds and nothing more. One vocabulary still describes a railway and a payment ledger; software just gets to be specific when being specific helps.
- The field is optional, so nothing saved before this release breaks, and a Deconstruct with no icons looks exactly as it did.

## [1.40.0] — 2026-10-23 · The diagram is drawn by hand now
### Changed
- **Every node and edge is rendered with a hand-drawn stroke**, using Rough.js, the same engine Excalidraw draws with. It suits the enso brush mark the rest of the app is built around better than clean vector did.
- **The layout did not change.** Rough takes path data and hands back path data, so each element keeps its tag, its classes and its id. Lanes, orthogonal routing, the critical-path spine, chokepoint rings, Pulse with its per-kind tokens and backpressure, and the leader-line labels all go on working untouched. The diagram is still laid out by arithmetic; only the ink wobbles.
- Endpoints are pinned, so an edge still meets its node's port exactly and an arrowhead cannot drift off the line it belongs to. The wobble is seeded from each element's own id, so it stays put when you scrub layers instead of reshuffling on every render.
- Shapes now draw twice: a crisp solid underneath and the roughened outline over it. Filling a sketchy path ravels the edge of the fill, and Excalidraw splits them the same way.
- Rough.js is vendored at `vendor/rough.js` (27KB, MIT) rather than pulled from a CDN, because the app is offline-first and the service worker precaches it. Still no build step and no runtime dependency to install.

## [1.39.0] — 2026-09-23 · Opus 5.5 in, Haiku and Fable out
### Added
- **Claude Opus 5.5 (`claude-opus-5-5`) is the new default.** It is both the most capable of the three and the cheapest: $4 in / $20 out per million tokens, against Opus 5's $5 / $25. A Deconstruct lands around $0.45 instead of $0.55.
- Thinking is always on for this model and the default effort level is `medium`, which is what Vitruvian already asks for on a balanced run. Nothing had to change in the request to suit it.

### Removed
- **Haiku 4.5 and Fable 5 are gone from the model picker.** Haiku was the one option that could not take an effort cap, and Fable cost more than twice the new default for work this app does not need it for. The field is still free text, so any model id can be typed.
- **An install already sitting on a retired model moves to the default on next load.** Taking the button away does not unpick the model for anyone already on it, and someone left on Fable would have gone on paying Fable rates with no way back short of retyping the id. Matching is exact: `claude-fable-5-1` is a current model and is left alone, and Sonnet 5 is deliberately not migrated because it is cheaper than the default and moving anyone off it would raise their bill uninvited.

## [1.38.0] — 2026-07-26 · Opus 5 was thinking without a ceiling
### Fixed
- The effort cap is gated by a model-family pattern, and that pattern was never updated when Opus 5 became the default. Opus 5 was the one preset that both thinks by default and had no cap, so on a system with no canonical shape the thinking ate the whole token budget, the JSON truncated, and the run failed with the raw output attached. Reported against a book launch campaign, which is exactly that shape.
- Raised the output ceiling from 32k to 64k. Thinking and response text share one budget, and streaming is already on, so this bills per token generated rather than per the cap.

## [1.37.0] — 2026-07-26 · Five em dashes put back
### Changed
- A blanket ban on em dashes was a style bet, not a correctness fix, and it cost five sentences. They are back where no other mark does the job: an aside that carries its own commas mid-sentence, or an abrupt recast. Five of 206 strings, each one deliberate.

## [1.35.0] — 2026-07-27 · Some subjects are also machines
### Added
- **A Deconstruct whose subject exists as a field study now says so.** Open one and the offer sits between the essence and the failure ladder — after you know what the system is, before the argument starts, because it is a second way through the same argument rather than a detour out of it. Matching Deconstructs also carry a **3D study** chip in the library.
- The match is on unambiguous phrases only. Bare "transmission" is also what TCP does and "gear" alone catches half the industrial world, so neither qualifies; "manual transmission", "gearbox", "synchromesh" and their kin do. Verified against the false-positive cases that matter — *TCP data transmission*, *video transcoding* and *gear pump* all correctly decline.
- Only **built** studies are registered. An offer to open something that does not exist is worse than no offer, so the registry in `content.js` carries what ships and nothing else; the Field studies section of the library now renders from it rather than from a hardcoded card.
- `lab/CANDIDATES.md` — the systems worth building next, judged against what the engine can actually draw and what makes a mechanism worth drawing at all. Twelve strong candidates, seven reachable with hand-built geometry, and a list of what is deliberately out of scope, of which the first line is every software system in the library: a message queue has no axis of revolution, and 3D would buy occlusion at the cost of legibility.

## [1.34.0] — 2026-07-27 · The shell, separated from the machine
### Changed
- **A field study is now four files and a mount call.** The walkthrough, demo transport, stage toggles, camera, theme and accessibility plumbing moved out of the gearbox page into `lab/lab-page.js`, which knows nothing about any mechanism. A study supplies a copy object and a scene module; whatever readouts its machine needs — a gauge, a selector gate — it supplies as its own instruments, and the shell gives them a place to live and a frame to paint on. The gearbox page keeps only what is actually about a gearbox and drops from 428 lines to 166.
- Two boundaries moved to where the knowledge is. Putting the machine where a demo starts is something only the machine knows, so the shell now hands a layer's demo block over untouched instead of reaching into its state. And the third stage toggle is declared by the copy — its label and the two scene modes it flips — rather than the shell knowing what "1930 mode" means.
- Prose stranded in the page file — the four card headings, the free-shift note, the list of phases that count as failures, the stage hint — moved to the copy file, which is where this project keeps prose. Nothing visible changed: all twelve layer and mode combinations, gate enablement, and both replay outcomes verified identical to before the split.

## [1.33.0] — 2026-07-27 · Sweep: the shapes a lathe cannot make
### Added
- **`Ink3D.sweep(profile, path)`** — runs a closed 2D section along an arbitrary 3D path. Between them, `revolve` and `prism` cover solids of revolution and constant-section extrusions; everything else a machine is made of lives here — springs, threads, chains, belts, hoses, and blades that taper and twist. The section frame is parallel-transported rather than rebuilt from a fixed up-vector, so a path that turns through vertical does not flip the section inside out halfway along; on a closed path the residual the frame fails to close by is measured and spread over the loop, so the seam meets itself. Options for closing the loop, total twist, per-station taper, and open ends. `Ink3D.helixPath` supplies the path a coil spring or a thread runs on.
- Verified closed and manifold on straight, helical, half-turn and closed-loop paths: zero open edges, zero non-manifold edges, every wall normal facing outward and both end caps facing along the path.

### Fixed
- **A part that crosses the cut plane more than once now sections correctly.** Every hub, sleeve and clutch body cut through its axis exposes two rings, one either side of the shaft; they were being filled as a single even-odd path at one averaged depth, so rings that overlapped on screen cancelled each other into holes and the whole group sorted at the wrong distance. Each ring now carries its own depth, and a ring enclosed by another is punched out of it as its bore rather than drawn as a second face.

## [1.32.0] — 2026-07-27 · Field studies: a gearbox you can turn over
### Added
- **The Gear Change** — the first field study, at `lab/transmission.html`. A five-speed manual gearbox drawn in three dimensions, walked through the same failure ladder the rest of the library uses: sliding-gear crash box → constant mesh and dog clutches → synchromesh → selector interlock → reverse, the deliberate throwback → the whole shift, shiftable yourself through a live H-gate.
- **Ink3D** (`lab/ink3d.js`) — a ~700-line 3D engine written for this and nothing else. Canvas 2D, painter-sorted, three quantised paper washes with diagonal hatching on the darkest and ink outlines over the top: a technical plate rather than a render. Colours come from the app's own custom properties, so dark mode costs nothing. No library, no CDN, no build step — the page loads under the same `script-src 'self'` as everything else.
- **The gears actually mesh.** Only the input shaft and the mainshaft carry an integrated angle; every other gear's angle is derived from the gear driving it, so the train cannot drift out of phase no matter how long it runs. Verified by sweeping all seven meshes for polygon interference: zero clashes, ~0.8 units of visible backlash throughout.
- **Cutaway is a real section, not a hidden half.** The plane clips each polygon where it crosses, the crossing segments stitch back into rings, and those rings are filled and hatched — so a sliced shaft reads as solid metal with the far wall visible behind it, and the cut edge is a straight line instead of a sawtooth of dropped faces. Neighbouring parts get opposite hatch angles, the way a drawn section distinguishes them, and while the cut is open hatching means one thing only: the plane passes through here.
- **Exploded opens the stack the way it was assembled** — along the shaft first, so assembly order is legible, then off the shaft by how deep in the stack each part sits. The shafts hold still, the countershaft train drops clear of the mainshaft, and the reverse idler leaves along its own centre line, the one direction that clears both.
- **1930 mode takes the synchromesh out rather than describing its absence.** The blocker rings leave the bench, and any synchronised shift on any layer becomes the shift that preceded them: dogs meeting at different speeds, a clash, and the lever back where it started. It is the reader's setting, so it survives walking between layers.
- Reduced motion is a first-class path, not a fallback: nothing autoplays, and the scrubber drives the identical timeline the animation does.

## [1.31.0] — 2026-07-26 · Leader lines: no label left in the scrum
### Changed
- **A label with nowhere to sit now moves out to clear paper and runs a hairline back to the edge it names.** Before, a crowded label had two options: overlap something, or truncate. It has a third now, and it's the better one — a whole label parked in the margin beats a shortened one in the middle of the traffic.
- Truncation is still there as the last resort, but it no longer fires anywhere in the library. **Every edge label in every sample now renders in full.**
- Measured across the same 19 systems, 130 layer states and 1282 labels as the previous two passes: labels buried under another label **6 → 0**, labels behind a node box **12 → 3**, truncated labels **15 → 0**, affected layer states **12 → 3**. 32 labels use a leader. Against the original baseline three versions ago, that is 51 → 0 and 28 → 3.

## [1.30.0] — 2026-07-26 · The spine, and what would take it out
### Added
- **⌁ spine — the critical path.** One tap traces the heaviest chain of payload edges from an entry to a delivery: what a request actually waits on. Everything off it dims, because shortening anything off the spine changes nothing. Structural, so it reads standing still, on any layer, and it survives the PNG export.
- **Single points of failure.** Nodes whose removal leaves no entry able to reach any delivery get a red ring. Slow and fatal are different facts, so they get different marks. Pure reachability, tested by removal rather than approximated — the railway's chokepoint is the shared track, which is the whole story of that system in one ring.
- **What the layers cost.** The toast reports the spine against layer 0: YouTube's request path ends up 2.9× the cost it started at, recommendation feed 3.2×. Every layer added to survive a failure also added something the request has to wait for, and until now nothing in the app said so out loud.
- Weights come from the same per-kind costs the Pulse simulation uses, so the spine explains the animation rather than contradicting it. They are modelled, not measured, so the readout stays unitless — printing milliseconds nobody measured would be the one dishonest thing this could do.

## [1.29.0] — 2026-07-25 · Each kind moves load its own way
### Added
- **Per-kind flow physics.** Every token used to behave identically no matter what it passed through, which made the four kinds decorative. Now each one moves load its own way:
  - **actor** *emits* — arrivals come in bursts, not on a metronome. Smooth arrivals at the same average rate would never form a queue.
  - **store** *retains* — a write lands and ends there, raising a fill meter on the box; what leaves a store is a read, served back out on its own cadence. A store now visibly buffers between a fast writer and a slow reader. A full store drops the write, and drops it visibly.
  - **process** *transforms* — costs time. The token dwells at the node before departing.
  - **channel** *conveys* — has capacity, so it bunches a token sooner than anything else does.

## [1.28.0] — 2026-07-25 · Payloads that carry their origin, and jams that travel
### Added
- **A payload takes the shape of what emitted it.** Colour still says *where* a token came from (its source's lane); shape now says *what* — circle from an actor, square from a store, diamond from a process, capsule from a channel, mirroring the node glyphs. Colour was already carrying the lane legend, so tinting tokens by kind would have put two colour languages in one frame; shape was free. Only the arrowhead rotates to the path now, so a square never reads as a diamond.
- **Backpressure.** Congestion was local: one edge, one colour. A node taking on more than it can clear now pushes resistance *backward* — the edges feeding it stiffen into a red marching jam and their tokens slow, two hops upstream. Killing a node backs up everything behind it the same way. This is why one slow component browns out everything upstream of it, and it was previously invisible.
- Legend gains a backpressure key and a note that payloads carry their source's shape.

## [1.27.0] — 2026-07-25 · Labels that stop hiding, and hover to isolate
### Fixed
- **Edge labels no longer bury each other.** The placer only searched vertically at a fixed midpoint, so two edges meeting near the same point had nowhere to go — and burying one label under another was priced at a quarter of what hiding behind a node cost, so the placer often chose it. Labels now search in two dimensions, sampling candidate positions along the edge they name, and a collision with a sibling label costs nearly as much as a collision with a box. Where no clear slot exists at all, the label truncates and keeps its full text on hover rather than drawing something unreadable.
- Measured across the whole library — 19 systems, 130 layer states, 1282 labels: labels buried under another label fell from **51 to 6**, labels behind a node box from **28 to 12**, and affected layer states from **39 to 12**. 15 labels now truncate.
### Added
- **Hover to isolate.** On a pointer that can hover, passing over a node lights it and every edge touching it and drops the rest back — "what talks to this?" without committing to a click. Touch keeps tap-to-trace; an explicit click-trace outranks the hover preview.

## [1.26.0] — 2026-07-25 · Opus 5, and cards that carry their own colour
### Changed
- **Opus 5 is the default model.** Sonnet 5 retired from the presets. One source of truth (`CONFIG.defaultModel`) now feeds Settings, the storage seed, and the reset fallback, so there is one place to change it next time.
- **Opus 4.8 catches the declines.** Fable 5 and Opus 5 both run safety classifiers that can decline a benign request; both now send `fallbacks: "default"`, which reruns the request on Anthropic's recommended substitute (cyber declines route to Opus 4.8) in the same round trip.
- **Tinted cards are tinted all the way through.** "The purpose", the invariant (INV) items, and generation errors were accent-coloured on one edge only; they now carry the colour across the whole card as a light liquid-gloss wash, matching the problem, solution, gate, and scale cards. Text contrast checked in both themes.

## [1.25.0] — 2026-07-20 · Batch 3: the canonical products
### Added
- Six more worked Deconstructs — **Rate limiter, Search typeahead, Ride matching, Ticket booking, Payment ledger, Photo store** — the first six of the ten canonical interview products. The library reaches 19.
- Each drills into the primitives it's built from (e.g. Ticket booking → Distributed cache, Message queue; Photo store → Object storage, CDN, News feed), all resolving offline.
### Notes
- Four of the batch (real-time chat, web crawler, job scheduler, collaborative editor) hit an authoring session limit and will land in a follow-up; the six that passed validation ship now.

## [1.24.0] — 2026-07-20 · The Track, progress, and shareable Pulse
### Added
- **The Track** — a curated screen that walks the sample library as an ordered path (foundations first, then the systems built on them), with per-system completion. A study plan, not a toy box.
- **Progress you can carry** — the Track shows systems done, thinking models collected, and gates earned, plus a one-tap **branded progress card** (PNG) to share.
- **Pulse as a GIF** — a ⚏ button records a few seconds of the running simulation as a looping GIF, encoded in-browser (self-contained GIF89a/LZW, no dependencies).
- Five infrastructure-primitive Deconstructs — **Distributed cache, Object storage, Message queue, Notification system, Unique ID generator** — the second batch of the canonical set. The library reaches 13.
### Changed
- Every drill target in the library now resolves to a real nested Deconstruct offline: the primitives are exactly the ⊕ badges the product studies pointed at.

## [1.23.0] — 2026-07-20 · The library grows
### Added
- Five new worked Deconstructs, the first batch of the canonical interview set: **Video transcoding pipeline**, **Content delivery network**, **Recommendation feed**, **News feed**, and **URL shortener**. The sample library goes from 3 to 8.
- These give semantic zoom real depth: **YouTube now drills into three nested Deconstructs** (transcoding, CDN, recommendation feed), all resolving offline.
### Changed
- Library ordered so the richest hub (YouTube) leads; all eight precached for offline reading and given share pages.

---

## [1.21.1] — 2026-07-19
### Fixed
- The browser tab still carried the retired tagline (`<title>Vitruvian · Rebuild it to understand it</title>`); now matches the current one. Caught by the backlog audit.
### Added
- `POSSIBLE-UPGRADES.md` — deferred ideas, known limitations, and explicitly declined directions, compiled by mining the build session and verifying each candidate against the code.

## [1.21.0] — 2026-07-19 · The Rosetta spine
### Added
- **"Also called"** on every layer's thinking-model card: the same force in each profession's words. 97 translations across 7 domains (software, marketing, operations, living systems, markets & money, machines, institutions) hung off the 14 thinking models.
- `meta.domain` — the system's field, which decides whose word is shown first. Optional: documents without it show every domain, none marked "here".
### Changed
- Deliberately **not** a vocabulary per domain. Building parallel pattern/concept/technology libraries for six fields would be unbounded to curate, would age badly outside software, and would force a domain label onto hybrid systems. Translating the spine we already have is bounded (14 × 7), cannot mislabel, and makes transfer bidirectional — a marketer learns that frequency capping *is* rate limiting; an engineer learns that attribution *is* telemetry.
- Costs the generator nothing: a layer already names its model, so both "called here" and "called elsewhere" derive from existing fields.
- The Rosetta sits on the model card, visible in **all three registers** — the software vocabulary stays in the Developer-only For Engineers box, since a marketer reading a campaign never opens Developer mode.
- Translations are sparse by design: a model with no honest term in a domain is omitted rather than invented.

## [1.20.0] — 2026-07-19 · The engineering vocabulary
### Added
- **`VOCAB_LIBRARY`** — 52 curated entries in three tiers: **patterns** (problem shapes), **concepts** (mechanisms), **technologies** (things you deploy). Deliberately a *separate altitude* from the 14 thinking models: a model is why a layer is forced, the vocabulary is what the profession calls it.
- **"Known as" chips** in the For Engineers box (Developer mode), tagged per layer by the generator from a fixed id list — never free text.
- **The ladder** — tap a chip to climb from the timeless thinking model that forces the layer, down through concept and technology to the component you'd deploy, plus **where the same force recurs across your other Deconstructs**.
- **Vocabulary index screen**, sibling to Models, with tier filters and per-entry recurrence counts.
- **"Not yet addressed"** — Dissect (own-design) reviews now name the concerns your description hasn't answered, each with a specific consequence and rough timing (`design_gaps`).
- **Numbers to reason with** — latency/throughput/size orders of magnitude, folded into the Under load band where the scaling question is already being asked.
### Changed
- Technology tags are gated to systems that are actually software — a railway may be described with patterns and concepts as honest analogies, but never with a technology. Layers with no honest match are left untagged rather than mislabeled.
- All three flagships retrofitted with vocabulary tags (`flagshipVersion` 5 re-seeds existing installs, attempts preserved).

## [1.22.0] — 2026-07-20 · Semantic zoom
### Added
- **Nested Deconstructs.** A node that is a system in its own right now carries a ⊕ badge; tapping it opens that sub-system as its own Deconstruct, with a breadcrumb (System › Sub-system) to climb back up. Depth comes from nesting, not from crowding a single diagram, so every level stays a clean, comparable rebuild.
- Optional `visual.nodes[].expands_to` in the schema (lenient); generation may mark 2–3 genuine sub-systems per study.
- YouTube's transcoder, CDN and ranking nodes are tagged; drilling resolves to a matching library Deconstruct, or offers to generate one.

## [1.19.0] — 2026-07-19 · Simulation & diagram polish
### Added
- Payload tokens now carry a small **directional arrowhead** that rotates to the path tangent — extra at-a-glance cue for which way flow moves.
### Fixed
- **Stray "shadowy line"** during a pulse — the ink-trail's teleport branch only cleared one coordinate, leaving a segment that streaked from the origin across the diagram. The whole trail now hides on a hop/first frame.
- **Arrowheads detaching at node entries** — the chevron's concave notched tail left a gap where the thin edge line met it; replaced with a solid triangle that overlaps the line.
### Changed
- Edge labels search a tighter vertical window with a firmer pull toward their edge, so a label stays pinned to what it names instead of drifting into space.
- Crash/exit burst re-homed onto the token's inner dot so it still animates cleanly with the new arrow group.

## [1.18.1] — 2026-07-19 · Dark-mode legibility
### Fixed
- **For Engineers box** used `color: var(--paper)` (and the software-concept column too); `--paper` flips near-black in dark theme, so that text was invisible. Pinned the always-dark dev box to fixed light text.
- Retired `--faint` as a **text** colour in dark (it's a border tone) — the "Defends" labels, invariant text, footnotes, and legend note lift to `--muted`.
- White/`--paper`-on-mid-teal contrast failures fixed: dark text on the teal invariant badge and active audience segment; the segmented `.on` pill and its hover no longer use theme-flipping colours.
### Changed
- Dark palette lifted for warmth and contrast (`--ink`, `--ink-soft`, `--muted`); amber card text (analogy, gate hint, Under load) lifted to a legible gold.
- Verified with a WCAG contrast sweep across reader, settings, drill, library, models, and tutorial; light mode unchanged.

## [1.18.0] — 2026-07-19 · Liquid-glass cards, graded answers, dev "Start here"
### Added
- **Graded challenge answers** — revealing a gate now colour-codes your written answer (pass / close / miss) against the actual solution.
- **"Start here" dev approach** — the For Engineers block suggests a concrete, practical coding approach to tackle the layer's problem.
### Changed
- All reader cards converted to a uniform tinted **liquid-glass** treatment (blur, top sheen, edge highlight) instead of a coloured left stripe on a flat panel.

## [1.17.0] — 2026-07-19 · Topbar tools, challenge at the layer head, diagram fit
### Added
- **Graft** and **Sequence view** promoted from the ⋯ menu to reading-only buttons in the topbar's context zone.
- **Challenge toggle** relocated to the layer head, beside the "Layer 05 / 05" label.
### Fixed
- **Diagram top-clip on desktop** — when zoomed taller than the pane, grid centering pushed the top lane above the scrollable area (hidden under the topbar). Now uses `align-items: safe center`: centred when it fits, top-aligned when it overflows.
### Changed
- Sequence view restyled as a floating liquid-glass card.

## [1.16.1] — 2026-07-19 · Tutorial catches up
### Added
- "How to read a Deconstruct" gains a **Go deeper: simulate & interrogate** section documenting Pulse/replay, fault injection, Live HUD, race spotlight, sequence view, Probe, and Graft; plus "Trace a part" and tappable invariant chips.

## [1.16.0] — 2026-07-19 · Concurrency + behaviour
### Added
- **Race spotlight** (concurrency) — rings every node with two or more concurrent writers and counts the contention points.
- **Sequence view** (behaviour) — the current state rendered as a UML-style interaction timeline: who sends what, top to bottom, in order.
### Changed
- Graft's proposed elements now self-draw in dashed blueprint ink.

## [1.15.0] — 2026-07-18 · Simulation instrumentation
### Added
- **Live HUD** — throughput (delivered/min), in-flight count, and crashes while traffic flows; under load, delivered plateaus while in-flight climbs.
- **Fault injection** — tap any node mid-simulation to kill it; traffic piles up behind it and everything downstream starves.
- **Tappable invariant chips** — tap a "Defends INV n" chip to light the mechanism on the diagram that enforces it.

## [1.14.0] — 2026-07-18 · Pulse story + live Graft
### Added
- **Pulse story pack** — scripted incident replay (two payloads into the historical failure) with ink-splatter crashes, and control-edge gating (tokens pause at a node's door until its permission edge flashes).
- **Live Graft** — A/B the proposal on and off, pulse traffic through the grafted architecture, alternative suggestions, and an enso completion stamp.

## [1.13.1] — 2026-07-17
### Changed
- Request-a-system link hidden pending a submission workflow.

## [1.13.0] — 2026-07-17 · Warmth
### Added
- Branded splash / load screen (brush-enso self-draw).
### Changed
- Copy humanised across the app.

## [1.12.0] — 2026-07-17 · Share infrastructure
### Added
- **Deep links** — `#/study/<slug>` opens a library Deconstruct directly.
- **Share pages** — per-study `share/<slug>.html` with Open Graph / Twitter cards and brand-enso card images, generated by `tools/build-share-pages.js`.
- **Branded diagram PNG export** — the current diagram state exported with the Vitruvian mark and URL footer.
- Root Open Graph tags; "Request a system" issue link (later hidden).

## [1.11.2] — 2026-07-17
### Fixed
- Diff validation now tolerates a layer that explicitly lists edges already cascade-removed with their node — this had rejected valid generations (e.g. a manual-transmission study). Validation errors are now surfaced in the generation error screen.

## [1.11.1] — 2026-07-16 · Landing polish
### Added
- Deconstructed-enso living background on the landing page (exploded arcs, split square, drifting seal; reduced-motion aware).
### Changed
- Tighter landing copy: "Everyday systems, deconstructed one failure at a time."

## [1.11.0] — 2026-07-16 · Deconstruction lexicon + diagram overhaul
### Added
- **Deconstruction lexicon** — one metaphor family: **Deconstruct** (noun), **Dissect** (own-design review), **Graft** (what-if), **Probe** (ask a layer), **Pulse** (flow sim), **The Skeleton** (strip-down).
- **Diagram legibility overhaul** — orthogonal edge routing with ports, deterministic node ordering, delta emphasis (new elements draw in), tap-to-trace a part, and an aesthetic pass (glyphs, arrowheads, label hierarchy).

## [1.10.0] — 2026-07-16 · Claude Fable 5
### Added
- **Claude Fable 5** model preset with an automatic server-side fallback to Opus 4.8 on a classifier refusal, `stop_reason: "refusal"` handling, and a per-model cost guide in Settings.

## [1.9.0] — 2026-07-16 · What-if / Graft
### Added
- **What-if mode** — propose a change and see it ghosted onto the architecture in dashed blueprint ink, with an honest verdict (improves · mixed · harmful) argued from the system's own invariants.

## [1.8.0] — 2026-07-16 · Deconstruct your own design
### Added
- **Design-review mode** — describe a system you're building; Vitruvian rebuilds it failure-by-failure and shows what breaks first (no invented incidents; layers forced by your design's next failure).

## [1.7.0] — 2026-07-16 · Mobile diagram
### Added
- Follow-the-story auto-pan (each layer's changes pan into view), pinch-zoom and double-tap, and a collapsible on-diagram legend.
### Changed
- Topbar reclaims room while reading for the audience switch.

## [1.6.0] — 2026-07-12 · Simulation + Q&A
### Added
- **Flow simulation (Pulse)** — payloads travel the current architecture, crash red where history crashed, and congest under load.
- **Ask-this-layer (Probe)** — one bounded question per layer, answered from that layer's mechanism, saved and offline-readable.

## [1.5.0] — 2026-07-12 · Generation fix + glass
### Fixed
- Generation truncation — `max_tokens` raised to 32k with model-family effort gating, since adaptive thinking shares the output budget on newer models.
### Added
- Speed toggle (balanced / fast), always-visible diagram legend, and an app-wide **liquid glass** material pass.

## [1.4.2] — 2026-07-08
### Fixed
- Under-load path spotlight now toggles off cleanly; strokes thinned.

## [1.4.1] — 2026-07-08 · Tutorial
### Added
- Enso brush icons on the landing cards, a "How to read a study" tutorial/legend screen, and a spotlightable "Under load" path.

## [1.3.4] — 2026-07-08
### Fixed
- Landing page reachable from Settings ("About Vitruvian").

## [1.3.3] — 2026-07-08
### Fixed
- Reader topbar — the tagline no longer overlaps the audience switch.

## [1.3.2] — 2026-07-08
### Fixed
- Mobile layout blow-out — the app grid uses `minmax(0,1fr)` so the diagram can scroll horizontally instead of clipping the viewport.

## [1.3.0] — 2026-07-08 · Under load + spotlight
### Added
- Per-layer **`at_scale`** ("Under load") answering scaling / throughput questions.
- **Card → diagram spotlight** — tap a problem card to red-light what breaks, a solution card to light what's added.
### Changed
- Challenge gates are now **opt-in** (default off); the diagram renders at natural width and colours encode **lane**, not layer.

## [1.2.0] — 2026-07-08 · Landing + theming
### Added
- First-run landing page, light/dark toggle (follows the OS first run), and a home split into "Your Deconstructions" + samples.
### Changed
- Diagram renders at natural width and scrolls when the pane is narrow.

## [1.1.1] — 2026-07-08
### Fixed
- Diagram label occlusion, lane colour-coding, and page scroll.

## [1.1.0] — 2026-07-08 · Depth
### Added
- Layer strata colours, a timeline scrubber, predict-the-break micro-gates, drill mode, wet-ink gloss, and enso completion stamps.
- Renamed **System Deconstructor → Vitruvian** (trademark-checked: existing marks are in unrelated classes).

## [1.0.1] — 2026-07-08
### Fixed
- Ten review findings (flushSaves no-op, stagger overlap, strict-vs-lenient `at_scale` on restore, partial flagship seeding, theme re-apply after restore, and more).

## [1.0.0] — 2026-07-08 · Launch
### Added
- Offline-first reader with three audience registers (Beginner / Enthusiast / Developer).
- Deterministic lane-grid **diagram engine** (no auto-layout): lanes = roles, columns = order, four node kinds, three edge kinds, colour = lane.
- **BYOK generation pipeline** — browser → Anthropic, streamed, schema-validated with one repair loop.
- Three worked flagship Deconstructs (railway, WhatsApp, YouTube); installable PWA with a cache-first service worker.

---

_Vocabulary note: "studies"/"breakdowns" in early versions are the same artifact later unified as **Deconstructs** (v1.11). The IndexedDB storage key (`system_deconstructor_v1`) is retained from launch and never changes._
