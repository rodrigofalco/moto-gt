export interface Point { x: number; y: number; }
export interface SampledPath { samples: Point[]; }

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

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
  return { samples };
}

export function pointAt(path: SampledPath, t: number): Point {
  const m = path.samples.length;
  const tt = ((t % 1) + 1) % 1;
  return path.samples[Math.floor(tt * m) % m];
}
