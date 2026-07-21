/** Polyline path helpers for enemy movement. */

export function buildPathMetrics(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    segs.push({ a, b, len, dx, dy });
    total += len;
  }
  return { points, segs, total };
}

export function samplePath(metrics, distance) {
  let d = Math.max(0, Math.min(distance, metrics.total));
  for (const seg of metrics.segs) {
    if (d <= seg.len || seg === metrics.segs[metrics.segs.length - 1]) {
      const t = seg.len === 0 ? 0 : Math.min(1, d / seg.len);
      return {
        x: seg.a.x + seg.dx * t,
        y: seg.a.y + seg.dy * t,
        angle: Math.atan2(seg.dy, seg.dx),
      };
    }
    d -= seg.len;
  }
  const last = metrics.points[metrics.points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
