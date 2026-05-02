// dashboard.js — production-ready agro-meteorological dashboard with ensemble ranking
// Bilingual: English & ಕನ್ನಡ (Kannada)
export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Krishi Weather · ಕೃಷಿ ಹವಾಮಾನ</title>
<meta name="theme-color" content="#0F0E0C" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700&family=Manrope:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Kannada:wght@400;500;700&display=swap" rel="stylesheet" />
<!-- Leaflet.js for OpenStreetMap -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<style>
  :root {
    --ink: #0F0E0C;
    --ink-2: #16140F;
    --surface: #1C1A14;
    --surface-2: #232017;
    --hairline: rgba(232, 224, 200, 0.08);
    --hairline-strong: rgba(232, 224, 200, 0.16);
    --text: #EDE6D3;
    --text-dim: #A89F86;
    --text-faint: #6B6452;
    --amber: #E8A547;
    --amber-glow: rgba(232, 165, 71, 0.18);
    --moss: #8FB069;
    --rain: #7AB7E0;
    --warning: #D67A4F;
    --success: #52B788;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--ink);
    color: var(--text);
    font-family: 'Manrope', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
  body {
    background-image:
      radial-gradient(1200px 600px at 80% -10%, var(--amber-glow), transparent 60%),
      radial-gradient(800px 400px at 0% 100%, rgba(143, 176, 105, 0.08), transparent 60%);
    background-attachment: fixed;
    padding: 1.5rem 1.25rem 4rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .display { font-family: 'Fraunces', serif; font-weight: 500; letter-spacing: -0.02em; }
  .kannada { font-family: 'Noto Sans Kannada', system-ui, sans-serif; }
  .mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
  .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-faint);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--hairline);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }
  .brand { line-height: 1.05; }
  .brand h1 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 1.6rem;
    font-style: italic;
  }
  .brand h1 .accent { color: var(--amber); font-style: normal; }
  .brand p { color: var(--text-dim); font-size: 0.78rem; margin-top: 0.25rem; }
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .lang-toggle {
    background: var(--amber);
    color: var(--ink);
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 2px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    font-family: 'Noto Sans Kannada', system-ui, sans-serif;
  }
  .lang-toggle:hover {
    background: var(--amber);
    opacity: 0.85;
  }
  .status { text-align: right; font-size: 0.72rem; color: var(--text-dim); }
  .status .dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--moss); margin-right: 0.4rem; box-shadow: 0 0 8px var(--moss);
    animation: pulse 2.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .locbar {
    display: flex; flex-wrap: wrap; gap: 0.5rem;
    margin-bottom: 2rem;
    padding: 0.85rem 1rem;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 4px;
    align-items: center;
  }
  .locbar select, .locbar input, .locbar button {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82rem;
    background: var(--ink-2);
    color: var(--text);
    border: 1px solid var(--hairline-strong);
    padding: 0.5rem 0.75rem;
    border-radius: 2px;
    cursor: pointer;
  }
  .locbar input { cursor: text; width: 7.5rem; }
  .locbar input:focus, .locbar select:focus { outline: 1px solid var(--amber); border-color: var(--amber); }
  .locbar input.error { border-color: var(--warning); background: rgba(214, 122, 79, 0.1); }
  .locbar button:hover { border-color: var(--amber); color: var(--amber); }
  .locbar .sep { color: var(--text-faint); padding: 0 0.25rem; }
  .locbar .gps {
    background: var(--amber); color: var(--ink); border-color: var(--amber); font-weight: 500;
  }
  .locbar .gps:hover { background: transparent; }
  .locbar .coord-display {
    margin-left: auto;
    color: var(--text-faint);
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .confidence {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-left: 0.5rem;
  }
  .confidence.high {
    background: rgba(82, 183, 136, 0.2);
    color: var(--success);
    border: 1px solid rgba(82, 183, 136, 0.4);
  }
  .confidence.moderate {
    background: rgba(232, 165, 71, 0.2);
    color: var(--amber);
    border: 1px solid rgba(232, 165, 71, 0.4);
  }
  .confidence.low {
    background: rgba(214, 122, 79, 0.2);
    color: var(--warning);
    border: 1px solid rgba(214, 122, 79, 0.4);
  }
  section {
    margin-bottom: 2rem;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 1.5rem;
  }
  section > header {
    border: none; padding: 0; margin: 0 0 1rem 0;
    display: flex; align-items: baseline; justify-content: space-between;
  }
  section > header h2 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 1.15rem;
    letter-spacing: -0.01em;
  }
  .param-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 1.5rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--hairline);
    align-items: center;
  }
  .param-row:last-child { border-bottom: none; }
  .param-name {
    font-family: 'Fraunces', serif;
    font-size: 0.95rem;
    color: var(--text);
  }
  .param-value {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .param-value .val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--amber);
  }
  .param-value .unit {
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  .param-value .range {
    font-size: 0.75rem;
    color: var(--text-faint);
  }
  .param-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .source-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.5rem;
    background: var(--ink-2);
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--text-dim);
  }
  .source-chip.primary {
    border-color: var(--amber);
    color: var(--amber);
    background: rgba(232, 165, 71, 0.08);
  }
  .source-chip .pct {
    font-weight: 500;
    color: var(--text);
  }
  .error-card {
    background: rgba(214, 122, 79, 0.08);
    border: 1px solid var(--warning);
    border-radius: 4px;
    padding: 1rem;
    color: var(--text-dim);
    margin: 1rem 0;
  }
  .error-card strong { color: var(--warning); }
  .sources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .source-status {
    padding: 0.75rem;
    background: var(--ink-2);
    border: 1px solid var(--hairline);
    border-radius: 3px;
    font-size: 0.75rem;
  }
  .source-status .name {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    color: var(--text);
  }
  .source-status .badge {
    display: inline-block;
    margin-top: 0.3rem;
    padding: 0.2rem 0.4rem;
    border-radius: 2px;
    font-size: 0.65rem;
    text-transform: uppercase;
  }
  .source-status .fulfilled { background: rgba(82, 183, 136, 0.15); color: var(--success); }
  .source-status .rejected { background: rgba(214, 122, 79, 0.15); color: var(--warning); }
  footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--hairline);
    color: var(--text-faint);
    font-size: 0.75rem;
    line-height: 1.7;
  }
  footer a { color: var(--text-dim); text-decoration: underline; }
  .skeleton {
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
  }
  .skeleton::after { content: "▊"; animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (max-width: 720px) {
    body { padding: 1rem 0.85rem 3rem; }
    section { padding: 1.1rem; }
    .param-row { grid-template-columns: 1fr; gap: 0.5rem; }
    .locbar { gap: 0.4rem; padding: 0.65rem; }
    .locbar input { width: 5.5rem; font-size: 0.75rem; }
    header { flex-direction: column; gap: 0.5rem; }
    .header-right { align-items: flex-start; }
  }
  #map-container {
    display: none;
    height: 400px;
    margin: 1.5rem 0;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    overflow: hidden;
  }
  #map-container.active {
    display: block;
  }
  #map {
    width: 100%;
    height: 100%;
  }
  .search-container {
    position: relative;
  }
  #search-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82rem;
    background: var(--ink-2);
    color: var(--text);
    border: 1px solid var(--hairline-strong);
    padding: 0.5rem 0.75rem;
    border-radius: 2px;
    width: 200px;
  }
  #search-input:focus {
    outline: 1px solid var(--amber);
    border-color: var(--amber);
  }
  #search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--hairline-strong);
    border-top: none;
    border-radius: 0 0 2px 2px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
  }
  #search-dropdown.active {
    display: block;
  }
  .search-result {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--hairline);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .search-result:hover {
    background: var(--ink-2);
    color: var(--amber);
  }
  .search-result .name {
    font-weight: 500;
    color: var(--text);
  }
  .search-result .type {
    color: var(--text-faint);
    font-size: 0.65rem;
  }
  @media (max-width: 720px) {
    #map-container {
      height: 250px;
    }
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1 id="brand-title">Krishi <span class="accent">Weather</span></h1>
    <p id="brand-tagline">4-source ensemble with ranking · for dryland decisions</p>
  </div>
  <div class="header-right">
    <button class="lang-toggle" onclick="toggleLanguage()" id="lang-btn">ಕನ್ನಡ</button>
    <div class="status">
      <div><span class="dot"></span><span id="status-text">connecting…</span></div>
      <div class="mono" id="status-time" style="margin-top:0.2rem;"></div>
    </div>
  </div>
