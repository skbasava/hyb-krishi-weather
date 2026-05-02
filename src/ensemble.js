// ensemble.js — multi-source ranking and aggregation engine.
//
// Philosophy: there is no single "best" weather source. Each is good at
// different things. We assign each source a per-parameter competence,
// decay it by distance to nearest data point and by data age, then take
// a weighted mean. The spread between sources becomes the confidence signal.
//
// Pure functions. No fetch, no DOM, no Cloudflare APIs. Easy to test.

// ---- competence matrix (a priori; tune from experience) ---------------------
// Rows = source. Columns = parameter. Values in [0, 1].
// Zero means "this source has no skill at this parameter, exclude entirely."
//
// rationale (compressed):
//   KSNDMC: direct rain gauges, Karnataka-only, no forecast capability
//   IMD:    real station obs + official India-tuned model
//   OM:     multi-model ensemble (best for forecasts + agro params like ET₀)
//   NASA:   reanalysis-based, best for historical climatology
export const COMPETENCE = {
  rainfall_obs:       { ksndmc: 1.00, imd: 0.90, openmeteo: 0.50, nasa: 0.30 },
  rainfall_forecast:  { ksndmc: 0.00, imd: 0.80, openmeteo: 0.85, nasa: 0.00 },
  temperature_now:    { ksndmc: 0.70, imd: 0.95, openmeteo: 0.85, nasa: 0.40 },
  temperature_forecast:{ksndmc: 0.00, imd: 0.85, openmeteo: 0.90, nasa: 0.00 },
  wind:               { ksndmc: 0.70, imd: 0.85, openmeteo: 0.80, nasa: 0.50 },
  humidity:           { ksndmc: 0.70, imd: 0.90, openmeteo: 0.80, nasa: 0.50 },
  et0:                { ksndmc: 0.00, imd: 0.00, openmeteo: 1.00, nasa: 0.80 },
  climatology:        { ksndmc: 0.85, imd: 0.70, openmeteo: 0.00, nasa: 1.00 },
};

// ---- decay characteristic radii ---------------------------------------------
// Each source has a characteristic spatial scale. Beyond that, accuracy decays.
// Gaussian: weight *= exp(-(distance/radius)^2)
const DISTANCE_RADIUS_KM = {
  ksndmc: 15,     // point gauge, fast decay
  imd: 40,        // station, decays slower (synoptic obs)
  openmeteo: 25,  // gridded ~9km, sub-grid still meaningful
  nasa: 60,       // ~50km grid
};

// Freshness: how stale before we stop trusting? Minutes.
// Observations should be hours-fresh; forecasts/climatology don't decay.
const FRESHNESS_RADIUS_MIN = {
  ksndmc: 360,    // 6h
  imd: 360,       // 6h
  openmeteo: 720, // 12h (model run cycle)
  nasa: Infinity, // climatology
};

// ---- core math --------------------------------------------------------------

/**
 * Compute weight for a single source observation.
 *
 *   w = competence × spatial_decay × freshness_decay
 *
 * @param {string} source           one of: ksndmc, imd, openmeteo, nasa
 * @param {string} parameter        key in COMPETENCE
 * @param {number} distance_km      distance from query point to source's data point
 * @param {number} age_minutes      how old the value is (0 = brand new)
 * @returns {number}                weight in [0, 1]
 */
export function sourceWeight(source, parameter, distance_km, age_minutes) {
  const comp = COMPETENCE[parameter]?.[source] ?? 0;
  if (comp === 0) return 0;

  const r_km = DISTANCE_RADIUS_KM[source] ?? 30;
  const spatial = Math.exp(-(((distance_km ?? 0) / r_km) ** 2));

  const r_min = FRESHNESS_RADIUS_MIN[source] ?? 720;
  const freshness =
    r_min === Infinity ? 1 : Math.exp(-(((age_minutes ?? 0) / r_min) ** 2));

  return comp * spatial * freshness;
}

/**
 * Weighted ensemble across multiple source observations of the same parameter.
 *
 * @param {string} parameter
 * @param {Array<{source, value, distance_km, age_minutes}>} observations
 * @returns {{
 *   value: number|null,
 *   confidence: number,          // 0-1
 *   spread: number,              // weighted std dev
 *   range: [number, number],     // min/max from contributing sources
 *   contributions: Array<{source, value, weight, weight_pct, distance_km, age_minutes}>,
 *   primary: string|null,        // highest-weight source name
 *   used: number,                // count of sources that contributed
 *   skipped: Array<{source, reason}>
 * }}
 */
