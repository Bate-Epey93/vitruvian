/* ═══════════════════════════════════════════════════════════════
   VITRUVIAN — DIAGRAM ENGINE (§5)
   ───────────────────────────────────────────────────────────────
   Deterministic lane layout — no graph auto-layout, ever. The AI
   assigns lane + order; this file does arithmetic:
   · lanes = horizontal bands, order = column, kind = glyph.
   · COLOR ENCODES LANE (People, Trains&track, Control, Money…):
     each lane has a hue; a node wears its lane's color, and an
     EDGE wears the color of the lane its INPUT comes from (its
     source node's lane). Edge KIND stays in the dash pattern
     (payload solid · control dashed · money dotted). Lane bands
     and left-edge labels are tinted to serve as the legend.
   · viewBox is computed from the FINAL state so the diagram never
     jumps or rescales between layers.
   · Edge labels render in a TOP layer and are placed to avoid the
     node boxes, so no label ever hides behind a shape.
   · Diagram.mount(container, doc) → { show, layout, laneColor }
       show(uptoLayer, { highlight, animate }) renders baseline +
       diffs 1..uptoLayer; highlight pulses the ids the NEXT layer
       will fix (gate state).
   All SVG built via DOM APIs; labels are text nodes — generated
   content is structurally inert here (§13).
   ═══════════════════════════════════════════════════════════════ */