</header>
<div class="locbar">
  <select id="preset">
    <option value="">— preset —</option>
    <optgroup label="Karnataka" id="preset-optgroup">
      <option value="12.9716,77.5946">Bengaluru</option>
      <option value="12.2958,76.6394">Mysuru</option>
      <option value="12.9141,74.8560">Mangaluru</option>
      <option value="15.3647,75.1240">Hubballi</option>
      <option value="15.8497,74.4977">Belagavi</option>
      <option value="17.3297,76.8343">Kalaburagi</option>
    </optgroup>
  </select>
  <span class="sep">·</span>
  <input id="lat" type="text" placeholder="lat" value="12.9716" />
  <input id="lon" type="text" placeholder="lon" value="77.5946" />
  <button id="apply">apply</button>
  <button id="gps" class="gps">📍 GPS</button>
  <button id="map-toggle" class="gps" style="background:rgba(122,183,224,0.3);border-color:rgba(122,183,224,0.6);color:rgba(122,183,224,1);">🗺️ Map</button>
  <span class="coord-display mono" id="coord-display">12.97°N · 77.59°E</span>
</div>
<div id="map-container">
  <div id="map"></div>
</div>
<div class="search-container" style="margin:0 0 2rem 0;">
  <input id="search-input" type="text" placeholder="Search location (village, town, city)..." />
  <div id="search-dropdown"></div>
