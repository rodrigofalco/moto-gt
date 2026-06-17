export interface Point { x: number; y: number; }
export interface SampledPath { samples: Point[]; cum: number[]; total: number; }

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function buildPath(points: Point[], samplesPerSegment = 24): SampledPath {
  const n = points.length;
  const samples: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let j = 0; j < samplesPerSegment; j++) {
      samples.push(catmullRom(p0, p1, p2, p3, j / samplesPerSegment));
    }
  }
  // Cumulative arc length so pointAt() can advance at constant speed regardless of how
  // the control points are spaced (otherwise dots crawl on short segments, race on long ones).
  const m = samples.length;
  const cum = new Array<number>(m);
  cum[0] = 0;
  for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + dist(samples[i - 1], samples[i]);
  const total = cum[m - 1] + dist(samples[m - 1], samples[0]); // include the closing edge
  return { samples, cum, total };
}

// Point at fraction t of the TRACK LENGTH (arc-length parameterized), linearly
// interpolated between samples so motion is smooth and constant-speed.
export function pointAt(path: SampledPath, t: number): Point {
  const { samples, cum, total } = path;
  const m = samples.length;
  const tt = ((t % 1) + 1) % 1;
  const target = tt * total;
  if (target <= 0) return samples[0];

  // Largest k with cum[k] <= target (cum is strictly increasing).
  let k = 0, lo = 0, hi = m - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) { k = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  const segStart = cum[k];
  const segEnd = k < m - 1 ? cum[k + 1] : total;
  const next = (k + 1) % m;
  const f = (target - segStart) / (segEnd - segStart || 1);
  const a = samples[k], b = samples[next];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
