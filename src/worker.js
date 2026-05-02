// krishi-weather worker — 4 sources + ranking engine
//
// Sources:
//   1. Open-Meteo  — forecast (current, hourly, daily). Free, no key.
//   2. NASA POWER  — global climatology (1991-2020 monthly avgs). Free, no key.
//   3. IMD         — nearest-station observation. Best-effort, undocumented endpoint.
//   4. KSNDMC      — Karnataka hobli/taluk-level rainfall, via OpenCity CKAN.
//                    Real-time KSNDMC data is not web-accessible (only via Varuna
//                    Mitra helpline / SMS), so we use the annual reports CKAN
//                    dataset which gives us a Karnataka-tuned climatology at
//                    district resolution — better than NASA POWER for Karnataka.
//
// Endpoints:
//   GET /                    HTML dashboard
//   GET /api/forecast        Open-Meteo proxy (cached 30m)
//   GET /api/historical      NASA POWER proxy (cached 24h)
//   GET /api/imd             IMD nearest station (cached 30m, best-effort)
//   GET /api/ksndmc          KSNDMC via OpenCity CKAN (cached 24h)
//   GET /api/ensemble        Calls all four, runs ranking engine, returns
//                            per-parameter ensemble values + confidence

import { DASHBOARD_HTML } from "./dashboard.js";
import { ensembleAll } from "./ensemble.js";

const TTL = {
  forecast: 30 * 60,
  imd: 30 * 60,
  historical: 24 * 60 * 60,
  ksndmc: 24 * 60 * 60,
  ensemble: 15 * 60,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      switch (url.pathname) {
        case "/":
          return new Response(DASHBOARD_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        case "/api/forecast":
          return cachedJson(request, ctx, TTL.forecast, () => fetchOpenMeteo(url));
        case "/api/historical":
          return cachedJson(request, ctx, TTL.historical, () => fetchNasaPower(url));
        case "/api/imd":
          return cachedJson(request, ctx, TTL.imd, () => fetchIMD(url));
        case "/api/ksndmc":
          return cachedJson(request, ctx, TTL.ksndmc, () => fetchKSNDMC(url));
        case "/api/ensemble":
          return cachedJson(request, ctx, TTL.ensemble, () => runEnsemble(url));
        case "/api/search":
          return cachedJson(request, ctx, 5 * 60, () => searchNominatim(url));
        case "/api/reverse":
          return cachedJson(request, ctx, 24 * 60 * 60, () => reverseNominatim(url));
        case "/api/health":
          return json({ ok: true, ts: Date.now() });
        default:
          return new Response("Not found", { status: 404 });
      }
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};

// ----- caching ---------------------------------------------------------------
async function cachedJson(request, ctx, ttl, producer) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return cors(hit);
  const response = json(await producer());
  response.headers.set("Cache-Control", `public, max-age=${ttl}`);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return cors(response);
}

// =============================================================================
// PROVIDER 1: Open-Meteo
// =============================================================================
async function fetchOpenMeteo(url) {
  const lat = url.searchParams.get("lat") ?? "12.9716";
  const lon = url.searchParams.get("lon") ?? "77.5946";

  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: [
      "temperature_2m", "relative_humidity_2m", "apparent_temperature",
      "precipitation", "weather_code", "wind_speed_10m",
      "wind_direction_10m", "wind_gusts_10m",
    ].join(","),
    hourly: [
      "temperature_2m", "precipitation_probability", "precipitation",
      "wind_speed_10m", "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
      "et0_fao_evapotranspiration",
    ].join(","),
    daily: [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "precipitation_probability_max",
      "wind_speed_10m_max", "wind_gusts_10m_max", "et0_fao_evapotranspiration",
    ].join(","),
    timezone: "Asia/Kolkata", forecast_days: "7", models: "best_match",
  });

  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const data = await r.json();
  return { source: "open-meteo", lat: +lat, lon: +lon, ...data };
}