export function ensemble(parameter, observations) {
  const skipped = [];
  const contribs = [];

  for (const obs of observations) {
    if (obs == null || obs.value == null || !Number.isFinite(obs.value)) {
      skipped.push({ source: obs?.source ?? "unknown", reason: "missing/null value" });
      continue;
    }
    const w = sourceWeight(obs.source, parameter, obs.distance_km, obs.age_minutes);
    if (w === 0) {
      skipped.push({ source: obs.source, reason: "zero competence or fully decayed" });
      continue;
    }
    contribs.push({
      source: obs.source,
      value: obs.value,
      weight: w,
      distance_km: obs.distance_km ?? null,
      age_minutes: obs.age_minutes ?? null,
    });
  }

  if (contribs.length === 0) {
    return {
      value: null, confidence: 0, spread: 0, range: [null, null],
      contributions: [], primary: null, used: 0, skipped,
    };
  }

  const totalW = contribs.reduce((s, c) => s + c.weight, 0);
  const mean = contribs.reduce((s, c) => s + c.value * c.weight, 0) / totalW;

  // weighted variance (Bessel correction not strictly applicable for weighted; use simple form)
  const variance = contribs.reduce((s, c) => s + c.weight * (c.value - mean) ** 2, 0) / totalW;
  const spread = Math.sqrt(variance);

  // confidence: inversely related to spread, normalized.
  // For rainfall a 5mm spread on a 10mm prediction is huge; for temperature a 5°C
  // spread is huge. We normalize against |mean| with a floor to avoid divide-by-zero.
  // confidence = 1 / (1 + spread / max(|mean|, scale))   ; scale param-specific
  const SCALE = parameterScale(parameter);
  const denom = Math.max(Math.abs(mean), SCALE);
  const confidence = 1 / (1 + spread / denom);

  // Add weight percentages and find primary
  const withPct = contribs.map((c) => ({ ...c, weight_pct: c.weight / totalW }));
  withPct.sort((a, b) => b.weight - a.weight);
  const primary = withPct[0].source;

  const values = withPct.map((c) => c.value);
  const range = [Math.min(...values), Math.max(...values)];

  return {
    value: round2(mean),
    confidence: round2(confidence),
    spread: round2(spread),
    range: [round2(range[0]), round2(range[1])],
    contributions: withPct.map((c) => ({
      ...c,
      value: round2(c.value),
      weight: round2(c.weight),
      weight_pct: round2(c.weight_pct),
    })),
    primary,
    used: contribs.length,
    skipped,
  };
}

// Per-parameter "scale" used to normalize spread → confidence.
// Roughly: a "noticeable difference" in this parameter.
function parameterScale(parameter) {
  const SCALES = {
    rainfall_obs: 5,           // mm
    rainfall_forecast: 5,      // mm
    temperature_now: 2,        // °C
    temperature_forecast: 3,   // °C
    wind: 5,                   // km/h
    humidity: 10,              // %
    et0: 1,                    // mm/day
    climatology: 1,            // mm/day
  };
  return SCALES[parameter] ?? 1;
}

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// ---- multi-parameter dashboard helper --------------------------------------
/**
 * Convenience: run ensemble across many parameters at once and return a tidy
 * object the dashboard can consume directly.
 *
 * @param {Object} obs   { parameter_name: [observation, observation, ...], ... }
 * @returns {Object}     { parameter_name: ensemble_result, ..., _summary: {...} }
 */
export function ensembleAll(obs) {
  const out = {};
  for (const [param, observations] of Object.entries(obs)) {
    out[param] = ensemble(param, observations);
  }

  // Summary across all parameters
  const params = Object.values(out).filter((r) => r.value != null);
  const avg_confidence = params.length
    ? round2(params.reduce((s, r) => s + r.confidence, 0) / params.length)
    : 0;

  // Tally source contributions
  const sourceUsage = {};
  for (const r of params) {
    for (const c of r.contributions) {
      sourceUsage[c.source] = (sourceUsage[c.source] ?? 0) + c.weight_pct;
    }
  }

  out._summary = {
    parameters_resolved: params.length,
    average_confidence: avg_confidence,
    source_usage: Object.fromEntries(
      Object.entries(sourceUsage)
        .map(([k, v]) => [k, round2(v / params.length)])
        .sort(([, a], [, b]) => b - a)
    ),
  };

  return out;
}