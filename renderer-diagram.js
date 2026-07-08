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

  /* ── Edge path: V-H-V midpoint routing between lanes,
     straight shot within a lane. Crossings are tolerated. ── */
  function edgePath(e, pos) {
    const a = pos[e.from], b = pos[e.to];
    if (Math.abs(a.y - b.y) < 6) {                       // same band → horizontal
      const dir = b.x > a.x ? 1 : -1;
      const x1 = a.x + dir * (NODE_W / 2 + 2), x2 = b.x - dir * (NODE_W / 2 + 6);
      return { d: `M ${x1} ${a.y} L ${x2} ${b.y}`, mx: (x1 + x2) / 2, my: a.y - 7, sameLane: true };
    }
    const down = b.y > a.y ? 1 : -1;
    const y1 = a.y + down * (NODE_H / 2 + 2);
    const y2 = b.y - down * (NODE_H / 2 + 6);
    const midY = (y1 + y2) / 2;
    if (Math.abs(a.x - b.x) < 6)                          // same column → vertical
      return { d: `M ${a.x} ${y1} L ${a.x} ${y2}`, mx: a.x + 3, my: midY, sameLane: false };
    return { d: `M ${a.x} ${y1} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${y2}`, mx: (a.x + b.x) / 2, my: midY - 7, sameLane: false };
  }

  /* ── Node glyphs by kind; stroke tinted by lane color ── */
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
    layout.lanes.forEach((l, i) => {
      const m = el("marker", { id: "arr-lane" + i, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M 0 1 L 9 5 L 0 9 z", fill: LANE_COLORS[i % LANE_COLORS.length] }, m);
    });
    const mb = el("marker", { id: "arr-broken", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M 0 1 L 9 5 L 0 9 z", fill: "#c22f2f" }, mb);

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
    let shownIds = new Set();

    function show(upto, opts = {}) {
      const { highlight = [], animate = false } = opts;
      const st = stateAt(doc, upto);
      const hl = new Set(highlight);
      const prev = shownIds;
      edgesG.textContent = "";
      nodesG.textContent = "";
      labelsG.textContent = "";

      // Vertical stagger over the nodes VISIBLE in this state, grouped by
      // lane+order cell: a sole occupant sits on the centerline; N co-located
      // nodes spread symmetrically by (NODE_H + gap) so they never overlap.
      const cells = {};
      st.nodes.forEach(n => { const k = n.lane + "|" + n.order; (cells[k] = cells[k] || []).push(n.id); });
      Object.values(cells).forEach(ids => ids.sort());   // deterministic slot order across renders
      const pos = {};
      st.nodes.forEach(n => {
        const ids = cells[n.lane + "|" + n.order];
        const dy = (ids.indexOf(n.id) - (ids.length - 1) / 2) * (NODE_H + CELL_GAP);
        const b = layout.pos[n.id];
        pos[n.id] = { x: b.x, y: b.y + dy };
      });

      // edges (paths only — colored by the SOURCE lane, the input's origin)
      const labelJobs = [];
      st.edges.forEach(e => {
        if (!st.nodes.has(e.from) || !st.nodes.has(e.to)) return;
        const from = st.nodes.get(e.from);
        const broken = hl.has(e.id);
        const li = layout.laneIndex[from.lane] || 0;
        const g = el("g", { class: `dg-edge dg-ekind-${e.kind}`, "data-id": e.id }, edgesG);
        const p = edgePath(e, pos);
        const path = el("path", { d: p.d, fill: "none", class: "dg-epath", "marker-end": `url(#${broken ? "arr-broken" : "arr-lane" + li})` }, g);
        path.style.stroke = broken ? "#c22f2f" : LANE_COLORS[li % LANE_COLORS.length];
        if (broken) g.classList.add("dg-broken");
        if (animate && !prev.has(e.id)) g.classList.add("dg-enter");
        if (e.label) {
          // same-lane edges: lift the label into the band's clear upper strip
          const cx = p.sameLane ? (pos[e.from].x + pos[e.to].x) / 2 : p.mx;
          const cy = p.sameLane ? layout.laneY[from.lane] + 13 : p.my;
          labelJobs.push({ e, cx, cy, color: broken ? "#c22f2f" : LANE_COLORS[li % LANE_COLORS.length] });
        }
      });

      // nodes (colored by their own lane)
      const nodeRects = [];
      st.nodes.forEach(n => {
        const p = pos[n.id];
        const g = el("g", { transform: `translate(${p.x} ${p.y})`, "data-id": n.id }, nodesG);
        drawNode(g, n, laneColor(n.lane));
        if (hl.has(n.id)) g.classList.add("dg-broken");
        if (animate && !prev.has(n.id)) g.classList.add("dg-enter");
        const hw = n.kind === "actor" ? ACTOR_R : NODE_W / 2;
        const hh = n.kind === "actor" ? ACTOR_R : NODE_H / 2;
        nodeRects.push({ x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh });
      });

      // labels last, on top. For each, sample a fine vertical range around
      // its anchor and pick the LEAST-overlapping slot — box overlap weighted
      // heavily, ties broken toward the anchor. Guarantees the best available
      // position (and a truly clear one whenever it exists), so a label is
      // never hidden behind a shape.
      const placed = [];
      const olArea = (a, b, pad) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + pad) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + pad);
      labelJobs.forEach(job => {
        const w = job.e.label.length * 5.3 + 6, hh = 6.5;
        let fy = job.cy, bestScore = Infinity;
        for (let off = -66; off <= 66; off += 6) {
          const y = job.cy + off;
          if (y < 8 || y > layout.height - 6) continue;
          const box = { x0: job.cx - w / 2, y0: y - hh, x1: job.cx + w / 2, y1: y + hh };
          let score = Math.abs(off) * 0.02;                          // gentle pull toward the edge
          nodeRects.forEach(r => { score += olArea(box, r, 2) * 4; });  // hiding behind a box is worst
          placed.forEach(r => { score += olArea(box, r, 1); });
          if (score < bestScore) { bestScore = score; fy = y; }
        }
        placed.push({ x0: job.cx - w / 2, y0: fy - hh, x1: job.cx + w / 2, y1: fy + hh });
        const t = el("text", { x: job.cx, y: fy + 3, "text-anchor": "middle", class: "dg-elabel", "data-id": job.e.id }, labelsG);
        t.style.fill = job.color;
        txt(t, job.e.label);
      });

      svg.classList.remove("dg-has-spot");   // a fresh render clears any spotlight
      shownIds = new Set([...st.nodes.keys(), ...st.edges.keys()]);
    }

    /* spotlight: dim everything, then light the given ids (nodes/edges + their
       labels, matched by data-id) in the card's colour. kind = problem|solution.
       Empty/null clears. Used by the reader to link a card to its diagram parts. */
    function spotlight(ids, kind) {
      svg.querySelectorAll(".dg-spot").forEach(e => e.classList.remove("dg-spot", "dg-spot-problem", "dg-spot-solution"));
      if (!ids || !ids.length) { svg.classList.remove("dg-has-spot"); return; }
      const set = new Set(ids);
      svg.classList.add("dg-has-spot");
      svg.querySelectorAll("[data-id]").forEach(e => {
        if (set.has(e.getAttribute("data-id"))) e.classList.add("dg-spot", "dg-spot-" + kind);
      });
    }

    return { show, spotlight, layout, laneColor };
  }

  return { mount, stateAt, computeLayout };
})();
