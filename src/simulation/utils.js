// src/utils.js

// In-place Fisher–Yates shuffle
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