var Diagram = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const NODE_W = 110, NODE_H = 44, ACTOR_R = 20;
  const LANE_H = 100, COL_W = 132, GUTTER = 18, PAD_TOP = 8, PAD_BOTTOM = 12;
  const CELL_GAP = 6;   // vertical gap between co-located nodes in one lane+order cell

  /* Lane palette — assigned by lane order. Distinct hues, all legible
     as 1.8px strokes and 9px labels on warm paper, and distinct from
     the failure red used for the "what breaks" pulse. */
  const LANE_COLORS = ["#2f6f5e", "#b5651d", "#3a5bb0", "#9a3f6f", "#5f7d2e"];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(node, s) { node.appendChild(document.createTextNode(s)); return node; }
  function overlap(a, b, pad) {
    return !(a.x0 > b.x1 + pad || a.x1 < b.x0 - pad || a.y0 > b.y1 + pad || a.y1 < b.y0 - pad);
  }

  /* ── Sketch pass ──
     Rough.js is the engine Excalidraw draws with. It takes path data, roughens
     the geometry, and hands back ordinary path data — so nothing about the
     document changes. Every element keeps its tag, its classes and its
     data-id, which is what lets the flow simulation go on measuring an edge
     with getPointAtLength, the arrowhead markers go on sitting at the ends,
     and the spine, congestion and spotlight classes go on landing where they
     did. The diagram is still laid out by arithmetic; only the ink wobbles.

     Three settings carry it:
     · preserveVertices pins the endpoints, so an edge still meets its node's
       port exactly and an arrowhead cannot drift off the line it belongs to.
     · disableMultiStroke keeps each shape ONE path. Rough's default is two
       overlapping strokes, which would have turned a single .dg-epath into a
       group and broken every lookup above.
     · The seed comes from the element's own id, so the wobble is the same on
       every render. Without that the whole diagram would reshuffle its jitter
       each time you moved the layer scrubber, and shimmer while you scrubbed. */
  const SKETCH = { roughness: 0.9, bowing: 0.85, disableMultiStroke: true, preserveVertices: true };
  const roughGen = (typeof rough !== "undefined" && rough.generator) ? rough.generator() : null;
  const sketchCache = new Map();
  function seedOf(id) {                       // FNV-1a: small, stable, no deps
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h) % 2147483647;
  }
  /* d → roughened d. Falls back to the exact geometry whenever rough is
     missing or chokes, so a failure here costs the look and nothing else. */
  function sketch(d, id, extra) {
    if (!roughGen || !d) return d;
    const key = id + "|" + d;
    const hit = sketchCache.get(key);
    if (hit) return hit;
    let out = d;
    try {
      const paths = roughGen.toPaths(roughGen.path(d, Object.assign({ seed: seedOf(id) }, SKETCH, extra)));
      if (paths.length && paths[0].d) out = paths.map(p => p.d).join(" ");
    } catch (err) { /* keep the exact path */ }
    if (sketchCache.size > 4000) sketchCache.clear();   // bounded: ids × positions
    sketchCache.set(key, out);
    return out;
  }
  function roundRectD(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0) return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
    return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r}`
         + ` v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r}`
         + ` h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r}`
         + ` v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
  }
  function circleD(cx, cy, r) {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
  }

  /* ── Layout: column x + lane-center y, sized to the union of every
     node that ever exists so the viewBox never rescales. Vertical
     stagger is applied per-state in show(). ── */
  function computeLayout(doc) {
    const lanes = doc.visual.lanes;
    const laneY = {}, laneIndex = {};       // lane id → band top / palette index
    lanes.forEach((l, i) => { laneY[l.id] = PAD_TOP + i * LANE_H; laneIndex[l.id] = i; });

    const allNodes = [...doc.visual.nodes];
    doc.layers.forEach(L => allNodes.push(...L.diff.add_nodes));

    let maxOrder = 0;
    allNodes.forEach(n => { if (n.order > maxOrder) maxOrder = n.order; });

    const width = GUTTER + (maxOrder + 1) * COL_W + GUTTER;
    const height = PAD_TOP + lanes.length * LANE_H + PAD_BOTTOM;

    const pos = {};
    allNodes.forEach(n => {
      pos[n.id] = { x: GUTTER + n.order * COL_W + COL_W / 2, y: laneY[n.lane] + LANE_H / 2 };
    });
    return { lanes, laneY, laneIndex, pos, width, height, maxOrder };
  }

  /* ── State N = baseline + diffs 1..N, honoring remove ── */
  function stateAt(doc, upto) {
    const nodes = new Map(), edges = new Map();
    doc.visual.nodes.forEach(n => nodes.set(n.id, n));
    doc.visual.edges.forEach(e => edges.set(e.id, e));
    for (let i = 0; i < upto && i < doc.layers.length; i++) {
      const d = doc.layers[i].diff;
      d.remove.forEach(id => {
        if (nodes.delete(id)) {
          [...edges.values()].forEach(e => { if (e.from === id || e.to === id) edges.delete(e.id); });
        } else edges.delete(id);
      });
      d.add_nodes.forEach(n => nodes.set(n.id, n));
      d.add_edges.forEach(e => edges.set(e.id, e));
    }
    return { nodes, edges };
  }

  /* ── Abstraction: fold what the reader has already been shown ──────────
     Past a few layers a diagram carries more settled machinery than argument,
     and the layer's actual point is buried in it. Folding collapses everything
     introduced before the last `keep` layers into one box per lane, which
     takes the lane's own name.

     By lane rather than into a single box, deliberately: one box for the whole
     past would have every edge in the diagram touching it, which says nothing.
     By lane you get two or three, the flow still reads left to right, and the
     labels are free and correct.

     The first version of this kept every node the current layer's EDGES
     touched, and folded almost nothing — at the last layer of a real document
     nearly every node is reached by some new edge. What the reader needs
     expanded is what the argument just added.

     Pure: a state goes in, a state comes out, and nothing downstream knows.
     The sim, the spine, the races and the key all run on the result as though
     the folded boxes had always been components. ── */
  function foldState(st, doc, upto, keep, open) {
    const live = new Set();
    for (let i = Math.max(0, upto - keep); i < upto; i++) {
      ((doc.layers[i] || {}).diff || { add_nodes: [] }).add_nodes.forEach(n => live.add(n.id));
    }
    const byLane = new Map();
    st.nodes.forEach(n => {
      if (live.has(n.id)) return;
      if (!byLane.has(n.lane)) byLane.set(n.lane, []);
      byLane.get(n.lane).push(n);
    });

    const nodes = new Map(), memberOf = new Map();
    st.nodes.forEach(n => { if (live.has(n.id)) nodes.set(n.id, n); });
    const laneLabel = {};
    (doc.visual.lanes || []).forEach(l => { laneLabel[l.id] = l.label; });

    byLane.forEach((members, lane) => {
      /* one component on its own is not an abstraction, it is the component;
         and a lane the reader has opened stays open */
      if (members.length < 2 || (open && open.has(lane))) {
        members.forEach(n => nodes.set(n.id, n));
        return;
      }
      const id = "fold:" + lane;
      nodes.set(id, {
        id, lane,
        order: Math.min.apply(null, members.map(m => m.order)),
        kind: "process",
        label: laneLabel[lane] || lane,
        folded: members.length,
        members: members.map(m => m.id)
      });
      members.forEach(m => memberOf.set(m.id, id));
    });

    /* Rewire. An edge now wholly inside one box is interior and goes; edges
       that land on the same pair merge and carry the count, so the drawing
       never claims one path where there were three. */
    const merged = new Map();
    st.edges.forEach(e => {
      const from = memberOf.get(e.from) || e.from;
      const to = memberOf.get(e.to) || e.to;
      if (from === to) return;
      const key = from + ">" + to;
      const hit = merged.get(key);
      if (hit) {
        hit.n++;
        if (hit.label !== e.label) hit.label = hit.n + " paths";
        if (e.kind === "payload") hit.kind = "payload";    // payload outranks money/control on a merged line
        else if (e.kind === "money" && hit.kind !== "payload") hit.kind = "money";
        return;
      }
      merged.set(key, Object.assign({}, e, { id: "fold:" + key, from, to, n: 1 }));
    });
    const edges = new Map();
    merged.forEach(e => edges.set(e.id, e));
    return { nodes, edges, memberOf };
  }

  /* ── Edge routing: orthogonal with port discipline. Forward edges leave
     the source's RIGHT side and enter the target's LEFT side (mirrored when
     flowing backward), so arrows read with the column flow. Lane-to-lane
     edges run their vertical segment in the inter-column channel just before
     the target — nodes never occupy channel x, so verticals cross nothing.
     Parallel verticals in one channel fan out by a small deterministic
     offset. Corners are rounded. ── */
  const CORNER = 8;
  function roundedPath(pts) {
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], prev = pts[i - 1], next = pts[i + 1];
      const r = Math.min(CORNER, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2);
      const ix = p.x - Math.sign(p.x - prev.x) * r, iy = p.y - Math.sign(p.y - prev.y) * r;
      const ox = p.x + Math.sign(next.x - p.x) * r, oy = p.y + Math.sign(next.y - p.y) * r;
      d += ` L ${ix} ${iy} Q ${p.x} ${p.y} ${ox} ${oy}`;
    }
    return d + ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  }
  function halfW(n) { return n.kind === "actor" ? ACTOR_R : NODE_W / 2; }
  function halfH(n) { return n.kind === "actor" ? ACTOR_R : NODE_H / 2; }
  function edgePath(e, pos, ctx) {
    const A = ctx.nodes.get(e.from), B = ctx.nodes.get(e.to);
    const a = pos[e.from], b = pos[e.to];
    const dx = b.x - a.x;

    if (Math.abs(dx) < 6) {                               // same column → vertical
      const down = b.y > a.y ? 1 : -1;
      const y1 = a.y + down * (halfH(A) + 2), y2 = b.y - down * (halfH(B) + 6);
      return { d: `M ${a.x} ${y1} L ${a.x} ${y2}`, mx: a.x + 3, my: (y1 + y2) / 2, sameLane: false };
    }

    const dir = dx > 0 ? 1 : -1;
    const x1 = a.x + dir * (halfW(A) + 2);                // exit port
    const x2 = b.x - dir * (halfW(B) + 6);                // entry port (arrow inset)

    // a horizontal blocker between the ports at this height?
    const blockedAt = y => {
      let hit = false;
      ctx.nodes.forEach(n => {
        if (n.id === e.from || n.id === e.to) return;
        const p = pos[n.id];
        if (p && Math.abs(p.y - y) < NODE_H * 0.9 &&
            p.x > Math.min(x1, x2) + 4 && p.x < Math.max(x1, x2) - 4) hit = true;
      });
      return hit;
    };

    if (Math.abs(a.y - b.y) < 6) {                        // same band → horizontal
      if (!blockedAt(a.y))
        return { d: `M ${x1} ${a.y} L ${x2} ${b.y}`, mx: (x1 + x2) / 2, my: a.y - 7, sameLane: true };
      // detour through the band's clear upper strip instead of cutting a node
      const yTop = ctx.laneY[A.lane] + 16;
      return { d: roundedPath([{ x: x1, y: a.y }, { x: x1 + dir * 12, y: a.y }, { x: x1 + dir * 12, y: yTop },
                               { x: x2 - dir * 12, y: yTop }, { x: x2 - dir * 12, y: b.y }, { x: x2, y: b.y }]),
               mx: (x1 + x2) / 2, my: yTop - 6, sameLane: false };
    }

    // lane-to-lane: run horizontal in the source lane, drop through the
    // channel before the target column. Fan parallel verticals apart.
    const chKey = dir + ":" + Math.round((b.x - dir * COL_W / 2) / 10);
    const nUse = (ctx.channels[chKey] = (ctx.channels[chKey] || 0) + 1);
    const OFFS = [0, -5, 5, -9, 9];
    let chX = b.x - dir * COL_W / 2 + OFFS[(nUse - 1) % OFFS.length];
    chX = Math.max(Math.min(x1, x2) + 3, Math.min(Math.max(x1, x2) - 3, chX));
    const pts = [{ x: x1, y: a.y }];
    if (blockedAt(a.y) && Math.abs(chX - x1) > 30) {      // long run through occupied cells → lift into the strip
      const yTop = ctx.laneY[A.lane] + 16;
      pts.push({ x: x1 + dir * 12, y: a.y }, { x: x1 + dir * 12, y: yTop }, { x: chX, y: yTop });
    } else {
      pts.push({ x: chX, y: a.y });
    }
    pts.push({ x: chX, y: b.y }, { x: x2, y: b.y });
    return { d: roundedPath(pts), mx: chX, my: (a.y + b.y) / 2, sameLane: false };
  }

  /* ── Node glyphs by kind; stroke tinted by lane color. A small corner
     mark repeats the kind INSIDE the box — shape alone vanishes when
     you're deep in a dense diagram; the mark keeps kind readable. ── */
  /* ── Glyphs ──
     Every mark is authored in the same 11×11 box so they can be swapped
     without re-measuring placement, and every one is a single path string so
     the sketch pass can roughen it like anything else.

     Two tiers, and the split is the point. A node's KIND draws the top tier:
     the timeless role it plays, which is all a railway timetable or a
     campaign's lead list will ever need. Its optional ICON overrides that
     with the concrete thing a particular field uses for the role. A store
     stays an open-topped box whatever its icon, because the box is what says
     "things accumulate here" — the icon only says what the thing is. */
  const GLYPHS = {
    // kind tier — abstract, domain-neutral, the fallback when no icon is set
    actor:    "M 5.5 1.5 a 2 2 0 1 0 .1 0 Z M 1.2 10.5 a 4.3 4.3 0 0 1 8.6 0",                       // head + shoulders
    /* Stacked platters, closed at the sides. Two bare lines read as the
       index glyph at 11px, which is the one thing storage must not be. */
    store:    "M .8 3 h 9.4 M .8 6 h 9.4 M .8 9 h 9.4 M .8 3 v 6 M 10.2 3 v 6",                        // stacked platters
    channel:  "M 1.5 5.5 h 5 M 5 3.2 l 2.3 2.3 l -2.3 2.3",                                           // through-arrow
    /* Twice now a gear has failed here: eight teeth read as a sun and four
       read as an asterisk, because anything with radial repeats turns to
       mush in an 11px box. A triangle has one idea, three strokes and a
       silhouette nothing else in this table shares. It says the node runs,
       which is more than the cross it replaces ever said. */
    process:  "M 3.2 1.8 L 9 5.5 L 3.2 9.2 Z",                                                        // it runs
    // icon tier — concrete, opt-in per node
    database: "M 1 2.5 a 4.5 1.8 0 0 1 9 0 v 6 a 4.5 1.8 0 0 1 -9 0 Z M 1 2.5 a 4.5 1.8 0 0 0 9 0",
    cache:    "M 6.9 .6 L 2.6 6.2 h 2.9 l -.9 4.6 l 4.4 -6 h -3 Z",                                   // bolt: fast path
    /* A bucket, which is what S3 named the thing and what every object
       store icon has copied since. The page-with-a-fold it replaces said
       "document", and opaque bytes are not a document. */
    blob:     "M 1 2.4 h 9 l -1.1 8.2 h -6.8 Z M 1 2.4 a 4.5 1.5 0 0 1 9 0",                          // a bucket
    index:    "M 1 2 h 9 M 1 4.8 h 5.5 M 1 7.6 h 8 M 1 10.4 h 3.5",                                   // sorted, ragged
    log:      "M 1 2 h 7 M 1 5.5 h 7 M 1 9 h 4.5 M 7 7 l 2.5 2 l -2.5 2",                             // append-only
    /* An open-topped tray filled unevenly: a backlog with a depth. Three
       bare uprights were a barcode, and said nothing about waiting. */
    queue:    "M .9 1.8 v 7.4 h 9.2 V 1.8 M 2.7 9.2 V 5 M 5.5 9.2 V 3.4 M 8.3 9.2 V 6.6",             // a backlog, with a depth
    /* The meridian was an ellipse, and an ellipse inside an 11px circle
       closes into a smudge. Straight, it reads as a globe at any size. */
    cdn:      "M 5.5 .6 a 4.9 4.9 0 1 0 .1 0 Z M .6 5.5 h 9.8 M 5.5 .6 v 9.8",                        // a globe
    /* An arch you pass through. The arrow that used to sit inside it was
       what mushed; the gate alone is both clearer and more literal. */
    gateway:  "M 1.5 10.4 V 5.5 a 4 4 0 0 1 8 0 v 4.9 M 3.6 10.4 V 6.2 a 1.9 1.9 0 0 1 3.8 0 v 4.2", // a gate
    /* not a kind and not an icon: the mark a folded box wears, so the key can
       say what one is */
    folded:   "M .8 4.2 h 6 v 6 h -6 Z M 3.2 4.2 V 1.2 h 6 v 6 h -2.4"                                // things behind things
  };
  // An 11px glyph roughened as hard as a 110px box turns to mush, so the
  // sketch is gentler here. It still wobbles; it just stays readable.
  const GLYPH_SKETCH = { roughness: 0.55, bowing: 0.7 };

  function glyphName(n) {
    if (n.folded) return "folded";
    return (n.icon && GLYPHS[n.icon]) ? n.icon : n.kind;
  }
  /* Marks sit in the shape's upper-left, clear of the centred label. The pill
     curves away up there, so a channel's mark rides its midline instead. */
  function kindMark(g, n, x, y, color) {
    const name = glyphName(n);
    const d = GLYPHS[name];
    if (!d) return;
    let gx = x + 5, gy = y + 4;
    if (n.kind === "channel") { gx = x + 9; gy = -5.5; }       // pill: ride the midline
    else if (n.kind === "actor") { gx = -5.5; gy = -5.5; }     // circle: dead centre, label is below
    const m = el("path", { d: sketch(d, n.id + ":" + name, GLYPH_SKETCH), class: "dg-kmark", fill: "none",
                           transform: `translate(${gx} ${gy})` }, g);
    m.style.stroke = color;
  }
  function drawNode(g, n, color) {
    g.setAttribute("class", `dg-node dg-kind-${n.kind}`);
    const w = NODE_W, h = NODE_H, x = -w / 2, y = -h / 2;
    // Each kind draws twice: a clean solid underneath (.dg-fill) and the
    // roughened outline on top (.dg-shape). Filling the sketchy path itself
    // would ravel the edge of the fill; keeping them apart gives a crisp
    // shape with a hand-drawn line around it.
    if (n.kind === "actor") {
      el("circle", { r: ACTOR_R, class: "dg-fill" }, g);
      el("path", { d: sketch(circleD(0, 0, ACTOR_R), n.id), class: "dg-shape" }, g).style.stroke = color;
      kindMark(g, n, 0, 0, color);         // placement handled per kind inside kindMark
      labelBelow(g, n.label);
      return;
    }
    if (n.kind === "store") {                             // open-topped rect: 3 sides
      el("rect", { x, y, width: w, height: h, class: "dg-fill" }, g);
      el("path", { d: sketch(`M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`, n.id), class: "dg-shape dg-open" }, g).style.stroke = color;
    } else if (n.kind === "channel") {
      el("rect", { x, y, width: w, height: h, rx: h / 2, class: "dg-fill" }, g);
      el("path", { d: sketch(roundRectD(x, y, w, h, h / 2), n.id), class: "dg-shape" }, g).style.stroke = color;
    } else {                                              // process
      /* A folded box gets a second outline behind it. Without that it reads as
         one component wearing somebody else's name, which is the one thing an
         abstraction must never be mistaken for. */
      if (n.folded) {
        el("path", { d: sketch(roundRectD(x + 6, y - 6, w, h, 3), n.id + ":stack"),
                     class: "dg-shape dg-stack" }, g).style.stroke = color;
      }
      el("rect", { x, y, width: w, height: h, rx: 3, class: "dg-fill" }, g);
      el("path", { d: sketch(roundRectD(x, y, w, h, 3), n.id), class: "dg-shape" }, g).style.stroke = color;
    }
    kindMark(g, n, x, y, color);
    labelInside(g, n.label);
    /* how many it hides, stated. A box that does not say is a box that lies. */
    if (n.folded) {
      const c = el("text", { x: NODE_W / 2 - 7, y: NODE_H / 2 - 6, "text-anchor": "end",
                             class: "dg-fold-n" }, g);
      c.style.fill = color;
      txt(c, n.folded + " parts");
    }
  }

  function splitLabel(s, max) {
    if (s.length <= max) return [s];
    const words = s.split(" ");
    const lines = [""];
    words.forEach(w => {
      const cur = lines[lines.length - 1];
      if (cur && (cur + " " + w).length > max) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + " " + w : w;
    });
    return lines.length > 2 ? [lines[0], lines[1].replace(/.$/, "…")] : lines;
  }
  function labelInside(g, label) {
    const lines = splitLabel(label, 14);
    const t = el("text", { class: "dg-label", "text-anchor": "middle", y: lines.length > 1 ? -3 : 4 }, g);
    lines.forEach((ln, i) => txt(el("tspan", { x: 0, dy: i ? 12 : 0 }, t), ln));
  }
  function labelBelow(g, label) {
    const t = el("text", { class: "dg-label", "text-anchor": "middle", y: ACTOR_R + 13 }, g);
    txt(t, label);
  }

  /* ── Mount ── */
  function mount(container, doc, mountOpts = {}) {
    const layout = computeLayout(doc);
    const laneColor = id => LANE_COLORS[(layout.laneIndex[id] || 0) % LANE_COLORS.length];
    container.textContent = "";
    const svg = el("svg", {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      class: "dg-svg", role: "img",
      "aria-label": `System diagram: ${doc.meta.system}`
    }, container);
    // render at natural width so dense diagrams keep readable node sizes and
    // the pane scrolls horizontally, rather than squishing everything to fit
    svg.style.minWidth = layout.width + "px";

    // one arrowhead marker per lane color + the failure marker
    const defs = el("defs", {}, svg);
    // solid triangle (no concave tail): the thin edge line tucks into the base
    // with generous overlap, so the head never reads as detached at the node.
    const ARR = "M 0.4 1.5 L 8.6 5 L 0.4 8.5 Z";
    const mk = (id, fill) => {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 7.3, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: ARR, fill, "stroke-linejoin": "round" }, m);
    };
    layout.lanes.forEach((l, i) => mk("arr-lane" + i, LANE_COLORS[i % LANE_COLORS.length]));
    mk("arr-broken", "#c22f2f");

    // lane bands (tinted by lane color = built-in legend) + labels
    const bandsG = el("g", {}, svg);
    layout.lanes.forEach((l, i) => {
      const y = layout.laneY[l.id], color = LANE_COLORS[i % LANE_COLORS.length];
      el("rect", { x: 0, y, width: layout.width, height: LANE_H, fill: color, "fill-opacity": 0.05 }, bandsG);
      if (i) el("line", { x1: 0, y1: y, x2: layout.width, y2: y, class: "dg-lane-line" }, bandsG);
      const lab = el("text", { x: 7, y: y + 14, class: "dg-lane-label" }, bandsG);
      lab.style.fill = color;
      txt(lab, l.label.toUpperCase());
    });

    const edgesG = el("g", {}, svg);
    const nodesG = el("g", {}, svg);
    const labelsG = el("g", {}, svg);       // labels on TOP — never hidden by a box
    const simG = el("g", { class: "dg-sim" }, svg);   // flow tokens above everything
    const laneLabelById = {};
    layout.lanes.forEach(l => { laneLabelById[l.id] = l.label; });
    let shownIds = new Set();
    let lastState = null, lastPos = {}, lastHl = new Set();   // the sim reads the shown state
    let traced = null, freshTimer = null, raceOn = false, spineOn = false, onDrillCb = null, onRenderCb = null;
    let onSelectCb = null;
    /* Every part exists because something broke, which is the whole claim of
       this app — and until now the diagram could not be asked. The diffs
       already say who added what; this is just the index. */
    /* What a part DOES, in the document's own words. Nodes carry no
       description — only id, label, kind, lane, order and an optional icon —
       so inventing one would be the drawing making things up. What is real is
       the traffic: the labels on the edges that reach it and leave it. "Takes
       job queued from Upload service, gives next job to Transcoder" is both
       derived and true, which a paraphrase of the layer's prose would not be. */
    function roleOf(id) {
      if (!lastState) return null;
      const ins = [], outs = [];
      lastState.edges.forEach(e => {
        if (e.to === id && lastState.nodes.has(e.from)) ins.push(e);
        if (e.from === id && lastState.nodes.has(e.to)) outs.push(e);
      });
      const name = nid => { const n = lastState.nodes.get(nid); return n ? n.label : nid; };
      /* one of each is the clearest sentence; past that it is a list, and a
         list of six edges is the diagram again, not a summary of it */
      const say = (arr, verb) => {
        if (!arr.length) return null;
        const first = arr[0];
        const lbl = first.label ? `“${first.label}” ` : "";
        const other = verb === "Takes" ? name(first.from) : name(first.to);
        const more = arr.length > 1 ? ` and ${arr.length - 1} more` : "";
        return `${verb} ${lbl}${verb === "Takes" ? "from" : "to"} ${other}${more}`;
      };
      const parts = [say(ins, "Takes"), say(outs, "Gives")].filter(Boolean);
      if (!parts.length) return null;
      /* one sentence, so only the first clause is capitalised */
      return parts.map((t, i) => i ? t[0].toLowerCase() + t.slice(1) : t).join(", ") + ".";
    }

    const originOf = (() => {
      const m = new Map();
      (doc.visual.nodes || []).forEach(n => m.set(n.id, -1));          // -1: there from the start
      (doc.layers || []).forEach((L, i) => {
        ((L.diff || {}).add_nodes || []).forEach(n => m.set(n.id, i));
      });
      return m;
    })();

    let suppressClickUntil = 0, flipRaf = 0;

    /* trace: tap a node to light it + every edge touching it and dim the
       rest — follow one part's responsibilities. Tap again to clear. */
    svg.addEventListener("click", ev => {
      if (performance.now() < suppressClickUntil) return;
      // semantic zoom takes priority: a tap on the ⊕ badge drills into the
      // node's nested Deconstruct rather than tracing or faulting it
      const badge = ev.target.closest && ev.target.closest(".dg-drill-badge");
      if (badge) {
        const dg = badge.closest(".dg-node");
        const sub = dg && dg.getAttribute("data-expand");
        if (sub && onDrillCb) { ev.stopPropagation(); onDrillCb(sub, dg.getAttribute("data-id")); return; }
      }
      const g = ev.target.closest && ev.target.closest(".dg-node");
      if (!g || !svg.contains(g) || !lastState) {
        if (traced) {
          traced = null; spotlight(null);
          if (onSelectCb) onSelectCb(null);
        }
        return;
      }
      const id = g.getAttribute("data-id");
      if (!id) return;
      // mid-sim, a node tap KILLS the node — chaos engineering: watch tokens
      // pile up behind it and everything downstream starve
      if (sim.running) { sim.toggleFault(id); return; }
      // a folded box opens where it stands: the obvious gesture on something
      // labelled "3 parts" is to look inside it
      const fn = lastState.nodes.get(id);
      if (fn && fn.folded) {
        ev.stopPropagation();
        openLanes.add(fn.lane);
        show(lastUpto, lastOpts);
        return;
      }
      if (traced === id) {
        traced = null; spotlight(null);
        if (onSelectCb) onSelectCb(null);
        return;
      }
      const ids = [id];
      lastState.edges.forEach(e => { if (e.from === id || e.to === id) ids.push(e.id); });
      spotlight(ids, "trace");
      traced = id;
      if (onSelectCb) {
        const at = originOf.has(id) ? originOf.get(id) : null;
        onSelectCb({ id, label: fn ? fn.label : id,
                     layerIndex: at,
                     layerName: (at != null && at >= 0 && doc.layers[at]) ? doc.layers[at].name : null,
                     does: roleOf(id) });
      }
    });

    /* Hover isolation: on a pointer that can hover, passing over a node
       previews its trace — everything it doesn't touch drops back. Answers
       "what talks to this?" without committing to a click, which matters most
       in the dense late layers. Touch devices have no hover, so the tap-trace
       above stays their only path in; a click-trace outranks the preview. */
    const canHover = typeof matchMedia === "function" && matchMedia("(hover:hover)").matches;
    if (canHover) {
      let hovered = null;
      const relate = id => {
        const ids = [id];
        lastState.edges.forEach(e => { if (e.from === id || e.to === id) ids.push(e.id); });
        return ids;
      };
      svg.addEventListener("pointerover", ev => {
        if (traced || sim.running || !lastState) return;
        const g = ev.target.closest && ev.target.closest(".dg-node");
        const id = g && g.getAttribute("data-id");
        if (!id || id === hovered) return;
        hovered = id;
        spotlight(relate(id), "trace");
      });
      svg.addEventListener("pointerout", ev => {
        if (traced || !hovered) return;
        // ignore moves between children of the SAME node group; leaving for
        // anything else (including bare canvas, where both resolve to null)
        // must clear
        const from = ev.target.closest && ev.target.closest(".dg-node");
        const to = ev.relatedTarget;
        const toNode = to && to.closest && to.closest(".dg-node");
        if (from && toNode === from) return;
        hovered = null;
        spotlight(null);
      });
    }

    const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let foldKeep = 0;                        // 0 = off; otherwise layers kept open
    let lastFold = null;
    let openLanes = new Set();               // folded lanes the reader has opened back up
    /* The drawing is fitted to its frame on every render. Eight of the twenty
       flagships are wider than a laptop's diagram column and all of them are
       wider than a phone, so natural size meant the signature artifact was
       clipped by default on every screen. Zooming by hand turns this off
       until Fit is asked for again. */
    let autoFit = true;
    let lastUpto = 0, lastOpts = {};
    function show(upto, opts = {}) {
      sim.stop();                            // a state change invalidates in-flight tokens
      lastUpto = upto; lastOpts = opts;
      const { highlight = [], animate = false, ghost = [], stress = [] } = opts;
      let st = stateAt(doc, upto);

      /* Abstraction. Folding happens here rather than at any call site, so the
         sim, the spine, the races, the drill and the key all see one state and
         none of them needs to know. Every id the caller passed is remapped
         through the fold, or a highlight on a node that just went inside a box
         would simply vanish. */
      let foldMap = null;
      if (foldKeep > 0 && upto > foldKeep) {
        const folded = foldState(st, doc, upto, foldKeep, openLanes);
        if (folded.memberOf.size) { st = folded; foldMap = folded.memberOf; }
      }
      const thru = ids => (ids || []).map(id => (foldMap && foldMap.get(id)) || id);
      const ghostSet = new Set(thru(ghost)), stressSet = new Set(thru(stress));   // what-if: proposed elements + stressed existing ones
      const hl = new Set(thru(highlight));
      lastFold = foldMap ? { keep: foldKeep, memberOf: foldMap,
                             boxes: [...st.nodes.values()].filter(n => n.folded).length,
                             opened: openLanes.size,
                             hidden: foldMap.size } : null;

      /* A folded box has an id the precomputed layout has never seen. Its
         place is a pure function of lane and order, the same one computeLayout
         uses, so it can simply be filled in. */
      st.nodes.forEach(n => {
        if (!layout.pos[n.id]) {
          layout.pos[n.id] = { x: GUTTER + n.order * COL_W + COL_W / 2,
                               y: layout.laneY[n.lane] + LANE_H / 2 };
        }
      });
      const prev = shownIds;
      edgesG.textContent = "";
      nodesG.textContent = "";
      labelsG.textContent = "";

      // Vertical stagger over the nodes VISIBLE in this state, grouped by
      // lane+order cell: a sole occupant sits on the centerline; N co-located
      // nodes spread symmetrically by (NODE_H + gap) so they never overlap.
      // Slot order inside a cell follows the barycenter of each node's
      // connections (fewer edge crossings), id tie-break for determinism.
      const cells = {};
      st.nodes.forEach(n => { const k = n.lane + "|" + n.order; (cells[k] = cells[k] || []).push(n.id); });
      const nbr = {};
      st.nodes.forEach(n => { nbr[n.id] = { sum: 0, k: 0 }; });
      st.edges.forEach(e => {
        if (!st.nodes.has(e.from) || !st.nodes.has(e.to)) return;
        nbr[e.from].sum += layout.pos[e.to].y; nbr[e.from].k++;
        nbr[e.to].sum += layout.pos[e.from].y; nbr[e.to].k++;
      });
      const bary = id => nbr[id].k ? nbr[id].sum / nbr[id].k : 0;
      Object.values(cells).forEach(ids => ids.sort((a, b2) => bary(a) - bary(b2) || (a < b2 ? -1 : 1)));
      const pos = {};
      st.nodes.forEach(n => {
        const ids = cells[n.lane + "|" + n.order];
        const dy = (ids.indexOf(n.id) - (ids.length - 1) / 2) * (NODE_H + CELL_GAP);
        const b = layout.pos[n.id];
        pos[n.id] = { x: b.x, y: b.y + dy };
      });

      // edges (paths only — colored by the SOURCE lane, the input's origin)
      const routeCtx = { nodes: st.nodes, channels: {}, laneY: layout.laneY };
      const labelJobs = [];
      const ghostPaths = [];        // proposal edges that will sketch themselves in
      st.edges.forEach(e => {
        if (!st.nodes.has(e.from) || !st.nodes.has(e.to)) return;
        const from = st.nodes.get(e.from);
        const broken = hl.has(e.id);
        const li = layout.laneIndex[from.lane] || 0;
        const g = el("g", { class: `dg-edge dg-ekind-${e.kind}`, "data-id": e.id }, edgesG);
        const p = edgePath(e, pos, routeCtx);
        const path = el("path", { d: sketch(p.d, e.id), fill: "none", class: "dg-epath", "marker-end": `url(#${broken ? "arr-broken" : "arr-lane" + li})` }, g);
        path.style.stroke = broken ? "#c22f2f" : LANE_COLORS[li % LANE_COLORS.length];
        if (broken) g.classList.add("dg-broken");
        if (ghostSet.has(e.id)) { g.classList.add("dg-ghost"); ghostPaths.push(path); }
        if (stressSet.has(e.id)) g.classList.add("dg-stress");
        if (animate && !prev.has(e.id)) g.classList.add("dg-enter");
        else if (animate) g.classList.add("dg-prior");
        if (e.label) {
          // same-lane edges: lift the label into the band's clear upper strip
          const cx = p.sameLane ? (pos[e.from].x + pos[e.to].x) / 2 : p.mx;
          const cy = p.sameLane ? layout.laneY[from.lane] + 13 : p.my;
          labelJobs.push({ e, g, cx, cy, path, sameLane: p.sameLane, x0: pos[e.from].x, x1: pos[e.to].x, color: broken ? "#c22f2f" : LANE_COLORS[li % LANE_COLORS.length] });
        }
      });

      // nodes (colored by their own lane)
      const nodeRects = [];
      const prevPos = lastPos || null;
      const flipItems = [];
      if (flipRaf) { cancelAnimationFrame(flipRaf); flipRaf = 0; }
      st.nodes.forEach(n => {
        const p = pos[n.id];
        const g = el("g", { transform: `translate(${p.x} ${p.y})`, "data-id": n.id }, nodesG);
        drawNode(g, n, laneColor(n.lane));
        // semantic zoom: a node that is a system in its own right gets a drill
        // badge (⊕) at its top-right corner; tapping it opens the nested study
        if (typeof n.expands_to === "string" && n.expands_to.trim()) {
          const sub = n.expands_to.trim();
          const built = typeof mountOpts.hasStudy === "function" ? mountOpts.hasStudy(sub) : true;
          g.classList.add("dg-drillable");
          g.setAttribute("data-expand", sub);
          const bx = (n.kind === "actor" ? ACTOR_R : NODE_W / 2) - 3;
          const by = -(n.kind === "actor" ? ACTOR_R : NODE_H / 2) + 3;
          const badge = el("g", { class: "dg-drill-badge" + (built ? "" : " dg-drill-gen"), transform: `translate(${bx} ${by})` }, g);
          badge.style.setProperty("--lane-c", laneColor(n.lane));
          txt(el("title", {}, badge), built ? `Zoom into "${sub}"` : `Generate "${sub}" (uses API key)`);
          el("circle", { r: 16, class: "dg-drill-hit" }, badge);
          el("circle", { r: 7.5, class: "dg-drill-disc" }, badge);
          el("line", { x1: -3.2, y1: 0, x2: 3.2, y2: 0, class: "dg-drill-plus" }, badge);
          el("line", { x1: 0, y1: -3.2, x2: 0, y2: 3.2, class: "dg-drill-plus" }, badge);
        }
        txt(el("title", {}, g), `${n.label} · ${laneLabelById[n.lane] || n.lane} · ${n.kind}`);
        if (hl.has(n.id)) g.classList.add("dg-broken");
        if (ghostSet.has(n.id)) g.classList.add("dg-ghost");
        if (stressSet.has(n.id)) g.classList.add("dg-stress");
        if (animate && !prev.has(n.id)) g.classList.add("dg-enter");
        else if (animate) g.classList.add("dg-prior");
        if (!RM && prevPos && prevPos[n.id] && prev.has(n.id)) {
          const ox = prevPos[n.id].x, oy = prevPos[n.id].y;
          if (Math.hypot(ox - p.x, oy - p.y) > 1.5) {
            flipItems.push({ g, x0: ox, y0: oy, x1: p.x, y1: p.y });
          }
        }
        const hw = n.kind === "actor" ? ACTOR_R : NODE_W / 2;
        const hh = n.kind === "actor" ? ACTOR_R : NODE_H / 2;
        nodeRects.push({ x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh });
      });
      if (flipItems.length) {
        const t0 = performance.now(), dur = 240;
        flipItems.forEach(it => it.g.setAttribute("transform", `translate(${it.x0} ${it.y0})`));
        const stepFlip = now => {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          flipItems.forEach(it => {
            if (!it.g.isConnected) return;
            const nx = it.x0 + (it.x1 - it.x0) * e;
            const ny = it.y0 + (it.y1 - it.y0) * e;
            it.g.setAttribute("transform", `translate(${nx.toFixed(2)} ${ny.toFixed(2)})`);
          });
          if (p < 1) flipRaf = requestAnimationFrame(stepFlip);
          else flipRaf = 0;
        };
        flipRaf = requestAnimationFrame(stepFlip);
      }

      // Labels last, on top. A label may sit ANYWHERE along the edge it names,
      // so the search is 2-D: candidate anchors sampled along the path itself,
      // each swept through a small vertical range. Score = box overlap (worst),
      // then label-on-label, then drift from the edge's midpoint. Searching
      // only vertically at a fixed midpoint x — the old behaviour — left
      // crowded edges with nowhere to go, and burying one label under another
      // was nearly free, so the placer picked it. Both are priced in now.
      const placed = [];
      const olArea = (a, b, pad) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + pad) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + pad);

      // anchors along the edge: same-lane labels ride the band's clear upper
      // strip, so they slide horizontally between the two nodes; every other
      // label samples the real path geometry
      function anchorsFor(job) {
        const out = [];
        const ts = [0.5, 0.38, 0.62, 0.28, 0.72];
        if (job.sameLane) {
          ts.forEach(t => out.push({ x: job.x0 + (job.x1 - job.x0) * t, y: job.cy, t }));
          return out;
        }
        let len = 0;
        try { len = job.path.getTotalLength(); } catch (_) { len = 0; }
        if (!len) return [{ x: job.cx, y: job.cy, t: 0.5 }];
        ts.forEach(t => {
          try { const pt = job.path.getPointAtLength(len * t); out.push({ x: pt.x, y: pt.y, t }); }
          catch (_) { /* degenerate path — the midpoint anchor below still applies */ }
        });
        return out.length ? out : [{ x: job.cx, y: job.cy, t: 0.5 }];
      }

      // span/drift are how far the label may roam and how hard it's pulled
      // back. The tight pass keeps a label sitting on its edge; the wide pass
      // is the last resort that goes looking for genuinely empty paper.
      function place(job, text, anchors, span, step, drift) {
        const w = text.length * 5.3 + 6, hh = 6.5;
        let best = { x: job.cx, y: job.cy, ax: job.cx, ay: job.cy, score: Infinity };
        anchors.forEach(a => {
          for (let off = -span; off <= span; off += step) {
            const y = a.y + off;
            if (y < 8 || y > layout.height - 6) continue;
            const box = { x0: a.x - w / 2, y0: y - hh, x1: a.x + w / 2, y1: y + hh };
            let score = Math.abs(off) * drift + Math.abs(a.t - 0.5) * 22;   // stay near the edge, and near its middle
            nodeRects.forEach(r => { score += olArea(box, r, 2) * 4; });    // hiding behind a box is worst
            placed.forEach(r => { score += olArea(box, r, 1) * 3; });       // burying a sibling label is nearly as bad
            if (score < best.score) best = { x: a.x, y, ax: a.x, ay: a.y, score };
          }
        });
        return { ...best, w, hh };
      }
      const CLEAR = 12;      // below this, nothing meaningful is being overlapped

      labelJobs.forEach(job => {
        const full = job.e.label;
        const anchors = anchorsFor(job);
        let text = full, lead = false;
        let fit = place(job, full, anchors, 26, 4, 0.14);
        if (fit.score > CLEAR) {
          // Nothing clear beside the edge. Before shortening the label, look
          // further out for empty paper and run a leader back to it — a whole
          // label parked in the margin beats a truncated one in the scrum.
          const far = place(job, full, anchors, 78, 6, 0.045);
          if (far.score <= CLEAR) { fit = far; lead = true; }
          else if (full.length > 10) {
            // still nowhere: a shorter label collides with less. Try it both
            // beside the edge and out in the margin, take whichever wins. The
            // whole string stays reachable from the edge's tooltip.
            const short = full.slice(0, Math.max(8, Math.round(full.length * 0.6))).trim() + "…";
            const near = place(job, short, anchors, 26, 4, 0.14);
            const away = place(job, short, anchors, 78, 6, 0.045);
            const alt = away.score < near.score ? away : near;
            if (alt.score < fit.score) { text = short; fit = alt; lead = alt === away; }
          }
        }
        placed.push({ x0: fit.x - fit.w / 2, y0: fit.y - fit.hh, x1: fit.x + fit.w / 2, y1: fit.y + fit.hh });
        // the leader only earns its ink once the label has actually travelled
        if (lead && Math.abs(fit.y - fit.ay) > 20) {
          const y0 = fit.ay > fit.y ? fit.y + fit.hh + 1 : fit.y - fit.hh - 1;
          const ln = el("line", { x1: fit.x, y1: y0, x2: fit.ax, y2: fit.ay, class: "dg-leader" }, labelsG);
          ln.style.stroke = job.color;
        }
        const t = el("text", { x: fit.x, y: fit.y + 3, "text-anchor": "middle", class: "dg-elabel", "data-id": job.e.id }, labelsG);
        t.style.fill = job.color;
        // the untruncated text hangs off the EDGE, not the <text> — a <title>
        // child inside an SVG <text> renders as part of the string
        if (text !== full) txt(el("title", {}, job.g), full);
        txt(t, text);
      });

      // aesthetic 7: proposal edges sketch themselves — a blueprint being drawn —
      // then hand back to the CSS dashed-march look. Staggered so it reads as
      // ink laid down in sequence. Reduced-motion keeps the static dashed style.
      if (ghostPaths.length && !RM) {
        ghostPaths.forEach((path, i) => {
          let len;
          try { len = path.getTotalLength(); } catch (err) { return; }
          if (!len) return;
          path.style.animation = "none";                 // suspend ghost-march during the draw
          path.style.strokeDasharray = len + " " + len;
          path.style.strokeDashoffset = len;
          path.getBoundingClientRect();                  // force reflow so the transition takes
          path.style.transition = "stroke-dashoffset .55s ease " + (i * 0.11).toFixed(2) + "s";
          path.style.strokeDashoffset = "0";
          path.addEventListener("transitionend", function done() {
            // release inline overrides → CSS .dg-ghost .dg-epath (dashed + march) resumes
            path.style.transition = ""; path.style.strokeDasharray = "";
            path.style.strokeDashoffset = ""; path.style.animation = "";
          }, { once: true });
        });
      }

      svg.classList.remove("dg-has-spot");   // a fresh render clears any spotlight
      traced = null;
      // delta emphasis: for a beat, what carried over recedes so what's new reads first
      if (animate && !RM) {
        svg.classList.add("dg-fresh");
        clearTimeout(freshTimer);
        freshTimer = setTimeout(() => svg.classList.remove("dg-fresh"), 1500);
      }
      shownIds = new Set([...st.nodes.keys(), ...st.edges.keys()]);
      lastState = st;
      lastPos = pos;            // the sim draws store fill meters at node positions
      lastHl = hl;
      if (autoFit) zoomCtl.fit();        // the whole system, by default, on every screen
      if (onRenderCb) onRenderCb(st);    // the key redraws itself from what is on screen
      if (raceOn) raceSpotlight(true);   // re-ring contention points on the new state
      if (spineOn) spineSpotlight(true); // and re-trace the spine, which moves layer to layer
    }

    /* spotlight: dim everything, then light the given ids (nodes/edges + their
       labels, matched by data-id) in the card's colour. kind = problem|solution.
       Empty/null clears. Used by the reader to link a card to its diagram parts. */
    /* Ids handed in from outside are pre-fold: a layer's highlight, a load
       path, the nodes a step wants in view. Mapping them here means every
       call site keeps working with the ids it already knows. */
    function viaFold(ids) {
      if (!lastFold || !lastFold.memberOf || !ids) return ids;
      const out = [];
      ids.forEach(id => { const m = lastFold.memberOf.get(id); out.push(m || id); });
      return out;
    }
    function spotlight(ids, kind) {
      ids = viaFold(ids);
      // strip every dg-spot* class (problem/solution/load/future kinds), or a
      // leftover kind class keeps its stroke on after toggle-off
      svg.querySelectorAll(".dg-spot").forEach(e => [...e.classList].filter(c => c.indexOf("dg-spot") === 0).forEach(c => e.classList.remove(c)));
      if (!ids || !ids.length) { svg.classList.remove("dg-has-spot"); return; }
      const set = new Set(ids);
      svg.classList.add("dg-has-spot");
      svg.querySelectorAll("[data-id]").forEach(e => {
        if (set.has(e.getAttribute("data-id"))) e.classList.add("dg-spot", "dg-spot-" + kind);
      });
    }

    /* ── Race spotlight: a node with ≥2 incoming PAYLOAD edges has concurrent
       writers — two flows can land at once, and unless it serializes them the
       result is a race (lost update, interleaving). Purely structural, so it's
       computable on any state; the ring makes contention points visible and
       the sim (under load) shows tokens actually colliding there. ── */
    function contendedIds() {
      if (!lastState) return [];
      const writers = {};                                  // node id → set of DISTINCT source nodes
      lastState.edges.forEach(e => {
        if (e.kind !== "payload" || e.from === e.to) return;   // a self-loop isn't a second writer
        if (!lastState.nodes.has(e.from) || !lastState.nodes.has(e.to)) return;
        (writers[e.to] = writers[e.to] || new Set()).add(e.from);   // parallel edges from one source count once
      });
      return Object.keys(writers).filter(id => writers[id].size >= 2);
    }
    function raceSpotlight(on) {
      raceOn = on;
      svg.querySelectorAll(".dg-contended").forEach(e => e.classList.remove("dg-contended"));
      if (!on) return 0;
      const ids = contendedIds();
      ids.forEach(id => {
        const g = nodesG.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (g) g.classList.add("dg-contended");
      });
      return ids.length;
    }

    /* ══ Critical path. Two questions the diagram can answer standing still.
       SPINE — the heaviest chain of payload edges from an entry to a terminal:
       what a request actually waits on. Shortening anything OFF the spine
       changes nothing, which is the whole point of knowing where it runs.
       Weights are the same per-kind costs the Pulse simulation uses (a process
       dwells, a store takes a write and serves a read, a channel only
       transits), so the spine explains the animation instead of contradicting
       it — but they are MODELLED, not measured, so the numbers stay unitless.
       Printing milliseconds we never measured would be the one dishonest thing
       this feature could do.
       CHOKEPOINTS — nodes whose removal disconnects every entry from every
       terminal. What kills the system, as opposed to what slows it. Pure
       reachability, no weights, and exact: these graphs are small enough to
       test by removal rather than approximate. ══ */
    const KIND_COST = { process: 3.3, store: 2.2, channel: 1.2, actor: 0.6 };
    const costOf = n => KIND_COST[n && n.kind] || 1;

    function payloadAdj(st) {
      const out = {}, indeg = {}, ids = [];
      st.nodes.forEach((n, id) => { ids.push(id); out[id] = []; indeg[id] = 0; });
      const edges = [];
      st.edges.forEach(e => {
        if (e.kind !== "payload" || e.from === e.to) return;
        if (!st.nodes.has(e.from) || !st.nodes.has(e.to)) return;
        out[e.from].push(e); indeg[e.to]++; edges.push(e);
      });
      const emits = id => out[id].length > 0;
      const isActor = id => (st.nodes.get(id) || {}).kind === "actor";
      // An entry is anything nothing feeds (indegree 0) OR a person who starts
      // something. Requiring indegree 0 alone threw away every read path that
      // loops back to the reader — which is most read paths, and exactly the
      // one a user waits on.
      const sources = ids.filter(id => emits(id) && (indeg[id] === 0 || isActor(id)));
      // A delivery is anything that forwards nothing, OR a person receiving
      // something: arriving at a human IS the request completing.
      const sinks = ids.filter(id => indeg[id] > 0 && (!emits(id) || isActor(id)));
      // a fully cyclic payload graph with no people — fall back to any emitter
      return { out, edges, ids, sinks, sources: sources.length ? sources : ids.filter(emits) };
    }

    /* Longest weighted path by bounded relaxation — the same trick the sequence
       view uses. Feedback cycles make "longest" unbounded, so the round cap
       stops it deepening instead of looping forever. */
    function spineOf(st) {
      const g = payloadAdj(st);
      if (!g.sources.length) return { edges: [], nodes: [], cost: 0, hops: 0 };
      const sinkSet = new Set(g.sinks);
      let win = null;
      // One relaxation per entry, with that entry PINNED — nothing may relax
      // back into it. A person is both an entry and a delivery (you ask, you
      // get served), so without the pin the read loop would keep feeding itself
      // and the cost would climb with every round instead of converging.
      g.sources.forEach(src => {
        const dist = {}, pred = {};
        g.ids.forEach(id => { dist[id] = -Infinity; });
        dist[src] = costOf(st.nodes.get(src));
        for (let round = 0; round < g.ids.length; round++) {
          let changed = false;
          g.edges.forEach(e => {
            if (e.to === src || dist[e.from] === -Infinity) return;
            const c = dist[e.from] + costOf(st.nodes.get(e.to));
            if (c > dist[e.to] + 1e-9) { dist[e.to] = c; pred[e.to] = e; changed = true; }
          });
          if (!changed) break;
        }
        // measure to a DELIVERY, not to whatever happens to be furthest
        let end = null;
        g.ids.forEach(id => {
          if (id === src || dist[id] === -Infinity) return;
          if (!sinkSet.has(id)) return;
          if (end === null || dist[id] > dist[end]) end = id;
        });
        if (end === null) g.ids.forEach(id => {      // no delivery reachable from here
          if (id !== src && dist[id] > -Infinity && (end === null || dist[id] > dist[end])) end = id;
        });
        if (end === null) return;
        if (!win || dist[end] > win.cost) win = { cost: dist[end], end, pred };
      });
      if (!win) return { edges: [], nodes: [], cost: 0, hops: 0 };
      const edges = [], nodes = [win.end], seen = new Set([win.end]);
      let cur = win.end;
      while (win.pred[cur]) {
        const e = win.pred[cur];
        edges.unshift(e.id);
        if (seen.has(e.from)) break;          // relaxation touched a cycle; stop walking
        seen.add(e.from); nodes.unshift(e.from);
        cur = e.from;
      }
      // Cost is summed over the path we actually drew, NOT over the relaxation's
      // dist. Around a feedback loop dist keeps climbing while the pred walk
      // stops at the first repeat, so the two disagree — and dist is the one
      // that's wrong. Reporting it would have put a fabricated number on screen.
      const cost = nodes.reduce((sum, id) => sum + costOf(st.nodes.get(id)), 0);
      return { edges, nodes, cost, hops: edges.length };
    }

    /* A node is a chokepoint when taking it out leaves no entry able to reach
       any terminal at all. Entries and terminals are excluded — "the system
       stops if you delete the only door" is not an insight. */
    function chokepointsOf(st) {
      const g = payloadAdj(st);
      if (!g.sources.length || !g.sinks.length) return [];
      const sinkSet = new Set(g.sinks);
      const anyDelivery = blocked => {
        const seen = new Set(), queue = g.sources.filter(s => s !== blocked);
        queue.forEach(s => seen.add(s));
        while (queue.length) {
          const id = queue.shift();
          if (sinkSet.has(id) && id !== blocked) return true;
          for (const e of g.out[id] || []) {
            if (e.to === blocked || seen.has(e.to)) continue;
            seen.add(e.to); queue.push(e.to);
          }
        }
        return false;
      };
      if (!anyDelivery(null)) return [];        // nothing gets delivered even intact
      const skip = new Set([...g.sources, ...g.sinks]);
      return g.ids.filter(id => !skip.has(id) && !anyDelivery(id));
    }

    /* The reading that makes this worth a button: how much longer the spine got
       as the layers piled on. Every layer added to survive failure also added
       something the request has to wait for. */
    function spineSpotlight(on) {
      spineOn = on;
      svg.querySelectorAll(".dg-choke").forEach(e => e.classList.remove("dg-choke"));
      if (!on || !lastState) { spotlight(null); return null; }
      const s = spineOf(lastState);
      if (!s.hops) { spotlight(null); return { hops: 0, chokes: 0, ratio: 1 }; }
      const chokes = chokepointsOf(lastState);
      const onSpine = new Set(s.nodes);
      spotlight([...s.edges, ...s.nodes], "spine");
      chokes.forEach(id => {
        const g = nodesG.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (g) g.classList.add("dg-choke");
      });
      const base = spineOf(stateAt(doc, 0)).cost;
      return {
        hops: s.hops,
        chokes: chokes.length,
        onSpine: chokes.filter(id => onSpine.has(id)).length,
        ratio: base > 0 ? s.cost / base : 1
      };
    }

    /* ── Follow-the-story auto-pan: center the given element ids in the
       scroll viewport (used after each state change so the reader's eye
       lands on what changed, instead of hunting for it off-screen).
       null = scroll home. No-op when the diagram fully fits. ── */
    function focus(ids) {
      ids = viaFold(ids);
      const noOverflow = container.scrollWidth <= container.clientWidth + 4
                      && container.scrollHeight <= container.clientHeight + 4;
      if (noOverflow) return;
      const behavior = RM ? "auto" : "smooth";
      if (!ids || !ids.length) { container.scrollTo({ left: 0, top: 0, behavior }); return; }
      const set = new Set(ids);
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, found = false;
      svg.querySelectorAll("[data-id]").forEach(e2 => {
        if (!set.has(e2.getAttribute("data-id"))) return;
        const bb = e2.getBoundingClientRect();
        if (!bb.width && !bb.height) return;
        found = true;
        l = Math.min(l, bb.left); t = Math.min(t, bb.top);
        r = Math.max(r, bb.right); b = Math.max(b, bb.bottom);
      });
      if (!found) return;
      const cR = container.getBoundingClientRect();
      container.scrollTo({
        left: Math.max(0, container.scrollLeft + (l + r) / 2 - cR.left - container.clientWidth / 2),
        top: Math.max(0, container.scrollTop + (t + b) / 2 - cR.top - container.clientHeight / 2),
        behavior
      });
    }

    /* ── Pinch-to-zoom + double-tap (mobile): scale between fit-width and
       1.6x natural, anchored on the gesture midpoint, with soft overshoot
       that settles back into bounds (rubber-band, then snap). Double-tap
       (or desktop double-click) toggles fit <-> 100% around the tap. ── */
    const zoomCtl = (() => {
      const MAXZ = 3.2;              // above MAXUP, so Fit is never the largest the reader can get
      let settleRaf = null;
      /* the frame's real inside width: the container's own padding is 20px a
         side, and guessing 24 for the pair left a sliver still scrolling */
      const innerW = () => {
        const cs = getComputedStyle(container);
        return container.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      };
      /* Contain, not fit-to-width, and allowed above natural size.

         Capping at 1 meant the drawing never grew: on a 3440-wide display the
         diagram frame is about 2819×1196 and the URL shortener sat in it at
         432×420 — fifteen per cent of the width. Measuring width alone also
         left the frame's height unused, which is where the laptop's slack
         came from.

         MAXUP stops the other failure. Uncapped, a four-node diagram scales
         six times and becomes a poster of itself; the lane bands stretch, the
         labels tower, and nothing is any clearer than it was. */
      const MAXUP = 2.2;
      const innerH = () => {
        const cs = getComputedStyle(container);
        return container.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
      };
      const fitZ = () => {
        const w = innerW(), hh = innerH();
        const byW = w / layout.width;
        const byH = hh > 40 ? hh / layout.height : Infinity;   // a frame too short to measure binds nothing
        return Math.max(0.2, Math.min(MAXUP, byW, byH));
      };
      const current = () => (svg.getBoundingClientRect().width || layout.width) / layout.width;
      function syncPanClass() {
        const canPan = current() > fitZ() * 1.03 ||
          container.scrollWidth > container.clientWidth + 4 ||
          container.scrollHeight > container.clientHeight + 4;
        container.classList.toggle("dg-pannable", canPan);
      }
      function apply(nz, cx, cy) {
        nz = Math.max(fitZ() * 0.85, Math.min(MAXZ * 1.15, nz));   // soft overshoot beyond bounds
        const zOld = current();
        const contentX = (container.scrollLeft + cx) / zOld;
        const contentY = (container.scrollTop + cy) / zOld;
        svg.style.minWidth = "0";
        svg.style.width = (layout.width * nz) + "px";
        container.scrollLeft = contentX * nz - cx;
        container.scrollTop = contentY * nz - cy;
        syncPanClass();
        return nz;
      }
      function animateTo(target, cx, cy, ms = 160) {
        if (settleRaf) cancelAnimationFrame(settleRaf);
        if (RM) { apply(target, cx, cy); return; }
        const from = current(), t0 = performance.now();
        const step = now => {
          const p = Math.min(1, (now - t0) / ms);
          apply(from + (target - from) * (1 - Math.pow(1 - p, 3)), cx, cy);   // ease-out cubic
          if (p < 1) settleRaf = requestAnimationFrame(step);
        };
        settleRaf = requestAnimationFrame(step);
      }
      function settle() {
        const z = current(), lo = fitZ();
        const cx = container.clientWidth / 2, cy = container.clientHeight / 2;
        if (z < lo) animateTo(lo, cx, cy);
        else if (z > MAXZ) animateTo(MAXZ, cx, cy);
      }

      const pts = new Map();
      let pinch = null, pinchEndedAt = 0, lastTap = 0, lastX = 0, lastY = 0;
      let panState = null, panCoastRaf = 0;
      const stopCoast = () => { if (panCoastRaf) { cancelAnimationFrame(panCoastRaf); panCoastRaf = 0; } };
      container.addEventListener("pointerdown", e => {
        stopCoast();
        if (e.pointerType !== "touch") {
          if (e.button !== 0) return;
          if (e.target.closest && e.target.closest(".dg-node, .dg-drill-badge, button, a")) return;
          const canPan = container.scrollWidth > container.clientWidth + 2 ||
            container.scrollHeight > container.clientHeight + 2;
          if (!canPan) return;
          panState = {
            id: e.pointerId, x0: e.clientX, y0: e.clientY,
            sl0: container.scrollLeft, st0: container.scrollTop,
            moved: false, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }]
          };
          return;
        }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b2] = [...pts.values()];
          pinch = { d0: Math.max(20, Math.hypot(a.x - b2.x, a.y - b2.y)), z0: current() };
        }
      });
      container.addEventListener("pointermove", e => {
        if (panState && e.pointerId === panState.id) {
          const dx = e.clientX - panState.x0, dy = e.clientY - panState.y0;
          if (!panState.moved && Math.hypot(dx, dy) > 4) {
            panState.moved = true;
            container.classList.add("dg-panning");
            try { container.setPointerCapture(e.pointerId); } catch (_) {}
          }
          if (panState.moved) {
            e.preventDefault();
            container.scrollLeft = panState.sl0 - dx;
            container.scrollTop = panState.st0 - dy;
            const now = performance.now();
            panState.samples.push({ t: now, x: e.clientX, y: e.clientY });
            while (panState.samples.length > 2 && now - panState.samples[0].t > 90) panState.samples.shift();
          }
          return;
        }
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) {
          e.preventDefault();                              // we own the pinch (touch-action allows pans only)
          autoFit = false;
          const [a, b2] = [...pts.values()];
          const cR = container.getBoundingClientRect();
          apply(pinch.z0 * Math.hypot(a.x - b2.x, a.y - b2.y) / pinch.d0,
                (a.x + b2.x) / 2 - cR.left, (a.y + b2.y) / 2 - cR.top);
        }
      }, { passive: false });
      function endPan(e) {
        if (!panState || e.pointerId !== panState.id) return;
        const st = panState;
        panState = null;
        container.classList.remove("dg-panning");
        if (!st.moved) return;
        suppressClickUntil = performance.now() + 80;
        if (RM) return;
        const now = performance.now();
        while (st.samples.length > 2 && now - st.samples[0].t > 100) st.samples.shift();
        if (st.samples.length < 2) return;
        const a = st.samples[0], b = st.samples[st.samples.length - 1];
        const dt0 = (b.t - a.t) / 1000;
        if (!(dt0 > 0.008)) return;
        let vx = (b.x - a.x) / dt0, vy = (b.y - a.y) / dt0;
        if (Math.hypot(vx, vy) < 60) return;
        let lastT = now;
        const coast = t => {
          const dt = Math.min(0.032, Math.max(0.001, (t - lastT) / 1000));
          lastT = t;
          const decay = Math.pow(0.03, dt);
          vx *= decay; vy *= decay;
          container.scrollLeft -= vx * dt;
          container.scrollTop -= vy * dt;
          if (Math.hypot(vx, vy) > 15) panCoastRaf = requestAnimationFrame(coast);
          else panCoastRaf = 0;
        };
        panCoastRaf = requestAnimationFrame(coast);
      }
      function lift(e) {
        endPan(e);
        if (!pts.delete(e.pointerId)) return;
        if (pinch && pts.size < 2) { pinch = null; pinchEndedAt = performance.now(); settle(); }
      }
      function toggleQuickZoom(clientX, clientY) {
        stopCoast();
        const cR = container.getBoundingClientRect();
        const fz = fitZ();
        const zoomIn = Math.min(MAXZ, Math.max(1.5, fz * 1.65));
        const isZoomedIn = current() > fz * 1.15;
        autoFit = isZoomedIn;
        animateTo(isZoomedIn ? fz : zoomIn, clientX - cR.left, clientY - cR.top, 200);
      }
      container.addEventListener("pointercancel", lift);
      container.addEventListener("pointerup", e => {
        lift(e);
        if (e.pointerType !== "touch" || pts.size) return;
        const now = performance.now();
        if (now - pinchEndedAt < 400) { lastTap = 0; return; }   // pinch release ≠ tap
        if (now - lastTap < 320 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 26) {
          toggleQuickZoom(e.clientX, e.clientY);
          lastTap = 0;
        } else { lastTap = now; lastX = e.clientX; lastY = e.clientY; }
      });
      container.addEventListener("dblclick", e => {         // desktop parity
        toggleQuickZoom(e.clientX, e.clientY);
      });
      /* Fit is the default the renderer wants; anything the reader does by
         hand turns it off until they ask for it back.

         show() can run before the pane has been laid out — on mount, and
         again whenever the reading sheet is dragged — and a fit measured
         against a zero-width container collapses to the 0.2 floor. So a
         frame with no width to measure is skipped and retried rather than
         acted on. */
      let retry = 0;
      function fit() {
        const w = innerW();
        if (!(w > 80)) {
          cancelAnimationFrame(retry);
          retry = requestAnimationFrame(fit);
          return null;
        }
        const z = fitZ();
        svg.style.minWidth = "0";
        svg.style.width = (layout.width * z) + "px";
        container.scrollLeft = 0;
        container.scrollTop = 0;
        syncPanClass();
        return z;
      }
      /* the frame changes size when the sheet is dragged or the window is
         resized; a fitted drawing should stay fitted through both */
      if (typeof ResizeObserver === "function") {
        let roRaf = 0;
        new ResizeObserver(() => {
          if (!autoFit) return;
          cancelAnimationFrame(roRaf);
          roRaf = requestAnimationFrame(fit);
        }).observe(container);
      }
      function full() {
        svg.style.minWidth = "0";
        svg.style.width = layout.width + "px";
        syncPanClass();
        return 1;
      }
      function by(f, animate) {
        stopCoast();
        const cx = container.clientWidth / 2, cy = container.clientHeight / 2;
        const target = Math.max(fitZ(), Math.min(MAXZ, current() * f));
        if (animate === false) apply(target, cx, cy); else animateTo(target, cx, cy);
        return target;
      }
      function atFactor(f, clientX, clientY) {
        stopCoast();
        if (settleRaf) { cancelAnimationFrame(settleRaf); settleRaf = null; }
        const cR = container.getBoundingClientRect();
        const cx = clientX != null ? clientX - cR.left : container.clientWidth / 2;
        const cy = clientY != null ? clientY - cR.top : container.clientHeight / 2;
        const target = Math.max(fitZ(), Math.min(MAXZ, current() * f));
        return apply(target, cx, cy);
      }
      return { fitZ, current, fit, full, by, atFactor,
               /* whether the drawing is already sitting at its fitted size, so
                  a Fit control can say whether tapping it would do anything */
               fits: () => Math.abs(current() - fitZ()) < 0.02 };
    })();

    /* ── Flow simulation: tokens travel the payload path of the CURRENT
       state (rAF, transform-only). At a gate state they crash — red burst —
       on the highlighted "what breaks" elements: the failure, animated.
       Load mode multiplies spawn rate; ≥3 tokens on one edge slows them and
       marks the edge congested — saturation you can see. Honors
       prefers-reduced-motion by refusing to start. ── */
    const sim = (() => {
      let running = false, load = false, mode = "free", raf = null, last = 0, spawnAcc = 0;
      let tokens = [], onStopCb = null, onCrashCb = null, replayCrashed = 0;
      let onStatsCb = null, crashed = 0, delivered = 0, deliveredTimes = [], faulted = new Set();
      let fills = {}, fillBars = {}, readAcc = {};    // per-store level, its meter, and its read timer
      const SPAWN_MS = () => (load ? 240 : 1050);
      const SPEED = () => (load ? 125 : 85);          // px/s along the path
      function emitStats(now) {
        if (!onStatsCb) return;
        while (deliveredTimes.length && now - deliveredTimes[0] > 6000) deliveredTimes.shift();
        const perMin = deliveredTimes.length ? Math.round(deliveredTimes.length * 60000 / Math.max(1500, now - deliveredTimes[0])) : 0;
        onStatsCb({ perMin, inFlight: tokens.filter(t => !t.dead).length, crashed, faults: faulted.size });
      }
      function faultNode(id, on) {
        const g = nodesG.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (g) g.classList.toggle("dg-faulted", on);
      }

      function payloadGraph() {
        const out = {};
        const hasIncoming = new Set();
        if (lastState) lastState.edges.forEach(e => {
          if (e.kind !== "payload") return;
          (out[e.from] = out[e.from] || []).push(e);
          hasIncoming.add(e.to);
        });
        const sources = Object.keys(out).filter(id => !hasIncoming.has(id));
        // cyclic payload graphs have no sources — fall back to any payload origin
        return { out, sources: sources.length ? sources : Object.keys(out) };
      }
      // nodes with an incoming CONTROL edge: tokens pause at their door until
      // the permission edge flashes — coordination made visible
      function controlGate(nodeId) {
        if (!lastState) return null;
        for (const e of lastState.edges.values())
          if (e.kind === "control" && e.to === nodeId && lastState.nodes.has(e.from)) return e;
        return null;
      }
      function pathFor(edgeId) {
        return edgesG.querySelector(`[data-id="${CSS.escape(edgeId)}"] .dg-epath`);
      }
      /* Token body by source kind — the same four glyphs the nodes wear, so
         the shape in flight matches the shape it left. All drawn upright and
         axis-aligned so square and diamond stay distinguishable. */
      function tokenBody(kind) {
        if (kind === "store")   return el("rect", { x: -3.1, y: -3.1, width: 6.2, height: 6.2, rx: 1, class: "dg-token-body" });
        if (kind === "process") return el("path", { d: "M 0 -4 L 4 0 L 0 4 L -4 0 Z", class: "dg-token-body" });
        if (kind === "channel") return el("rect", { x: -4.6, y: -2.1, width: 9.2, height: 4.2, rx: 2.1, class: "dg-token-body" });
        return el("circle", { r: 3.2, class: "dg-token-body" });    // actor
      }
      function makeToken(e) {
        const p = pathFor(e.id);
        const from = lastState.nodes.get(e.from);
        if (!p || !from) return null;
        const color = laneColor(from.lane);
        // token = a payload body + a small arrowhead pointing where it's going.
        // COLOUR still says WHERE it came from (the source's lane); SHAPE now
        // says WHAT it came from, mirroring the node glyphs — so a token in
        // flight re-teaches the kind legend. Only the arrow rotates to the
        // tangent; the body stays upright, or a rotating square would read as
        // a diamond and the two kinds would collapse into each other.
        const g = el("g", { class: "dg-token dg-tok-" + from.kind }, simG);
        g.style.fill = color;
        const rot = el("g", { class: "dg-token-rot" }, g);
        el("path", { d: "M 2 -2.4 L 6.8 0 L 2 2.4 Z", class: "dg-token-arrow" }, rot);
        g.appendChild(tokenBody(from.kind));
        const trail = el("line", { class: "dg-trail" }, simG);
        trail.style.stroke = color;
        const tok = { e, p, len: Math.max(1, p.getTotalLength()), t: 0, el: g, rotEl: rot, trail, prev: null, ang: 0 };
        tokens.push(tok);
        return tok;
      }
      function spawn(graph) {
        const src = graph.sources[Math.floor(Math.random() * graph.sources.length)];
        const edges = src && graph.out[src];
        if (!edges || !edges.length) return;
        makeToken(edges[Math.floor(Math.random() * edges.length)]);
        // an ACTOR doesn't arrive on a metronome — people cluster. A burst now
        // and a gap after is what makes a queue form at all; smooth arrivals
        // at the same average rate would never back anything up.
        if (kindOf(src) === "actor" && Math.random() < 0.34) {
          const extra = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < extra; i++) {
            const t = makeToken(edges[Math.floor(Math.random() * edges.length)]);
            if (t) t.delay = 0.05 + i * 0.06;
          }
        }
      }

      /* ── How load moves depends on WHAT it moves through. Every token used to
         behave identically no matter what it passed through, which made the
         four kinds decorative. Each now has its own physics:
           actor    emits — bursty arrivals (above)
           store    retains — absorbs writes into a level, serves reads back out
           process  transforms — costs time; the token dwells before departing
           channel  conveys — has capacity; it bunches sooner than anything else
         ── */
      function kindOf(id) {
        const n = lastState && lastState.nodes.get(id);
        return n ? n.kind : "process";
      }
      const STORE_CAP = 8;
      function dwellFor(kind) {
        if (kind === "process") return 0.2 + Math.random() * 0.26;   // work takes time
        if (kind === "channel") return 0.05;                          // transit only
        return 0;
      }
      /* A store's fill meter: writes raise it, reads drain it. Drawn in the sim
         layer (nodes are rebuilt on every layer change; tokens are not). */
      function drawFill(id, level) {
        let bar = fillBars[id];
        const p = lastPos[id];
        if (!p) return;
        if (!bar) {
          bar = el("g", { class: "dg-meter" }, simG);
          el("rect", { x: -24, y: 11, width: 48, height: 3.6, rx: 1.8, class: "dg-meter-track" }, bar);
          const lvl = el("rect", { x: -24, y: 11, width: 0, height: 3.6, rx: 1.8, class: "dg-meter-level" }, bar);
          bar.__lvl = lvl;
          fillBars[id] = bar;
        }
        bar.setAttribute("transform", `translate(${p.x} ${p.y})`);
        bar.__lvl.setAttribute("width", (48 * Math.min(1, level / STORE_CAP)).toFixed(1));
        bar.classList.toggle("dg-meter-full", level >= STORE_CAP);
      }
      function clearFills() {
        Object.values(fillBars).forEach(b => b.remove());
        fillBars = {}; fills = {}; readAcc = {};
      }
      function splatter(x, y, color) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.random() * 0.7;
          const d = 9 + Math.random() * 13;
          const s = el("circle", { r: 1.3 + Math.random() * 1.6, class: "dg-splat", transform: `translate(${x} ${y})` }, simG);
          s.style.fill = color || "#c22f2f";
          s.style.setProperty("--dx", (Math.cos(a) * d).toFixed(1) + "px");
          s.style.setProperty("--dy", (Math.sin(a) * d).toFixed(1) + "px");
          setTimeout(() => s.remove(), 650);
        }
      }
      function kill(tok, cls, ms) {
        tok.dead = true;
        tok.el.classList.add(cls);
        if (tok.trail) tok.trail.remove();
        if (cls === "dg-token-crash") {
          crashed++;
          const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(tok.el.getAttribute("transform") || "");
          if (m) splatter(+m[1], +m[2], "#c22f2f");
          if (mode === "replay") {
            replayCrashed++;
            if (onCrashCb && replayCrashed === 2) onCrashCb();   // the collision, complete
          }
        }
        if (cls === "dg-token-exit") {
          delivered++; deliveredTimes.push(last);
          // delivery: the receiving node breathes once as it absorbs
          const ng = nodesG.querySelector(`[data-id="${CSS.escape(tok.e.to)}"]`);
          if (ng) { ng.classList.add("dg-absorb"); setTimeout(() => ng.classList.remove("dg-absorb"), 500); }
        }
        setTimeout(() => tok.el.remove(), ms);
      }
      function advance(tok, e) {
        const p = pathFor(e.id);
        if (!p) { kill(tok, "dg-token-exit", 300); return; }
        tok.e = e; tok.p = p; tok.len = Math.max(1, p.getTotalLength()); tok.t = 0;
        tok.permitted = false;
      }
      function hop(tok, graph) {
        if (lastHl.has(tok.e.to) || faulted.has(tok.e.to)) { kill(tok, "dg-token-crash", 400); return; }   // broken or killed node
        if (tok.chain) {                                 // replay tokens follow the scripted chain
          const e = tok.chain[++tok.ci];
          if (!e) { kill(tok, "dg-token-crash", 400); return; }   // chain ends at the failure
          advance(tok, e);
          return;
        }
        // A STORE doesn't pass work along — it keeps it. The write lands, the
        // level rises, and the token's journey ends there; what leaves a store
        // is a READ, emitted separately below. This is the whole difference
        // between a store and a process, and it used to be invisible.
        if (kindOf(tok.e.to) === "store") {
          const id = tok.e.to;
          // a full store cannot take the write — it's dropped, and dropping it
          // silently would be the one thing a diagram of this must not do
          if ((fills[id] || 0) >= STORE_CAP) { kill(tok, "dg-token-crash", 400); return; }
          fills[id] = (fills[id] || 0) + 1;
          kill(tok, "dg-token-exit", 300);
          return;
        }
        const next = graph.out[tok.e.to];
        if (!next || !next.length) { kill(tok, "dg-token-exit", 300); return; }   // journey complete
        const e = next[Math.floor(Math.random() * next.length)];
        advance(tok, e);
        tok.wait = dwellFor(kindOf(e.from));      // a process costs time before it lets go
      }
      function frame(now) {
        if (!running) return;
        const dt = Math.min(50, now - last) / 1000;
        last = now;
        const graph = payloadGraph();
        if (mode === "free") {
          spawnAcc += dt * 1000;
          const cap = load ? 44 : 14;
          while (spawnAcc >= SPAWN_MS()) {
            spawnAcc -= SPAWN_MS();
            if (tokens.filter(t => !t.dead).length < cap) spawn(graph);
          }
        }
        const perEdge = {};
        tokens.forEach(t => { if (!t.dead) perEdge[t.e.id] = (perEdge[t.e.id] || 0) + 1; });
        edgesG.querySelectorAll(".dg-congested").forEach(p => p.classList.remove("dg-congested"));
        Object.entries(perEdge).forEach(([id, n]) => {
          if (n >= 3) { const p = pathFor(id); if (p) p.classList.add("dg-congested"); }
        });

        /* ── Backpressure. Congestion above is LOCAL: one edge, one colour.
           Real queues don't stay local. A node taking more than it can clear
           pushes resistance BACKWARD, so the edges feeding it stiffen, their
           tokens slow, and the jam creeps toward the source — which is why a
           single slow component browns out everything upstream of it. Two
           hops back, so the propagation reads without painting the diagram. ── */
        const inbound = {};
        tokens.forEach(t => { if (!t.dead) inbound[t.e.to] = (inbound[t.e.to] || 0) + 1; });
        const SAT = load ? 4 : 3;
        const saturated = new Set(Object.keys(inbound).filter(id => inbound[id] >= SAT));
        faulted.forEach(id => saturated.add(id));      // a killed node backs up everything behind it
        const inEdges = {};
        if (lastState) lastState.edges.forEach(e => {
          if (e.kind === "payload" && e.from !== e.to) (inEdges[e.to] = inEdges[e.to] || []).push(e);
        });
        const bpEdges = new Set();
        let wave = [...saturated], seenBp = new Set(saturated);
        for (let depth = 0; depth < 2 && wave.length; depth++) {
          const next = [];
          wave.forEach(id => (inEdges[id] || []).forEach(e => {
            bpEdges.add(e.id);
            if (!seenBp.has(e.from)) { seenBp.add(e.from); next.push(e.from); }
          }));
          wave = next;
        }
        edgesG.querySelectorAll(".dg-backpressure").forEach(p => p.classList.remove("dg-backpressure"));
        bpEdges.forEach(id => { const p = pathFor(id); if (p) p.classList.add("dg-backpressure"); });
        nodesG.querySelectorAll(".dg-saturated").forEach(g => g.classList.remove("dg-saturated"));
        saturated.forEach(id => {
          const g = nodesG.querySelector(`[data-id="${CSS.escape(id)}"]`);
          if (g) g.classList.add("dg-saturated");
        });

        /* ── Stores serve reads. A store that holds something emits it onward
           on its own cadence, draining the level it built up — so a store
           visibly buffers between a fast writer and a slow reader instead of
           being a pass-through box. Nothing held, nothing served. ── */
        if (mode === "free") Object.keys(fills).forEach(id => {
          if (fills[id] <= 0 || faulted.has(id) || lastHl.has(id)) return;
          readAcc[id] = (readAcc[id] || 0) + dt * 1000;
          // a fuller store serves faster — without that the level only ever
          // climbs, pegs, and stops telling you anything
          const every = (load ? 850 : 1800) / (1 + fills[id] * 0.25);
          if (readAcc[id] < every) return;
          readAcc[id] -= every;
          const outs = (graph.out[id] || []).filter(e => lastState.nodes.has(e.to));
          // a store with somewhere to send serves a READ onward; one with
          // nowhere to send still drains, off-diagram. Either way the level
          // has to fall, or a terminal store just pegs red and says nothing.
          if (outs.length && !makeToken(outs[Math.floor(Math.random() * outs.length)])) return;
          fills[id]--;
        });
        Object.keys(fills).forEach(id => drawFill(id, fills[id]));
        tokens.forEach(tok => {
          if (tok.dead) return;
          if (tok.delay > 0) { tok.delay -= dt; tok.el.style.opacity = 0; return; }
          tok.el.style.opacity = "";
          // pause at a gated node's door until its control edge grants passage
          if (!tok.permitted && tok.t >= 0.8) {
            const gate = controlGate(tok.e.to);
            tok.permitted = true;
            if (gate && !lastHl.has(tok.e.to)) {
              tok.wait = 0.32;
              const gp = pathFor(gate.id);
              if (gp) { gp.classList.add("dg-permit"); setTimeout(() => gp.classList.remove("dg-permit"), 500); }
            }
          }
          if (tok.wait > 0) { tok.wait -= dt; return; }
          const crowd = perEdge[tok.e.id] || 1;
          // congestion = local resistance; backpressure = resistance inherited
          // from a saturated node further down the path. A CHANNEL has finite
          // capacity, so it bunches a token sooner than anything else does.
          const cap = kindOf(tok.e.from) === "channel" ? 2 : 3;
          const resist = (crowd >= cap ? 0.4 : 1) * (bpEdges.has(tok.e.id) ? 0.55 : 1);
          tok.t += (SPEED() * resist * dt) / tok.len;
          if (lastHl.has(tok.e.id) && tok.t > 0.55) { kill(tok, "dg-token-crash", 400); return; }
          if (tok.t >= 1) { hop(tok, graph); if (tok.dead) return; }
          let pt;
          const at = Math.min(1, tok.t) * tok.len;
          try { pt = tok.p.getPointAtLength(at); }
          catch (err) { kill(tok, "dg-token-exit", 200); return; }
          // heading from the path tangent (a hair ahead), so the arrow points
          // the way the payload travels; hold the last angle at the very end
          try {
            const ah = tok.p.getPointAtLength(Math.min(tok.len, at + 4));
            if (Math.hypot(ah.x - pt.x, ah.y - pt.y) > 0.5) tok.ang = Math.atan2(ah.y - pt.y, ah.x - pt.x) * 180 / Math.PI;
          } catch (err) { /* keep last angle */ }
          tok.el.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
          tok.rotEl.setAttribute("transform", `rotate(${tok.ang})`);
          if (tok.trail) {
            // draw the ink streak only between two CLOSE consecutive points;
            // on a hop/teleport (or first frame) hide the whole line, else a
            // stray segment from the origin streaks across the diagram
            if (tok.prev && Math.hypot(pt.x - tok.prev.x, pt.y - tok.prev.y) < 40) {
              tok.trail.setAttribute("x1", tok.prev.x); tok.trail.setAttribute("y1", tok.prev.y);
              tok.trail.setAttribute("x2", pt.x); tok.trail.setAttribute("y2", pt.y);
              tok.trail.style.display = "";
            } else { tok.trail.style.display = "none"; }
            const lag = 0.12;
            tok.prev = tok.prev ? { x: tok.prev.x + (pt.x - tok.prev.x) * lag * (dt * 60), y: tok.prev.y + (pt.y - tok.prev.y) * lag * (dt * 60) } : { x: pt.x, y: pt.y };
          }
        });
        tokens = tokens.filter(t => t.el.isConnected);
        emitStats(now);
        if (mode === "replay" && !tokens.some(t => !t.dead)) { stopInternal(); return; }
        raf = requestAnimationFrame(frame);
      }
      function stopInternal() {
        const was = running;
        running = false; load = false; mode = "free";
        if (raf) cancelAnimationFrame(raf);
        tokens.forEach(t => { t.el.remove(); if (t.trail) t.trail.remove(); });
        tokens = [];
        faulted.forEach(id => faultNode(id, false));
        faulted.clear();
        edgesG.querySelectorAll(".dg-congested").forEach(p => p.classList.remove("dg-congested"));
        edgesG.querySelectorAll(".dg-backpressure").forEach(p => p.classList.remove("dg-backpressure"));
        nodesG.querySelectorAll(".dg-saturated").forEach(g => g.classList.remove("dg-saturated"));
        clearFills();
        if (was && onStopCb) onStopCb();
      }
      /* scripted incident: two tokens run the payload chain into the highlighted
         failure, seconds apart — the second arrives where the first already is.
         BFS the payload graph for the shortest chain that ends in a highlight. */
      function failureChain(graph) {
        const seen = new Set();
        const queue = graph.sources.map(s => ({ id: s, chain: [] }));
        while (queue.length) {
          const cur = queue.shift();
          if (seen.has(cur.id)) continue;
          seen.add(cur.id);
          for (const e of graph.out[cur.id] || []) {
            const chain = [...cur.chain, e];
            if (lastHl.has(e.id) || lastHl.has(e.to)) return chain;
            queue.push({ id: e.to, chain });
          }
        }
        return null;
      }
      function resetStats() { crashed = 0; delivered = 0; deliveredTimes = []; if (onStatsCb) onStatsCb({ perMin: 0, inFlight: 0, crashed: 0, faults: 0 }); }
      return {
        get available() { return !RM; },
        get running() { return running; },
        get load() { return load; },
        get replaying() { return running && mode === "replay"; },
        onStop(fn) { onStopCb = fn; },
        onReplayCrash(fn) { onCrashCb = fn; },
        onStats(fn) { onStatsCb = fn; },
        // chaos: kill/revive a node by id (nodes crash arriving tokens while dead)
        toggleFault(id) {
          if (faulted.has(id)) { faulted.delete(id); faultNode(id, false); }
          else { faulted.add(id); faultNode(id, true); }
          return faulted.has(id);
        },
        start() {
          if (RM || running || !lastState) return false;
          running = true; mode = "free"; resetStats();
          last = performance.now();
          spawnAcc = SPAWN_MS();                       // first token on the very first frame
          raf = requestAnimationFrame(frame);
          return true;
        },
        replay() {
          if (RM || running || !lastState || !lastHl.size) return false;
          const chain = failureChain(payloadGraph());
          if (!chain) return false;
          running = true; mode = "replay"; replayCrashed = 0; resetStats();
          last = performance.now();
          const a = makeToken(chain[0]), b = makeToken(chain[0]);
          if (!a || !b) { stopInternal(); return false; }
          a.chain = chain; a.ci = 0; a.delay = 0;
          b.chain = chain; b.ci = 0; b.delay = 0.75;   // history's second train
          raf = requestAnimationFrame(frame);
          return true;
        },
        stop: stopInternal,
        toggleLoad() { load = !load; return load; }
      };
    })();

    return { show, spotlight, focus, layout, laneColor, sim, zoom: zoomCtl, raceSpotlight, contendedIds, spineSpotlight, stateAt: u => stateAt(doc, u), doc,
             setFold(keep) { foldKeep = Math.max(0, keep | 0); openLanes = new Set(); return foldKeep; },
             getFold() { return foldKeep; },
             foldInfo() { return lastFold; },
             foldOpenCount() { return openLanes.size; },
             foldCloseAll() { openLanes = new Set(); show(lastUpto, lastOpts); },
             /* fit is the default; a hand zoom suspends it until Fit is asked for */
             fitNow() { autoFit = true; zoomCtl.fit(); },
             zoomBy(f) { autoFit = false; return zoomCtl.by(f); },
             zoomAtFactor(f, cx, cy) { autoFit = false; return zoomCtl.atFactor(f, cx, cy); },
             zoomFull() { autoFit = false; return zoomCtl.full(); },
             isAutoFit() { return autoFit; },
             fitsWhole() { return zoomCtl.fits(); },
             onSelect(fn) { onSelectCb = fn; },
             redraw() { show(lastUpto, lastOpts); },
             onDrill(fn) { onDrillCb = fn; }, onRender(fn) { onRenderCb = fn; if (lastState) fn(lastState); } };
  }

  /* ── Legend: a compact always-visible key under the diagram (brings the
     tutorial's grammar to the reader). Pure DOM/SVG, themed via CSS vars. ── */
  function legend() {
    const wrap = document.createElement("div");
    wrap.className = "dg-legend";
    // on phones the legend collapses to this chip (CSS hides it on desktop)
    const tog = document.createElement("button");
    tog.className = "dgl-tog";
    tog.textContent = "key ▸";
    tog.setAttribute("aria-label", "Toggle diagram key");
    tog.onclick = () => {
      const open = wrap.classList.toggle("open");
      tog.textContent = open ? "key ▾" : "key ▸";
    };
    wrap.appendChild(tog);

    /* The glyph half of the key is built per render, not once. A static key
       lists every mark the app can draw, most of which are not on screen; this
       one lists only what this diagram actually uses, so it shrinks to four
       entries on the railway and grows as you scrub into YouTube's storage
       tier. Each entry is drawn through the same glyph table and the same
       sketch pass as the node, so the key is not a picture OF the mark — it is
       the mark. Tapping one lights every node that carries it, which is the
       part that actually answers "which of these is the cache". */
    const GLYPH_LABEL = {
      actor: "actor", store: "storage", process: "process", channel: "channel",
      database: "database", cache: "cache", blob: "object store", index: "index",
      log: "log", queue: "queue", cdn: "edge cache", gateway: "gateway"
    };
    const KIND_ORDER = ["actor", "store", "process", "channel"];
    // Drawn through the same sketch pass as the nodes: a crisp key beside a
    // hand-drawn diagram looked like two different drawings of one thing.
    const KIND_SHAPE_D = {
      actor:   circleD(15, 8, 5.5),
      store:   "M 6 3 L 6 13 L 24 13 L 24 3",
      process: roundRectD(6, 3, 18, 10, 1.5),
      channel: roundRectD(6, 3, 18, 10, 5)
    };
    /* Where the mark sits inside the key's own shape, mirroring where
       kindMark puts it on a real node: centred in the actor's circle, on the
       channel's midline, upper-left everywhere else. Scaled to fit a 30×16
       key box, so an entry is a miniature of a node rather than a diagram of
       one. */
    const KEY_MARK_SCALE = 0.58;
    const KEY_MARK_AT = {
      actor:   [11.8, 4.8], store: [7.6, 4.0],
      process: [7.6, 4.0],  channel: [8.4, 4.8]
    };
    const glyphRow = document.createElement("span");
    glyphRow.className = "dgl-row";
    wrap.appendChild(glyphRow);
    let lit = null;                                   // the entry currently spotlighting

    wrap.update = (st, dg) => {
      glyphRow.textContent = "";
      lit = null;
      if (!st) return;

      /* A node draws two things and the key owes the reader both: the
         container SHAPE, which carries the kind, and the corner MARK, which
         is the icon where a node has one and the kind where it does not.

         Keying only the marks left shapes undefined. A storage tier whose
         every node carries an icon contributed database, cache and queue
         entries and never once said what the open-topped box meant — true of
         81 of the 137 layers across the flagship library. */
      const shapes = new Map();                       // kind → node ids (the box)
      const marks = new Map();                        // glyph name → node ids (the corner)
      st.nodes.forEach(n => {
        if (!shapes.has(n.kind)) shapes.set(n.kind, []);
        shapes.get(n.kind).push(n.id);
        const m = glyphName(n);
        if (!marks.has(m)) marks.set(m, []);
        marks.get(m).push(n.id);
      });

      /* Kinds first, in their own order, then icons by the label the reader
         sees. A kind entry carries its mark too whenever some node of that
         kind is actually wearing it. */
      const entries = [];
      KIND_ORDER.forEach(k => {
        if (shapes.has(k)) entries.push({ name: k, ids: shapes.get(k), shape: true, mark: marks.has(k) });
      });
      [...marks.keys()].filter(m => !KIND_SHAPE_D[m])
        .sort((a, b) => (GLYPH_LABEL[a] || a).localeCompare(GLYPH_LABEL[b] || b))
        .forEach(m => entries.push({ name: m, ids: marks.get(m), shape: false, mark: true }));

      entries.forEach(ent => {
        const name = ent.name, ids = ent.ids;
        const it = document.createElement("button");
        it.className = "dgl-item dgl-tap";
        it.type = "button";
        it.title = `${ids.length} node${ids.length > 1 ? "s" : ""} — tap to light ${ids.length > 1 ? "them" : "it"}`;
        const svg = el("svg", { viewBox: "0 0 30 16", class: "dgl-glyph", "aria-hidden": "true" });
        if (ent.shape) {
          el("path", { d: sketch(KIND_SHAPE_D[name], "key:shape:" + name, GLYPH_SKETCH),
                       fill: "none", class: "dgl-shape" }, svg);
          if (ent.mark) {
            const at = KEY_MARK_AT[name] || [7.6, 4.0];
            el("path", { d: sketch(GLYPHS[name] || "", "key:" + name, GLYPH_SKETCH),
                         fill: "none", class: "dgl-mark",
                         transform: `translate(${at[0]} ${at[1]}) scale(${KEY_MARK_SCALE})` }, svg);
          }
        } else {
          el("path", { d: sketch(GLYPHS[name] || "", "key:" + name, GLYPH_SKETCH),
                       fill: "none", class: "dgl-mark", transform: "translate(9.5 2.5)" }, svg);
        }
        it.appendChild(svg);
        const t = document.createElement("span");
        t.textContent = GLYPH_LABEL[name] || name;
        it.appendChild(t);
        it.onclick = () => {
          if (!dg) return;
          if (lit === name) { dg.spotlight(null); lit = null; }
          else { dg.spotlight(ids, "trace"); lit = name; }
          [...glyphRow.children].forEach(c => c.classList.toggle("on", c === it && lit === name));
        };
        glyphRow.appendChild(it);
      });

      /* The drill badge is a glyph like any other and was on 91 of those 137
         layers with nothing anywhere saying what it meant. */
      const drill = [...st.nodes.values()]
        .filter(n => typeof n.expands_to === "string" && n.expands_to.trim())
        .map(n => n.id);
      if (drill.length) {
        const it = document.createElement("button");
        it.className = "dgl-item dgl-tap";
        it.type = "button";
        it.title = `${drill.length} node${drill.length > 1 ? "s are systems" : " is a system"} in its own right — tap to light ${drill.length > 1 ? "them" : "it"}`;
        const svg = el("svg", { viewBox: "0 0 30 16", class: "dgl-glyph", "aria-hidden": "true" });
        const b = el("g", { transform: "translate(15 8)", class: "dgl-drill" }, svg);
        el("circle", { r: 6, class: "dgl-drill-disc" }, b);
        el("line", { x1: -2.6, y1: 0, x2: 2.6, y2: 0, class: "dgl-drill-plus" }, b);
        el("line", { x1: 0, y1: -2.6, x2: 0, y2: 2.6, class: "dgl-drill-plus" }, b);
        it.appendChild(svg);
        const t = document.createElement("span");
        t.textContent = "opens up";
        it.appendChild(t);
        it.onclick = () => {
          if (!dg) return;
          if (lit === "__drill") { dg.spotlight(null); lit = null; }
          else { dg.spotlight(drill, "trace"); lit = "__drill"; }
          [...glyphRow.children].forEach(c => c.classList.toggle("on", c === it && lit === "__drill"));
        };
        glyphRow.appendChild(it);
      }
    };

    const item = (svgBuild, label) => {
      const it = document.createElement("span");
      it.className = "dgl-item";
      const svg = el("svg", { viewBox: "0 0 30 16", class: "dgl-glyph", "aria-hidden": "true" });
      svgBuild(svg);
      it.appendChild(svg);
      const t = document.createElement("span");
      t.textContent = label;
      it.appendChild(t);
      wrap.appendChild(it);
    };
    // node kinds and icons are contextual — see wrap.update above
    // edge kinds (pattern = kind; colour follows the source lane)
    item(s => el("line", { x1: 4, y1: 8, x2: 26, y2: 8, class: "dgl-line", "stroke-width": 2 }, s), "flow");
    item(s => el("line", { x1: 4, y1: 8, x2: 26, y2: 8, class: "dgl-line", "stroke-dasharray": "4 3" }, s), "control");
    item(s => el("line", { x1: 4, y1: 8, x2: 26, y2: 8, class: "dgl-line", "stroke-dasharray": "1.5 3" }, s), "money");
    // failure pulse
    item(s => el("line", { x1: 4, y1: 8, x2: 26, y2: 8, class: "dgl-line dgl-broken", "stroke-width": 2 }, s), "breaks next");
    // under Pulse: a jam creeping back upstream from a node that can't keep up
    item(s => el("line", { x1: 4, y1: 8, x2: 26, y2: 8, class: "dgl-line dgl-broken", "stroke-width": 2, "stroke-dasharray": "5 2.6" }, s), "backpressure");
    const note = document.createElement("span");
    note.className = "dgl-note";
    note.textContent = "colour = lane · payload takes its source's shape";
    wrap.appendChild(note);
    return wrap;
  }

  /* ── Sequence view (behavioural): the structural diagram says who CONNECTS to
     whom; this says in what ORDER things happen. For the given state we derive
     an interaction timeline — lifelines as columns (same left-to-right order as
     the diagram), messages as top-to-bottom arrows. Order comes from a
     longest-path layering over the directed edges (Bellman-Ford relaxation, so
     feedback cycles just stop deepening instead of looping forever). Edge kind
     keeps its dash; colour keeps its source lane. Returns a standalone SVG. ── */
  function sequence(doc, upto) {
    const layout = computeLayout(doc);
    const laneColor = id => LANE_COLORS[(layout.laneIndex[id] || 0) % LANE_COLORS.length];
    const laneLabel = {}; layout.lanes.forEach(l => { laneLabel[l.id] = l.label; });
    const st = stateAt(doc, upto);
    const nodes = [...st.nodes.values()].sort((a, b) =>
      (layout.laneIndex[a.lane] - layout.laneIndex[b.lane]) || (a.order - b.order) || (a.id < b.id ? -1 : 1));
    const edges = [...st.edges.values()].filter(e => st.nodes.has(e.from) && st.nodes.has(e.to) && e.from !== e.to);

    const COLW = 132, ROWH = 34, MARGIN = 96, HEADER = 62, PADB = 24, LABEL_MAX = 22;
    const width = MARGIN * 2 + Math.max(0, nodes.length - 1) * COLW;
    const colX = {}; nodes.forEach((n, i) => colX[n.id] = MARGIN + i * COLW);

    // longest-path rank so a message never sits above its own cause
    const rank = {}; nodes.forEach(n => rank[n.id] = 0);
    for (let pass = 0; pass < nodes.length; pass++) {
      let changed = false;
      edges.forEach(e => { if (rank[e.from] + 1 > rank[e.to]) { rank[e.to] = rank[e.from] + 1; changed = true; } });
      if (!changed) break;
    }
    const ordered = edges.slice().sort((a, b) => (rank[a.from] - rank[b.from]) || (colX[a.from] - colX[b.from]) || (a.id < b.id ? -1 : 1));

    const height = HEADER + Math.max(1, ordered.length) * ROWH + PADB;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, class: "seq-svg", role: "img", "aria-label": `Sequence of interactions for ${doc.meta.system}` });
    svg.style.minWidth = width + "px";

    // one arrowhead marker per lane colour
    const defs = el("defs", {}, svg);
    layout.lanes.forEach((l, i) => {
      const m = el("marker", { id: "seqarr" + i, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M 0 1 L 9 5 L 0 9 z", fill: LANE_COLORS[i % LANE_COLORS.length] }, m);
    });

    // lifelines: header chip + dashed life-line down the page
    const linesG = el("g", {}, svg);
    nodes.forEach(n => {
      const x = colX[n.id], color = laneColor(n.lane);
      el("line", { x1: x, y1: HEADER, x2: x, y2: height - PADB, class: "seq-life" }, linesG);
      const g = el("g", { transform: `translate(${x} 0)` }, linesG);
      const w = Math.min(COLW - 12, Math.max(52, n.label.length * 6 + 16));
      el("rect", { x: -w / 2, y: 12, width: w, height: 30, rx: 6, class: "seq-head" }, g).style.stroke = color;
      const lines = n.label.length > 15 ? [n.label.slice(0, 14) + "…"] : [n.label];
      const t = el("text", { x: 0, y: 31, "text-anchor": "middle", class: "seq-head-label" }, g);
      lines.forEach(ln => txt(t, ln));
      const rl = el("text", { x: 0, y: 54, "text-anchor": "middle", class: "seq-lane-label" }, g);
      rl.style.fill = color; txt(rl, (laneLabel[n.lane] || n.lane).toUpperCase());
    });

    // messages, top to bottom in causal order
    const msgG = el("g", {}, svg);
    ordered.forEach((e, i) => {
      const y = HEADER + i * ROWH + ROWH / 2;
      const x1 = colX[e.from], x2 = colX[e.to];
      const li = layout.laneIndex[st.nodes.get(e.from).lane] || 0;
      const g = el("g", { class: `seq-msg seq-kind-${e.kind}`, "data-id": e.id }, msgG);
      const line = el("line", { x1, y1: y, x2, y2: y, class: "seq-line", "marker-end": `url(#seqarr${li})` }, g);
      line.style.stroke = LANE_COLORS[li % LANE_COLORS.length];
      if (e.label) {
        const mid = (x1 + x2) / 2;
        const lab = e.label.length > LABEL_MAX ? e.label.slice(0, LABEL_MAX - 1) + "…" : e.label;
        const t = el("text", { x: mid, y: y - 6, "text-anchor": "middle", class: "seq-msg-label" }, g);
        t.style.fill = LANE_COLORS[li % LANE_COLORS.length]; txt(t, lab);
      }
      el("text", { x: 12, y: y + 3, class: "seq-step" }, g).appendChild(document.createTextNode(String(i + 1).padStart(2, "0")));
    });
    if (!ordered.length) {
      const t = el("text", { x: width / 2, y: HEADER + 24, "text-anchor": "middle", class: "seq-msg-label" }, svg);
      txt(t, "No interactions at this layer yet.");
    }
    return svg;
  }

  return { mount, stateAt, computeLayout, legend, sequence };
})();