</div>
<section id="ensemble-section" style="display: none;">
  <header>
    <h2 id="ensemble-heading">Parameter ensemble</h2>
    <span style="font-size:0.7rem;color:var(--text-faint);" id="ensemble-subtitle">all 4 sources ranked</span>
  </header>
  <div id="ensemble-params">
    <div class="skeleton">loading…</div>
  </div>
</section>
<section id="sources-section" style="display: none;">
  <header>
    <h2 id="sources-heading">Source status</h2>
  </header>
  <div class="sources-grid" id="sources-status"></div>
</section>
<section id="error-section" style="display: none;">
  <div class="error-card">
    <strong>Error:</strong> <span id="error-message">Unable to fetch weather data</span>
  </div>
</section>
<footer>
  <p style="margin-bottom:1rem;" id="footer-confidence">
    <strong>How to read confidence:</strong>
    <span style="display:inline-block;margin-top:0.5rem;">
      🟢 <strong id="conf-high">High (>0.85):</strong> <span id="conf-high-desc">sources strongly agree, trust the value.</span> ·
      🟡 <strong id="conf-moderate">Moderate (0.6–0.85):</strong> <span id="conf-moderate-desc">some spread, treat as a range.</span> ·
      🔴 <strong id="conf-low">Low (<0.6):</strong> <span id="conf-low-desc">sources disagree, examine individual contributions.</span>
    </span>
  </p>
  <p id="footer-sources">
    Data sources: <strong>Open-Meteo</strong> (forecast, soil, ET₀) · 
    <strong>NASA POWER</strong> (30-year climatology) · 
    <strong>IMD</strong> (nearest-station observation) · 
    <strong>KSNDMC</strong> (Karnataka climate via OpenCity CKAN).
  </p>
  <p style="margin-top:0.75rem;opacity:0.7;" id="footer-disclaimer">
    Forecasts are probabilistic. No model resolves rainfall at sub-km scale. 
    Cross-check ensemble confidence scores before sowing or irrigation decisions.
  </p>