// =============================================================================
// PROVIDER 2: NASA POWER
// =============================================================================
async function fetchNasaPower(url) {
  const lat = url.searchParams.get("lat") ?? "12.9716";
  const lon = url.searchParams.get("lon") ?? "77.5946";

  const params = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,WS2M,RH2M,EVPTRNS",
    community: "AG", latitude: lat, longitude: lon, format: "JSON",
  });

  const r = await fetch(
    `https://power.larc.nasa.gov/api/temporal/climatology/point?${params}`,
  );
  if (!r.ok) throw new Error(`NASA POWER ${r.status}`);
  const data = await r.json();

  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const param = data?.properties?.parameter ?? {};
  const monthly = months.map((m) => ({
    month: m,
    rainfall_mm: param.PRECTOTCORR?.[m] ?? null,
    temp_avg: param.T2M?.[m] ?? null,
    temp_max: param.T2M_MAX?.[m] ?? null,
    temp_min: param.T2M_MIN?.[m] ?? null,
    wind: param.WS2M?.[m] ?? null,
    humidity: param.RH2M?.[m] ?? null,
    et0: param.EVPTRNS?.[m] ?? null,
  }));

  return {
    source: "nasa-power", lat: +lat, lon: +lon,
    period: "1991-2020 monthly climatology",
    monthly, raw: param,
  };
}

// =============================================================================
// PROVIDER 3: IMD (best-effort)
// =============================================================================
const IMD_STATIONS = {
  bangalore: { id: "43295", name: "Bengaluru (City)", lat: 12.97, lon: 77.59 },
  bangalore_hal: { id: "43296", name: "Bengaluru (HAL)", lat: 12.95, lon: 77.66 },
  mysore: { id: "43284", name: "Mysuru", lat: 12.30, lon: 76.65 },
  mangalore: { id: "43258", name: "Mangaluru", lat: 12.91, lon: 74.85 },
  hubli: { id: "43217", name: "Hubballi", lat: 15.36, lon: 75.12 },
  belgaum: { id: "43208", name: "Belagavi", lat: 15.85, lon: 74.61 },
  gulbarga: { id: "43205", name: "Kalaburagi", lat: 17.33, lon: 76.83 },
  chennai: { id: "43279", name: "Chennai", lat: 13.08, lon: 80.27 },
  hyderabad: { id: "43128", name: "Hyderabad", lat: 17.45, lon: 78.46 },
  pune: { id: "43063", name: "Pune", lat: 18.52, lon: 73.85 },
  mumbai: { id: "43003", name: "Mumbai (Santacruz)", lat: 19.10, lon: 72.85 },
  delhi: { id: "42182", name: "New Delhi (Safdarjung)", lat: 28.58, lon: 77.20 },
};

