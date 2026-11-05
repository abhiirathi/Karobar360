// Deterministic PRNG so every company's sample data is stable across reloads.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rand {
  r: () => number;
  constructor(seed: number) {
    this.r = mulberry32(seed);
  }
  next() {
    return this.r();
  }
  range(a: number, b: number) {
    return a + (b - a) * this.r();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.r() * arr.length) % arr.length];
  }
  jitter(v: number, pct: number) {
    return v * (1 + (this.r() * 2 - 1) * pct);
  }
  weights(n: number, skew = 1.6) {
    const w = Array.from({ length: n }, (_, i) => Math.pow(1 / (i + 1), skew * 0.6) * this.range(0.75, 1.25));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  }
}