</footer>
<script>
const translations = {
  en: {
    brandTitle: "Krishi Weather",
    brandTagline: "4-source ensemble with ranking · for dryland decisions",
    langBtn: "ಕನ್ನಡ",
    statusConnecting: "connecting…",
    statusLive: "live · cached at edge",
    statusError: "error",
    statusFetching: "fetching ensemble…",
    statusGetting: "getting location…",
    presetLabel: "— preset —",
    presetGroup: "Karnataka",
    applyBtn: "apply",
    gpsBtn: "📍 GPS",
    mapBtn: "🗺️ Map",
    searchPlaceholder: "Search location (village, town, city)...",
    ensembleHeading: "Parameter ensemble",
    ensembleSubtitle: "all 4 sources ranked",
    sourcesHeading: "Source status",
    errorTitle: "Error:",
    errorDefault: "Unable to fetch weather data",
    errorGPSFailed: "GPS failed",
    errorInvalidCoords: "Invalid coordinates",
    errorHTTP: "HTTP",
    footerConfidence: "How to read confidence:",
    confHigh: "High (>0.85):",
    confHighDesc: "sources strongly agree, trust the value.",
    confModerate: "Moderate (0.6–0.85):",
    confModerateDesc: "some spread, treat as a range.",
    confLow: "Low (<0.6):",
    confLowDesc: "sources disagree, examine individual contributions.",
    footerSources: "Data sources: Open-Meteo (forecast, soil, ET₀) · NASA POWER (30-year climatology) · IMD (nearest-station observation) · KSNDMC (Karnataka climate via OpenCity CKAN).",
    footerDisclaimer: "Forecasts are probabilistic. No model resolves rainfall at sub-km scale. Cross-check ensemble confidence scores before sowing or irrigation decisions.",
    paramTemperature: "Temperature (now)",
    paramRainfall: "Rainfall forecast (today)",
    paramClimatology: "Normal rainfall (this month)",
    paramWind: "Wind speed",
    paramHumidity: "Humidity",
    paramET0: "ET₀ (water demand)",
  },
  kn: {
    brandTitle: "ಕೃಷಿ ಹವಾಮಾನ",
    brandTagline: "4-ಮೂಲಗಳ ಸಮೂಹ ಮತ್ತು ರ್ಯಾಂಕಿಂಗ್ · ಶುಷ್ಕ ಭೂಮಿ ನಿರ್ಧಾರಗಳಿಗೆ",
    langBtn: "English",
    statusConnecting: "ಸಂಪರ್ಕಿಸುತ್ತಿದೆ…",
    statusLive: "ಜೀವಂತ · ಅಂಚಿನಲ್ಲಿ ಕ್ಯಾಶ್ ಮಾಡಲಾಗಿದೆ",
    statusError: "ದೋಷ",
    statusFetching: "ಸಮೂಹವನ್ನು ಪಡೆಯುತ್ತಿದೆ…",
    statusGetting: "ಸ್ಥಾನವನ್ನು ಪಡೆಯುತ್ತಿದೆ…",
    presetLabel: "— ಪೂರ್ವನಿಯೋಜಿತ —",
    presetGroup: "ಕರ್ನಾಟಕ",
    applyBtn: "ಅನ್ವಯಿಸಿ",
    gpsBtn: "📍 ಜಿಪಿಎಸ್",
    mapBtn: "🗺️ ನಕ್ಷೆ",
    searchPlaceholder: "ಸ್ಥಾನವನ್ನು ಹುಡುಕಿ (ಗ್ರಾಮ, ಊರ, ನಗರ)…",
    ensembleHeading: "ನಿಯತಾಂಕ ಸಮೂಹ",
    ensembleSubtitle: "ಎಲ್ಲಾ 4 ಮೂಲಗಳು ಶ್ರೇಣೀಕೃತ",
    sourcesHeading: "ಮೂಲ ಸ್ಥಿತಿ",
    errorTitle: "ದೋಷ:",
    errorDefault: "ಹವಾಮಾನ ಡೇಟಾವನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ",
    errorGPSFailed: "ಜಿಪಿಎಸ್ ವಿಫಲವಾಗಿದೆ",
    errorInvalidCoords: "ಅಮಾನ್ಯ ನಿರ್ದೇಶಾಂಕಗಳು",
    errorHTTP: "ಎಚ್‌ಟಿಟಿಪಿ",
    footerConfidence: "ವಿಶ್ವಾಸವನ್ನು ಓದುವುದು ಹೇಗೆ:",
    confHigh: "ಹೆಚ್ಚು (>0.85):",
    confHighDesc: "ಮೂಲಗಳು ಬಲವಾಗಿ ಒಪ್ಪಿಗೆ ನೀಡುತ್ತವೆ, ಮೌಲ್ಯದ ಮೇಲೆ ನಂಬಿಕೆ ಮಾಡಿ.",
    confModerate: "ಮಧ್ಯಮ (0.6–0.85):",
    confModerateDesc: "ಕೆಲವು ಹರಡುವಿಕೆ, ಶ್ರೇಣಿಯಾಗಿ ಸಂವಹನ ಮಾಡಿ.",
    confLow: "ಕಡಿಮೆ (<0.6):",
    confLowDesc: "ಮೂಲಗಳು ಅಸಹಮತಿ ಪ್ರಕಟಿಸುತ್ತವೆ, ಪ್ರತ್ಯೇಕ ಅವದಾನಗಳನ್ನು ಪರೀಕ್ಷಿಸಿ.",
    footerSources: "ಡೇಟಾ ಮೂಲಗಳು: Open-Meteo (ಮುನ್ನಡೆ, ಮಣ್ಣು, ET₀) · NASA POWER (30-ವರ್ಷದ ಹವಾಮಾನ ವಿಜ್ಞಾನ) · IMD (ಸಮೀಪ ನಿಲ್ದಾಣದ ವೀಕ್ಷಣೆ) · KSNDMC (OpenCity CKAN ಮೂಲಕ ಕರ್ನಾಟಕ ಹವಾಮಾನ).",
    footerDisclaimer: "ಮುನ್ನಡೆಗಳು ಸಂಭವನೀಯತೆಯ ಮೇಲೆ ಆಧಾರಿತವಾಗಿವೆ. ಯಾವುದೇ ಮಾದರಿಯು ಸಬ್‌-ಕಿಮೀ ಪ್ರಮಾಣದಲ್ಲಿ ಮಳೆವನ್ನು ಪರಿಹರಿಸುವುದಿಲ್ಲ. ಬೀಜ ಬಿತ್ತುವ ಅಥವಾ ನೀರಾವರಣ ನಿರ್ಧಾರಗಳ ಮೊದಲು ಸಮೂಹ ವಿಶ್ವಾಸದ ಸ್ಕೋರ್ ಅನ್ನು ಅಡ್ಡಪ್ರಶ್ನೆ ಮಾಡಿ.",
    paramTemperature: "ತಾಪಮಾತ್ರ (ಈಗ)",
    paramRainfall: "ಮಳೆ ಮುನ್ನಡೆ (ಇಂದು)",
    paramClimatology: "ಸಾಮಾನ್ಯ ಮಳೆ (ಈ ತಿಂಗಳು)",
    paramWind: "ಗಾಳಿಯ ವೇಗ",
    paramHumidity: "ತೇವಾಂಶ",
    paramET0: "ET₀ (ನೀರಿನ ಬೇಡಿಕೆ)",
  }
};