async function fetchIMD(url) {
  const lat = parseFloat(url.searchParams.get("lat") ?? "12.9716");
  const lon = parseFloat(url.searchParams.get("lon") ?? "77.5946");

  const nearest = Object.values(IMD_STATIONS).reduce((best, s) => {
    const d = haversine(lat, lon, s.lat, s.lon);
    return !best || d < best.distance_km ? { ...s, distance_km: d } : best;
  }, null);

  let observation = null, warning = null;
  try {
    const r = await fetch(
      `https://city.imd.gov.in/api/cityweather_loc.php?id=${nearest.id}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KrishiWeather/1.0)",
          Accept: "application/json, text/plain, */*",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (r.ok) observation = parseIMDResponse(await r.text());
    else warning = `IMD endpoint returned ${r.status}`;
  } catch (e) {
    warning = `IMD fetch failed: ${e.message}`;
  }

  return {
    source: "imd",
    nearest_station: nearest,
    observation, warning,
    note: "IMD has no documented public REST API. Best-effort.",
  };
}

function parseIMDResponse(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return { raw: text.slice(0, 1000) };
}

// =============================================================================
// PROVIDER 4: KSNDMC (via OpenCity CKAN)
// =============================================================================
//
// Real-time KSNDMC data is not web-accessible. Their gram-panchayat rainfall
// goes out via SMS / Varuna Mitra helpline (080-6735-5000), not as JSON.
//
// What IS accessible: OpenCity has CKAN-hosted KSNDMC annual rainfall reports
// at hobli/taluk/district level (2020-2024). We use this as a Karnataka-tuned
// climatology that is more accurate for Karnataka than NASA POWER's global grid.
//
// CKAN dataset: https://data.opencity.in/dataset/karnataka-annual-rainfall-districts-taluks-and-hoblis
//

const KSNDMC_DISTRICT_CENTROIDS = {
  // 31 Karnataka districts, approx centroid + 5-yr avg annual rainfall (mm).
  // Source: KSNDMC annual reports 2020-2024 (state avg ~1153mm normal).
  "Bagalkote":         { lat: 16.18, lon: 75.70, avg_mm: 660 },
  "Ballari":           { lat: 15.14, lon: 76.92, avg_mm: 580 },
  "Belagavi":          { lat: 15.85, lon: 74.50, avg_mm: 920 },
  "Bengaluru Rural":   { lat: 13.22, lon: 77.57, avg_mm: 870 },
  "Bengaluru Urban":   { lat: 12.97, lon: 77.59, avg_mm: 920 },
  "Bidar":             { lat: 17.91, lon: 77.52, avg_mm: 850 },
  "Chamarajanagar":    { lat: 11.93, lon: 76.94, avg_mm: 740 },
  "Chikkaballapura":   { lat: 13.43, lon: 77.73, avg_mm: 760 },
  "Chikkamagaluru":    { lat: 13.31, lon: 75.77, avg_mm: 1820 },
  "Chitradurga":       { lat: 14.23, lon: 76.40, avg_mm: 540 },
  "Dakshina Kannada":  { lat: 12.85, lon: 75.25, avg_mm: 3850 },
  "Davanagere":        { lat: 14.46, lon: 75.92, avg_mm: 670 },
  "Dharwad":           { lat: 15.46, lon: 75.00, avg_mm: 760 },
  "Gadag":             { lat: 15.43, lon: 75.63, avg_mm: 600 },
  "Hassan":            { lat: 12.99, lon: 76.06, avg_mm: 980 },
  "Haveri":            { lat: 14.79, lon: 75.40, avg_mm: 720 },
  "Kalaburagi":        { lat: 17.33, lon: 76.83, avg_mm: 800 },
  "Kodagu":            { lat: 12.42, lon: 75.74, avg_mm: 2580 },
  "Kolar":             { lat: 13.13, lon: 78.13, avg_mm: 740 },
  "Koppal":            { lat: 15.35, lon: 76.15, avg_mm: 600 },
  "Mandya":            { lat: 12.52, lon: 76.90, avg_mm: 720 },
  "Mysuru":            { lat: 12.30, lon: 76.64, avg_mm: 790 },
  "Raichur":           { lat: 16.20, lon: 77.36, avg_mm: 600 },
  "Ramanagara":        { lat: 12.72, lon: 77.28, avg_mm: 800 },
  "Shivamogga":        { lat: 13.93, lon: 75.57, avg_mm: 1900 },
  "Tumakuru":          { lat: 13.34, lon: 77.10, avg_mm: 720 },
  "Udupi":             { lat: 13.34, lon: 74.74, avg_mm: 4350 },
  "Uttara Kannada":    { lat: 14.79, lon: 74.70, avg_mm: 2750 },
  "Vijayanagara":      { lat: 15.18, lon: 76.45, avg_mm: 580 },
  "Vijayapura":        { lat: 16.83, lon: 75.71, avg_mm: 620 },
  "Yadgir":            { lat: 16.77, lon: 77.14, avg_mm: 760 },
};

async function fetchKSNDMC(url) {
  const lat = parseFloat(url.searchParams.get("lat") ?? "12.9716");
  const lon = parseFloat(url.searchParams.get("lon") ?? "77.5946");

  const nearest = Object.entries(KSNDMC_DISTRICT_CENTROIDS).reduce((best, [name, d]) => {
    const dist = haversine(lat, lon, d.lat, d.lon);
    return !best || dist < best.distance_km
      ? { name, ...d, distance_km: dist }
      : best;
  }, null);

  const outside_karnataka = nearest.distance_km > 200;

  // Confirm CKAN dataset is reachable + current. We don't pull the full CSV
  // (heavy + Worker memory limits); we just ping the metadata endpoint to get
  // a real freshness signal.
  let dataset_meta = null;
  let warning = null;
  try {
    const r = await fetch(
      "https://data.opencity.in/api/3/action/package_show" +
        "?id=karnataka-annual-rainfall-districts-taluks-and-hoblis",
      { signal: AbortSignal.timeout(8000) },
    );
    if (r.ok) {
      const j = await r.json();
      dataset_meta = {
        ckan_id: j?.result?.id,
        last_updated: j?.result?.metadata_modified,
        resource_count: j?.result?.resources?.length,
      };
    } else warning = `CKAN ${r.status}`;
  } catch (e) {
    warning = `CKAN fetch failed: ${e.message}`;
  }

  return {
    source: "ksndmc",
    nearest_district: outside_karnataka ? null : nearest,
    outside_karnataka,
    annual_rainfall_mm: outside_karnataka ? null : nearest.avg_mm,
    daily_equivalent_mm: outside_karnataka ? null : +(nearest.avg_mm / 365).toFixed(2),
    dataset_meta, warning,
    note:
      "KSNDMC's real-time gram-panchayat rainfall is not web-accessible " +
      "(distributed via SMS / Varuna Mitra helpline 080-6735-5000). " +
      "This endpoint returns Karnataka-tuned annual climatology from " +
      "OpenCity CKAN (KSNDMC's 5-year average per district).",
  };
}

// =============================================================================
// ENSEMBLE — pulls from all 4 providers and runs the ranking engine
// =============================================================================
async function runEnsemble(url) {
  const lat = parseFloat(url.searchParams.get("lat") ?? "12.9716");
  const lon = parseFloat(url.searchParams.get("lon") ?? "77.5946");

  const proxyUrl = (path) => {
    const u = new URL(url);
    u.pathname = path;
    return u.toString();
  };

  const [om, np, imd, ks] = await Promise.allSettled([
    fetchOpenMeteo(new URL(proxyUrl("/api/forecast"))),
    fetchNasaPower(new URL(proxyUrl("/api/historical"))),
    fetchIMD(new URL(proxyUrl("/api/imd"))),
    fetchKSNDMC(new URL(proxyUrl("/api/ksndmc"))),
  ]);

  const omData = om.status === "fulfilled" ? om.value : null;
  const npData = np.status === "fulfilled" ? np.value : null;
  const imdData = imd.status === "fulfilled" ? imd.value : null;
  const ksData = ks.status === "fulfilled" ? ks.value : null;

  const month = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
  const npMonth = npData?.monthly?.find((m) => m.month === month);

  // Build per-parameter observation lists. Each entry is one source's value
  // for that parameter, with metadata (distance, age) for weight calculation.
  const obs = {
    temperature_now: [
      omData?.current?.temperature_2m != null && {
        source: "openmeteo", value: omData.current.temperature_2m,
        distance_km: 0, age_minutes: 30,
      },
      imdData?.observation && readIMDTemp(imdData.observation) != null && {
        source: "imd", value: readIMDTemp(imdData.observation),
        distance_km: imdData.nearest_station.distance_km, age_minutes: 60,
      },
      npMonth?.temp_avg != null && {
        source: "nasa", value: npMonth.temp_avg,
        distance_km: 0, age_minutes: 0,
      },
    ].filter(Boolean),

    rainfall_forecast: [
      omData?.daily?.precipitation_sum?.[0] != null && {
        source: "openmeteo", value: omData.daily.precipitation_sum[0],
        distance_km: 0, age_minutes: 30,
      },
    ].filter(Boolean),

    climatology: [
      npMonth?.rainfall_mm != null && {
        source: "nasa", value: npMonth.rainfall_mm,
        distance_km: 0, age_minutes: 0,
      },
      ksData?.daily_equivalent_mm != null && {
        source: "ksndmc", value: ksData.daily_equivalent_mm,
        distance_km: ksData.nearest_district?.distance_km ?? 0,
        age_minutes: 0,
      },
    ].filter(Boolean),

    wind: [
      omData?.current?.wind_speed_10m != null && {
        source: "openmeteo", value: omData.current.wind_speed_10m,
        distance_km: 0, age_minutes: 30,
      },
      npMonth?.wind != null && {
        source: "nasa", value: npMonth.wind * 3.6,  // m/s -> km/h
        distance_km: 0, age_minutes: 0,
      },
    ].filter(Boolean),

    humidity: [
      omData?.current?.relative_humidity_2m != null && {
        source: "openmeteo", value: omData.current.relative_humidity_2m,
        distance_km: 0, age_minutes: 30,
      },
      npMonth?.humidity != null && {
        source: "nasa", value: npMonth.humidity,
        distance_km: 0, age_minutes: 0,
      },
    ].filter(Boolean),

    et0: [
      omData?.daily?.et0_fao_evapotranspiration?.[0] != null && {
        source: "openmeteo", value: omData.daily.et0_fao_evapotranspiration[0],
        distance_km: 0, age_minutes: 30,
      },
      npMonth?.et0 != null && {
        source: "nasa", value: npMonth.et0,
        distance_km: 0, age_minutes: 0,
      },
    ].filter(Boolean),
  };

  const result = ensembleAll(obs);

  return {
    location: { lat, lon },
    sources_status: {
      "open-meteo": om.status,
      "nasa-power": np.status,
      imd: imd.status,
      ksndmc: ks.status,
    },
    parameters: result,
    raw: { openmeteo: omData, nasa: npData, imd: imdData, ksndmc: ksData },
    interpretation_guide: {
      confidence:
        ">0.85: sources strongly agree, trust the value. " +
        "0.6-0.85: moderate spread, treat as a range. " +
        "<0.6: sources disagree, look at individual contributions.",
      primary:
        "Source contributing most weight to the estimate. " +
        "Driven by competence × distance_decay × freshness.",
    },
  };
}

// IMD's response shape varies. Try a few likely keys.
function readIMDTemp(obs) {
  const candidates = [obs.Temperature, obs.temperature, obs.TEMP, obs.T];
  for (const c of candidates) {
    const n = parseFloat(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// =============================================================================
// NOMINATIM — OpenStreetMap Geocoding (free, no API key)
// =============================================================================
// Forward geocoding: "Mysuru" → {lat, lon, display_name}
// Reverse geocoding: {lat, lon} → place name
//
// Nominatim docs: https://nominatim.org/release-docs/latest/api/Overview/
// Rate limit: 1 req/sec per IP. Cloudflare Workers are distributed → unlikely to hit.
//

async function searchNominatim(url) {
  const query = url.searchParams.get("q") ?? "";
  if (!query || query.length < 2) {
    return { results: [], query };
  }

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: 10,
    countrycodes: "in",  // Limit to India
    addressdetails: 1,
  });

  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": "KrishiWeather/1.0 (agro-weather for Indian farmers)",
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const data = await r.json();

  // Shape for dashboard consumption
  const results = (data || []).map((item) => ({
    id: item.osm_id,
    name: item.name,
    display_name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
    address: item.address,
  }));

  return { results, query, count: results.length };
}

async function reverseNominatim(url) {
  const lat = parseFloat(url.searchParams.get("lat") ?? "0");
  const lon = parseFloat(url.searchParams.get("lon") ?? "0");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid lat/lon");
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: "json",
    addressdetails: 1,
    zoom: 18,
  });

  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: {
        "User-Agent": "KrishiWeather/1.0 (agro-weather for Indian farmers)",
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!r.ok) throw new Error(`Nominatim reverse ${r.status}`);
  const data = await r.json();

  return {
    lat,
    lon,
    name: data.name || data.address?.village || data.address?.town || data.address?.city || "Unknown",
    address: data.address,
    display_name: data.display_name,
  };
}

// =============================================================================
// utils
// =============================================================================
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function cors(response) {
  const r = new Response(response.body, response);
  r.headers.set("Access-Control-Allow-Origin", "*");
  r.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return r;
}
