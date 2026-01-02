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
function setNested(cfg, path, value) {
  if (!path || path.length === 0) return;
  let cur = cfg;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

export function applyUnitConfig(baseConfig, unitVars, unitMappings, varySet = null) {
  const cfg = JSON.parse(JSON.stringify(baseConfig || {}));

  for (const unitKey of Object.keys(unitMappings || {})) {
    if (varySet && !varySet.has(unitKey)) continue;

    const def = unitMappings[unitKey];
    if (!def || typeof def !== "object") continue;

    const uRaw = unitVars?.[unitKey];
    const u = clamp01(Number(uRaw));

    const target = def.target;
    if (!target || typeof target !== "string") continue;
    const targetPath = target.split(".");

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

    setNested(cfg, targetPath, mapped);
  }

  return cfg;
}