let currentLang = 'en';

function t(key) {
  return translations[currentLang][key] || translations.en[key] || key;
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'kn' : 'en';
  updateUIText();
}

function updateUIText() {
  document.getElementById('brand-title').innerHTML = 
    currentLang === 'en' 
      ? 'Krishi <span class="accent">Weather</span>' 
      : '<span class="kannada">' + t('brandTitle') + '</span>';
  document.getElementById('brand-tagline').textContent = t('brandTagline');
  document.getElementById('lang-btn').textContent = t('langBtn');
  document.getElementById('status-text').textContent = t('statusConnecting');
  document.getElementById('preset-optgroup').label = t('presetGroup');
  document.getElementById('preset').options[0].textContent = t('presetLabel');
  document.getElementById('apply').textContent = t('applyBtn');
  document.getElementById('gps').textContent = t('gpsBtn');
  document.getElementById('map-toggle').textContent = t('mapBtn');
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  document.getElementById('ensemble-heading').textContent = t('ensembleHeading');
  document.getElementById('ensemble-subtitle').textContent = t('ensembleSubtitle');
  document.getElementById('sources-heading').textContent = t('sourcesHeading');
  document.getElementById('conf-high').textContent = t('confHigh');
  document.getElementById('conf-high-desc').textContent = t('confHighDesc');
  document.getElementById('conf-moderate').textContent = t('confModerate');
  document.getElementById('conf-moderate-desc').textContent = t('confModerateDesc');
  document.getElementById('conf-low').textContent = t('confLow');
  document.getElementById('conf-low-desc').textContent = t('confLowDesc');
  document.getElementById('footer-sources').innerHTML = t('footerSources');
  document.getElementById('footer-disclaimer').textContent = t('footerDisclaimer');
  
  // Update language font class
  if (currentLang === 'kn') {
    document.body.classList.add('kannada');
  } else {
    document.body.classList.remove('kannada');
  }
}

