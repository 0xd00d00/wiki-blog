/* Small deterministic force layout, shared by the graph and its tests. */
(function (root) {
  'use strict';
  function step(nodes, links, settings, alpha, fixed) {
    var indexed = new Map(nodes.map(function (n) { return [n.id, n]; }));
    nodes.forEach(function (n) { n.vx = (n.vx || 0) * .7; n.vy = (n.vy || 0) * .7; });
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y;
        if (dx === 0 && dy === 0) { dx = .1 * (i + 1); dy = .1; }
        var d2 = Math.max(100, dx * dx + dy * dy), distance = Math.sqrt(d2);
        var force = Math.min(3, settings.repel / d2) * alpha;
        if (distance < 26) force += (26 - distance) * .1 * alpha;
        var fx = dx / distance * force, fy = dy / distance * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }
    links.forEach(function (l) {
      var a = indexed.get(l.source), b = indexed.get(l.target);
      if (!a || !b) return;
      var dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      var force = (distance - settings.distance) * settings.link * alpha;
      var fx = dx / distance * force, fy = dy / distance * force;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach(function (n) {
      if (n.id === fixed) { n.vx = 0; n.vy = 0; return; }
      n.vx += (n.cx - n.x) * settings.center * alpha;
      n.vy += (n.cy - n.y) * settings.center * alpha;
      n.x = Math.max(32, Math.min(868, n.x + Math.max(-6, Math.min(6, n.vx))));
      n.y = Math.max(32, Math.min(548, n.y + Math.max(-6, Math.min(6, n.vy))));
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { step: step };
  else root.WikiGraphPhysics = { step: step };
})(typeof window !== 'undefined' ? window : globalThis);
