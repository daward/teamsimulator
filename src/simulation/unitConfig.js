// src/simulation/unitConfig.js

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function logLerp(min, max, t) {
  // min/max must be > 0
  const lo = Math.log(min);
  const hi = Math.log(max);
  return Math.exp(lerp(lo, hi, t));
}

function coerceInt(x) {
  return Math.round(x);
}

/**
 * Random unit vars in [0,1] for each mapping key.
 * (No seeded RNG here; if you want deterministic, we can add xorshift + seed.)
 */
export function randomUnitVars(unitMappings) {
  const out = {};
  for (const key of Object.keys(unitMappings || {})) {
    out[key] = Math.random();
  }
  return out;
}

/**
 * Applies unit vars onto base config according to mapping schema.
 * Returns a NEW config object.
 */
export function applyUnitConfig(baseConfig, unitVars, unitMappings, varySet = null) {
  const cfg = { ...(baseConfig || {}) };

  for (const unitKey of Object.keys(unitMappings || {})) {
    if (varySet && !varySet.has(unitKey)) continue;

    const def = unitMappings[unitKey];
    if (!def || typeof def !== "object") continue;

    const uRaw = unitVars?.[unitKey];
    const u = clamp01(Number(uRaw));

    // ratio mapping (special)
    if (def.type === "ratio") {
      // Your schema says target:"infoToImplRatio"
      // Interpret unit u as ratio in a reasonable range.
      // Range: 0.25 .. 4.0 (info can be 1/4 of impl up to 4x impl).
      const ratio = logLerp(0.25, 4.0, u);

      // Keep total constant based on current cfg (or fallback)
      const total =
        (Number(cfg.avgInfoTime) || 0) + (Number(cfg.avgImplTime) || 0) || 1;

      // info/impl = ratio, so:
      // info = total * ratio / (1 + ratio)
      // impl = total * 1 / (1 + ratio)
      cfg.avgInfoTime = total * ratio / (1 + ratio);
      cfg.avgImplTime = total / (1 + ratio);

      // Optionally expose it (useful for debugging)
      cfg.infoToImplRatio = ratio;

      continue;
    }

    const target = def.target;
    if (!target || typeof target !== "string") continue;

    const min = Number(def.min);
    const max = Number(def.max);

    // if min/max missing for float/int, skip
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    let mapped;
    if (def.scale === "log") {
      // require positive min/max
      const safeMin = min <= 0 ? 1e-9 : min;
      const safeMax = max <= 0 ? safeMin * 10 : max;
      mapped = logLerp(safeMin, safeMax, u);
    } else {
      mapped = lerp(min, max, u);
    }

    if (def.type === "int") mapped = coerceInt(mapped);

    cfg[target] = mapped;
  }

  return cfg;
}
