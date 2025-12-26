// src/utils.js

// Averages and variance helpers
export function mean(arr) {
  if (!arr?.length) return 0;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

export function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  let v = 0;
  for (const x of arr) v += (x - m) * (x - m);
  v /= arr.length - 1; // sample stddev
  return Math.sqrt(v);
}

// In-place Fisher-Yates shuffle
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Random integer in [min, max] inclusive
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random float in [min, max)
export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// Exponential-ish sampler around a mean, returning positive int >= 1 (approximate mean).
export function samplePositiveInt(mean) {
  const m = Math.max(0, mean ?? 0);
  if (m <= 0) return 1;

  const u = Math.max(1e-12, Math.random());
  const exp01 = -Math.log(u); // mean 1
  const x = exp01 * m;

  return Math.max(1, Math.round(x));
}

export function sampleUniform(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo + (hi - lo) * Math.random();
}

// Simple weighted random choice from items: [{ item, weight }, ...]
export function weightedRandomChoice(weightedItems) {
  let total = 0;
  for (const w of weightedItems) {
    total += w.weight;
  }
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const w of weightedItems) {
    r -= w.weight;
    if (r <= 0) {
      return w.item;
    }
  }
  // Fallback
  return weightedItems[weightedItems.length - 1].item;
}

// Poisson sampler with mean lambda using Knuth algorithm
export function samplePoisson(lambda) {
  if (lambda <= 0) return 0;

  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

// Pearson correlation (returns null if insufficient or invalid)
export function pearson(xs, ys) {
  const n = xs?.length;
  if (!n || n < 2 || !ys || ys.length !== n) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denomLeft = n * sumX2 - sumX * sumX;
  const denomRight = n * sumY2 - sumY * sumY;
  const denom = Math.sqrt(Math.max(denomLeft, 0) * Math.max(denomRight, 0));

  if (!Number.isFinite(denom) || denom === 0) return null;
  return numerator / denom;
}
