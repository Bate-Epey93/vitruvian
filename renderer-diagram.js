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
  function kindMark(g, kind, x, y, color) {
    let d;
    if (kind === "store") d = `M ${x + 7} ${y + 7} h 9 M ${x + 7} ${y + 11} h 9`;                      // shelves
    else if (kind === "channel") d = `M ${x + 11} -4 l 5 4 l -5 4`;                                    // through-arrow, on the pill's midline
    else d = `M ${x + 8} ${y + 6} l 7 7 M ${x + 15} ${y + 6} l -7 7`;                                  // process: work
    const m = el("path", { d, class: "dg-kmark", fill: "none" }, g);
    m.style.stroke = color;
  }
  function drawNode(g, n, color) {
    g.setAttribute("class", `dg-node dg-kind-${n.kind}`);
    const w = NODE_W, h = NODE_H, x = -w / 2, y = -h / 2;
    if (n.kind === "actor") {
      el("circle", { r: ACTOR_R, class: "dg-shape" }, g).style.stroke = color;
      labelBelow(g, n.label);
      return;
    }
    if (n.kind === "store") {                             // open-topped rect: 3 sides
      el("rect", { x, y, width: w, height: h, class: "dg-fill" }, g);
      el("path", { d: `M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`, class: "dg-shape dg-open", fill: "none" }, g).style.stroke = color;
    } else if (n.kind === "channel") {
      el("rect", { x, y, width: w, height: h, rx: h / 2, class: "dg-shape" }, g).style.stroke = color;
    } else {                                              // process
      el("rect", { x, y, width: w, height: h, rx: 3, class: "dg-shape" }, g).style.stroke = color;
    }
    kindMark(g, n.kind, x, y, color);
    labelInside(g, n.label);
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
  function mount(container, doc) {
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
    let lastState = null, lastHl = new Set();         // the sim reads the shown state
    let traced = null, freshTimer = null, raceOn = false, onDrillCb = null;

    /* trace: tap a node to light it + every edge touching it and dim the
       rest — follow one part's responsibilities. Tap again to clear. */
    svg.addEventListener("click", ev => {
      // semantic zoom takes priority: a tap on the ⊕ badge drills into the
      // node's nested Deconstruct rather than tracing or faulting it
      const badge = ev.target.closest && ev.target.closest(".dg-drill-badge");
      if (badge) {
        const dg = badge.closest(".dg-node");
        const sub = dg && dg.getAttribute("data-expand");
        if (sub && onDrillCb) { ev.stopPropagation(); onDrillCb(sub, dg.getAttribute("data-id")); return; }
      }
      const g = ev.target.closest && ev.target.closest(".dg-node");
      if (!g || !svg.contains(g) || !lastState) return;
      const id = g.getAttribute("data-id");
      if (!id) return;
      // mid-sim, a node tap KILLS the node — chaos engineering: watch tokens
      // pile up behind it and everything downstream starve
      if (sim.running) { sim.toggleFault(id); return; }
      if (traced === id) { traced = null; spotlight(null); return; }
      const ids = [id];
      lastState.edges.forEach(e => { if (e.from === id || e.to === id) ids.push(e.id); });
      spotlight(ids, "trace");
      traced = id;
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

    function show(upto, opts = {}) {
      sim.stop();                            // a state change invalidates in-flight tokens
      const { highlight = [], animate = false, ghost = [], stress = [] } = opts;
      const ghostSet = new Set(ghost), stressSet = new Set(stress);   // what-if: proposed elements + stressed existing ones
      const st = stateAt(doc, upto);
      const hl = new Set(highlight);
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
        const path = el("path", { d: p.d, fill: "none", class: "dg-epath", "marker-end": `url(#${broken ? "arr-broken" : "arr-lane" + li})` }, g);
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
      st.nodes.forEach(n => {
        const p = pos[n.id];
        const g = el("g", { transform: `translate(${p.x} ${p.y})`, "data-id": n.id }, nodesG);
        drawNode(g, n, laneColor(n.lane));
        // semantic zoom: a node that is a system in its own right gets a drill
        // badge (⊕) at its top-right corner; tapping it opens the nested study
        if (typeof n.expands_to === "string" && n.expands_to.trim()) {
          g.classList.add("dg-drillable");
          g.setAttribute("data-expand", n.expands_to.trim());
          const bx = (n.kind === "actor" ? ACTOR_R : NODE_W / 2) - 3;
          const by = -(n.kind === "actor" ? ACTOR_R : NODE_H / 2) + 3;
          const badge = el("g", { class: "dg-drill-badge", transform: `translate(${bx} ${by})` }, g);
          txt(el("title", {}, badge), `Zoom into "${n.expands_to.trim()}"`);
          el("circle", { r: 7.5, class: "dg-drill-disc" }, badge).style.fill = laneColor(n.lane);
          el("line", { x1: -3.2, y1: 0, x2: 3.2, y2: 0, class: "dg-drill-plus" }, badge);
          el("line", { x1: 0, y1: -3.2, x2: 0, y2: 3.2, class: "dg-drill-plus" }, badge);
        }
        txt(el("title", {}, g), `${n.label} · ${laneLabelById[n.lane] || n.lane} · ${n.kind}`);
        if (hl.has(n.id)) g.classList.add("dg-broken");
        if (ghostSet.has(n.id)) g.classList.add("dg-ghost");
        if (stressSet.has(n.id)) g.classList.add("dg-stress");
        if (animate && !prev.has(n.id)) g.classList.add("dg-enter");
        else if (animate) g.classList.add("dg-prior");
        const hw = n.kind === "actor" ? ACTOR_R : NODE_W / 2;
        const hh = n.kind === "actor" ? ACTOR_R : NODE_H / 2;
        nodeRects.push({ x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh });
      });

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

      function place(job, text, anchors) {
        const w = text.length * 5.3 + 6, hh = 6.5;
        let best = { x: job.cx, y: job.cy, score: Infinity };
        anchors.forEach(a => {
          for (let off = -26; off <= 26; off += 4) {
            const y = a.y + off;
            if (y < 8 || y > layout.height - 6) continue;
            const box = { x0: a.x - w / 2, y0: y - hh, x1: a.x + w / 2, y1: y + hh };
            let score = Math.abs(off) * 0.14 + Math.abs(a.t - 0.5) * 22;   // stay near the edge, and near its middle
            nodeRects.forEach(r => { score += olArea(box, r, 2) * 4; });   // hiding behind a box is worst
            placed.forEach(r => { score += olArea(box, r, 1) * 3; });      // burying a sibling label is nearly as bad
            if (score < best.score) best = { x: a.x, y, score };
          }
        });
        return { ...best, w, hh };
      }

      labelJobs.forEach(job => {
        const full = job.e.label;
        const anchors = anchorsFor(job);
        let text = full, fit = place(job, full, anchors);
        // Nothing clear anywhere: a shorter label collides with less, so retry
        // truncated rather than draw an unreadable full-length one. The whole
        // string stays reachable in the tooltip.
        if (fit.score > 240 && full.length > 10) {
          const short = full.slice(0, Math.max(8, Math.round(full.length * 0.6))).trim() + "…";
          const alt = place(job, short, anchors);
          if (alt.score < fit.score) { text = short; fit = alt; }
        }
        placed.push({ x0: fit.x - fit.w / 2, y0: fit.y - fit.hh, x1: fit.x + fit.w / 2, y1: fit.y + fit.hh });
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
      lastHl = hl;
      if (raceOn) raceSpotlight(true);   // re-ring contention points on the new state
    }

    /* spotlight: dim everything, then light the given ids (nodes/edges + their
       labels, matched by data-id) in the card's colour. kind = problem|solution.
       Empty/null clears. Used by the reader to link a card to its diagram parts. */
    function spotlight(ids, kind) {
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

    /* ── Follow-the-story auto-pan: center the given element ids in the
       scroll viewport (used after each state change so the reader's eye
       lands on what changed, instead of hunting for it off-screen).
       null = scroll home. No-op when the diagram fully fits. ── */
    function focus(ids) {
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
      const MAXZ = 1.6;
      let settleRaf = null;
      const fitZ = () => Math.min(1, Math.max(0.2, (container.clientWidth - 24) / layout.width));
      const current = () => (svg.getBoundingClientRect().width || layout.width) / layout.width;
      function apply(nz, cx, cy) {
        nz = Math.max(fitZ() * 0.85, Math.min(MAXZ * 1.15, nz));   // soft overshoot beyond bounds
        const zOld = current();
        const contentX = (container.scrollLeft + cx) / zOld;
        const contentY = (container.scrollTop + cy) / zOld;
        svg.style.minWidth = "0";
        svg.style.width = (layout.width * nz) + "px";
        container.scrollLeft = contentX * nz - cx;
        container.scrollTop = contentY * nz - cy;
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
      container.addEventListener("pointerdown", e => {
        if (e.pointerType !== "touch") return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b2] = [...pts.values()];
          pinch = { d0: Math.max(20, Math.hypot(a.x - b2.x, a.y - b2.y)), z0: current() };
        }
      });
      container.addEventListener("pointermove", e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) {
          e.preventDefault();                              // we own the pinch (touch-action allows pans only)
          const [a, b2] = [...pts.values()];
          const cR = container.getBoundingClientRect();
          apply(pinch.z0 * Math.hypot(a.x - b2.x, a.y - b2.y) / pinch.d0,
                (a.x + b2.x) / 2 - cR.left, (a.y + b2.y) / 2 - cR.top);
        }
      }, { passive: false });
      function lift(e) {
        if (!pts.delete(e.pointerId)) return;
        if (pinch && pts.size < 2) { pinch = null; pinchEndedAt = performance.now(); settle(); }
      }
      container.addEventListener("pointercancel", lift);
      container.addEventListener("pointerup", e => {
        lift(e);
        if (e.pointerType !== "touch" || pts.size) return;
        const now = performance.now();
        if (now - pinchEndedAt < 400) { lastTap = 0; return; }   // pinch release ≠ tap
        if (now - lastTap < 320 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 26) {
          const cR = container.getBoundingClientRect();
          animateTo(current() > fitZ() * 1.15 ? fitZ() : 1, e.clientX - cR.left, e.clientY - cR.top, 200);
          lastTap = 0;
        } else { lastTap = now; lastX = e.clientX; lastY = e.clientY; }
      });
      container.addEventListener("dblclick", e => {         // desktop parity
        const cR = container.getBoundingClientRect();
        animateTo(current() > fitZ() * 1.15 ? fitZ() : 1, e.clientX - cR.left, e.clientY - cR.top, 200);
      });
      return { fitZ, current };
    })();

    /* ── Flow simulation: tokens travel the payload path of the CURRENT
       state (rAF, transform-only). At a gate state they crash — red burst —
       on the highlighted "what breaks" elements: the failure, animated.
       Load mode multiplies spawn rate; ≥3 tokens on one edge slows them and
       marks the edge congested — saturation you can see. Honors
       prefers-reduced-motion by refusing to start. ── */
    const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sim = (() => {
      let running = false, load = false, mode = "free", raf = null, last = 0, spawnAcc = 0;
      let tokens = [], onStopCb = null, onCrashCb = null, replayCrashed = 0;
      let onStatsCb = null, crashed = 0, delivered = 0, deliveredTimes = [], faulted = new Set();
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
        const next = graph.out[tok.e.to];
        if (!next || !next.length) { kill(tok, "dg-token-exit", 300); return; }   // journey complete
        advance(tok, next[Math.floor(Math.random() * next.length)]);
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
          // from a saturated node further down the path
          const resist = (crowd >= 3 ? 0.4 : 1) * (bpEdges.has(tok.e.id) ? 0.55 : 1);
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

    return { show, spotlight, focus, layout, laneColor, sim, zoom: zoomCtl, raceSpotlight, contendedIds, stateAt: u => stateAt(doc, u), doc, onDrill(fn) { onDrillCb = fn; } };
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
    // node kinds
    item(s => el("circle", { cx: 15, cy: 8, r: 5.5, class: "dgl-shape" }, s), "actor");
    item(s => el("path", { d: "M 6 3 L 6 13 L 24 13 L 24 3", fill: "none", class: "dgl-shape" }, s), "storage");
    item(s => el("rect", { x: 6, y: 3, width: 18, height: 10, rx: 1.5, class: "dgl-shape" }, s), "process");
    item(s => el("rect", { x: 6, y: 3, width: 18, height: 10, rx: 5, class: "dgl-shape" }, s), "channel");
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