function parameterName(param) {
  const names = {
    temperature_now: t('paramTemperature'),
    rainfall_forecast: t('paramRainfall'),
    climatology: t('paramClimatology'),
    wind: t('paramWind'),
    humidity: t('paramHumidity'),
    et0: t('paramET0'),
  };
  return names[param] ?? param;
}

function setStatus(kind, text) {
  const statusEl = document.getElementById('status-text');
  if (kind === 'loading') statusEl.textContent = t('statusFetching');
  else if (kind === 'live') statusEl.textContent = t('statusLive');
  else if (kind === 'error') statusEl.textContent = t('statusError') + ': ' + text;
  else statusEl.textContent = text;
  
  const dot = document.querySelector('.dot');
  const colors = {
    live: 'var(--moss)',
    loading: 'var(--amber)',
    error: 'var(--warning)',
  };
  dot.style.background = colors[kind] || 'var(--amber)';
  dot.style.boxShadow = '0 0 8px ' + (colors[kind] || 'var(--amber)');
}

// Original script code with parameterName() replacement
(() => {
  const state = {
    lat: 12.9716,
    lon: 77.5946,
    ensemble: null,
    map: null,
    marker: null,
    searchTimeout: null,
  };
  const $ = (id) => document.getElementById(id);
  
  function initMap() {
    if (state.map) return;
    state.map = L.map("map").setView([state.lat, state.lon], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(state.map);
    updateMapMarker();
    state.map.on("click", onMapClick);
  }
  
  function updateMapMarker() {
    if (!state.map) return;
    if (state.marker) state.marker.remove();
    state.marker = L.circleMarker([state.lat, state.lon], {
      radius: 8,
      fillColor: "#E8A547",
      color: "#EDE6D3",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7,
    })
      .bindPopup(state.lat.toFixed(4) + ", " + state.lon.toFixed(4))
      .addTo(state.map);
  }
  
  function onMapClick(e) {
    state.lat = e.latlng.lat;
    state.lon = e.latlng.lng;
    $("lat").value = state.lat.toFixed(4);
    $("lon").value = state.lon.toFixed(4);
    updateCoordDisplay();
    updateMapMarker();
    reverseGeocode();
    load();
  }
  
  async function reverseGeocode() {
    try {
      const r = await fetch(
        "/api/reverse?lat=" + state.lat + "&lon=" + state.lon
      );
      if (r.ok) {
        const data = await r.json();
        if (state.marker) {
          state.marker.setPopupContent(
            (data.name || "Location") + "<br/>" + 
            state.lat.toFixed(4) + ", " + state.lon.toFixed(4)
          );
        }
      }
    } catch (e) {}
  }
  
  let searchAbort = null;
  $("search-input").addEventListener(
    "input",
    debounce(async function (e) {
      const query = e.target.value.trim();
      if (query.length < 2) {
        $("search-dropdown").classList.remove("active");
        return;
      }
      if (searchAbort) searchAbort.abort();
      searchAbort = new AbortController();
      try {
        const r = await fetch("/api/search?q=" + encodeURIComponent(query));
        if (r.ok) {
          const data = await r.json();
          renderSearchResults(data.results);
        }
      } catch (e) {}
    }, 300)
  );
  
  function renderSearchResults(results) {
    if (!results || results.length === 0) {
      $("search-dropdown").innerHTML = '<div style="padding:0.6rem;color:var(--text-faint);">No results</div>';
      $("search-dropdown").classList.add("active");
      return;
    }
    const html = results
      .slice(0, 8)
      .map(
        (r) =>
          '<div class="search-result" data-lat="' +
          r.lat +
          '" data-lon="' +
          r.lon +
          '">' +
          '<div class="name">' +
          r.name +
          '</div>' +
          '<div class="type">' +
          (r.type || r.address?.town || "") +
          "</div>" +
          "</div>"
      )
      .join("");
    $("search-dropdown").innerHTML = html;
    $("search-dropdown").classList.add("active");
    document.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("click", function () {
        state.lat = parseFloat(this.dataset.lat);
        state.lon = parseFloat(this.dataset.lon);
        $("lat").value = state.lat.toFixed(4);
        $("lon").value = state.lon.toFixed(4);
        $("search-input").value = "";
        $("search-dropdown").classList.remove("active");
        updateCoordDisplay();
        if (state.map) {
          state.map.setView([state.lat, state.lon], 13);
          updateMapMarker();
        }
        load();
      });
    });
  }
  
  $("search-input").addEventListener("focus", function () {
    if (this.value.trim().length > 1) {
      $("search-dropdown").classList.add("active");
    }
  });
  
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-container")) {
      $("search-dropdown").classList.remove("active");
    }
  });
  
  $("map-toggle").addEventListener("click", function () {
    const container = $("map-container");
    container.classList.toggle("active");
    if (container.classList.contains("active")) {
      setTimeout(() => {
        initMap();
        if (state.map) state.map.invalidateSize();
      }, 100);
    }
  });
  
  function validateCoords(lat, lon) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const errors = [];
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      errors.push(t('errorInvalidCoords') + ": Latitude -90 to 90");
    }
    if (!Number.isFinite(lonNum) || lonNum < -180 || lonNum > 180) {
      errors.push(t('errorInvalidCoords') + ": Longitude -180 to 180");
    }
    return { valid: errors.length === 0, errors, lat: latNum, lon: lonNum };
  }
  
  function showError(message) {
    $("error-section").style.display = "block";
    $("ensemble-section").style.display = "none";
    $("sources-section").style.display = "none";
    $("error-message").textContent = message;
    setStatus("error", message);
  }
  
  function updateCoordDisplay() {
    const latDir = state.lat >= 0 ? 'N' : 'S';
    const lonDir = state.lon >= 0 ? 'E' : 'W';
    $("coord-display").textContent = 
      state.lat.toFixed(2) + '°' + latDir + ' · ' + state.lon.toFixed(2) + '°' + lonDir;
  }
  
  function confidenceBadge(confidence) {
    if (confidence > 0.85) return { class: "high", label: "High" };
    if (confidence > 0.6) return { class: "moderate", label: "Moderate" };
    return { class: "low", label: "Low" };
  }
  
  function renderEnsemble() {
    if (!state.ensemble?.parameters) {
      $("ensemble-section").style.display = "none";
      return;
    }
    const params = state.ensemble.parameters;
    const html = [];
    for (const [param, result] of Object.entries(params)) {
      if (param === "_summary" || result.value == null) continue;
      const badge = confidenceBadge(result.confidence);
      const unit = {
        temperature_now: "°C",
        rainfall_forecast: "mm",
        climatology: "mm/day",
        wind: "km/h",
        humidity: "%",
        et0: "mm/day",
      }[param] ?? "";
      const range = result.range[0] != null && result.range[1] != null
        ? result.range[0] + '–' + result.range[1] + unit
        : "";
      const sourceChips = result.contributions.map((c) => {
        const isPrimary = c.source === result.primary ? 'primary' : '';
        const pct = (c.weight_pct * 100).toFixed(0);
        return '<span class="source-chip ' + isPrimary + '">' +
          c.source.substring(0, 3).toUpperCase() +
          ' <span class="pct">' + pct + '%</span>' +
          '</span>';
      }).join("");
      let row = '<div class="param-row">' +
        '<div class="param-name">' + parameterName(param) + '</div>' +
        '<div class="param-value">' +
          '<span class="val">' + result.value + '</span>' +
          '<span class="unit">' + unit + '</span>' +
          '<span class="range">' + range + '</span>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div class="confidence ' + badge.class + '">' + badge.label + '</div>' +
          '<div class="param-sources" style="margin-top:0.4rem;">' +
            sourceChips +
          '</div>' +
        '</div>' +
        '</div>';
      html.push(row);
    }
    $("ensemble-params").innerHTML = html.join("");
    $("ensemble-section").style.display = "block";
  }
  
  function renderSourceStatus() {
    if (!state.ensemble?.sources_status) return;
    const status = state.ensemble.sources_status;
    const sources = {
      "open-meteo": "Open-Meteo",
      "nasa-power": "NASA POWER",
      imd: "IMD",
      ksndmc: "KSNDMC",
    };
    const html = Object.entries(sources).map(([key, label]) => {
      const s = status[key];
      const isFulfilled = s === "fulfilled";
      const badge = isFulfilled ? 'fulfilled' : 'rejected';
      const badgeText = isFulfilled ? '✓ OK' : '✗ FAILED';
      return '<div class="source-status">' +
        '<div class="name">' + label + '</div>' +
        '<span class="badge ' + badge + '">' + badgeText + '</span>' +
        '</div>';
    }).join("");
    $("sources-status").innerHTML = html;
    $("sources-section").style.display = "block";
  }
  
  function debounce(fn, ms) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), ms);
    };
  }
  
  async function load() {
    const valid = validateCoords(state.lat, state.lon);
    if (!valid.valid) {
      showError(valid.errors.join("; "));
      return;
    }
    setStatus("loading", "");
    try {
      const url = "/api/ensemble?lat=" + state.lat + "&lon=" + state.lon;
      const r = await fetch(url);
      if (!r.ok) throw new Error(t('errorHTTP') + " " + r.status);
      state.ensemble = await r.json();
      if (!state.ensemble || !state.ensemble.parameters) {
        throw new Error("Invalid response format");
      }
      $("error-section").style.display = "none";
      renderEnsemble();
      renderSourceStatus();
      setStatus("live", "");
      $("status-time").textContent = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: false,
      }) + " IST";
    } catch (e) {
      showError(e.message);
    }
  }
  
  $("preset").addEventListener("change", (e) => {
    if (!e.target.value) return;
    const [lat, lon] = e.target.value.split(",").map(Number);
    state.lat = lat;
    state.lon = lon;
    $("lat").value = lat;
    $("lon").value = lon;
    updateCoordDisplay();
    load();
  });
  
  $("apply").addEventListener("click", () => {
    const lat = $("lat").value;
    const lon = $("lon").value;
    const valid = validateCoords(lat, lon);
    $("lat").classList.toggle("error", !valid.valid);
    $("lon").classList.toggle("error", !valid.valid);
    if (valid.valid) {
      state.lat = valid.lat;
      state.lon = valid.lon;
      updateCoordDisplay();
      load();
    } else {
      showError(valid.errors.join("; "));
    }
  });
  
  $("gps").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showError(t('errorGPSFailed'));
      return;
    }
    setStatus("loading", "");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        $("lat").value = state.lat.toFixed(4);
        $("lon").value = state.lon.toFixed(4);
        updateCoordDisplay();
        load();
      },
      (err) => showError(t('errorGPSFailed') + ": " + err.message),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
  
  updateCoordDisplay();
  load();
})();
</script>
</body>
</html>`;
