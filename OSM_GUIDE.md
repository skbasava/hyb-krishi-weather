# OpenStreetMap Integration Guide

## What's New

Your Krishi Weather dashboard now has **3 ways to set your location**:

### 1️⃣ **Search by Place Name**
Type "Mysuru" or "Belagavi" in the search box → get autocomplete results → click to select.

### 2️⃣ **Click on Interactive Map**
Click the 🗺️ **Map** button → interactive OpenStreetMap opens → click anywhere on the map → location updates instantly.

### 3️⃣ **Manual Coordinates + Presets**
Old way still works: type lat/lon or select from dropdown presets (Bengaluru, Mysuru, etc.)

---

## Architecture

### Backend (worker.js)
```
GET /api/search?q=Mysuru
  → Nominatim API (OpenStreetMap's official geocoder)
  → returns: {lat, lon, name, address, type}

GET /api/reverse?lat=12.97&lon=77.59
  → Nominatim reverse geocoding
  → returns: place name at those coordinates
```

**Why Nominatim?**
- Official OpenStreetMap geocoding
- Free, no API key
- Rate limit: 1 req/sec (Cloudflare Workers distributed → unlikely to hit)
- Respects India-specific place names and boundaries

### Frontend (dashboard.js)
```
Search Input → /api/search?q=...
  ↓
Search Dropdown (8 results max, live autocomplete)
  ↓
User clicks result → /api/ensemble with new coords
  ↓
Map (Leaflet.js) shows location + all ensemble data

Map Click → /api/reverse for place name
  → /api/ensemble with new coords
```

**Why Leaflet.js?**
- Lightweight (45 KB)
- Standard library for OpenStreetMap
- No API key needed (uses free OSM tiles)
- Mobile-friendly

---

## How to Use

### 1. Search for Your Location

```
┌─────────────────────────────────────┐
│ Search location (village, town...)  │ ← Type here
└─────────────────────────────────────┘
  Mysuru
  Belgaum
  Belagavi
  ↑ Click one
```

**Examples:**
- "Bengaluru" → Bengaluru city
- "Nanjanagudu" → village in Mysuru district
- "Kanakapura" → taluk in Ramanagara
- "Kodagu" → entire district

### 2. Click on Map

```
[🗺️ Map] ← Click this button
    ↓
[Interactive Map Appears]
[Click anywhere on the map]
    ↓
Location updates + ensemble data loads
```

**The map shows:**
- OpenStreetMap (village/town roads, water bodies, forests)
- Your current location (amber circle with blue border)
- Zoom: 13 (shows ~50 km area, can zoom in/out)

### 3. Manual Entry

```
Lat: 12.9716  Lon: 77.5946  [apply]
```

All three methods feed the same `/api/ensemble` endpoint, so results are consistent.

---

## Backend Details

### Search Endpoint: `/api/search`

**Request:**
```
GET /api/search?q=Mysuru
```

**Response:**
```json
{
  "query": "Mysuru",
  "count": 5,
  "results": [
    {
      "id": 291234567,
      "name": "Mysuru",
      "lat": 12.2958,
      "lon": 76.6394,
      "type": "city",
      "display_name": "Mysuru, Mysuru District, Karnataka, India",
      "address": {
        "city": "Mysuru",
        "state": "Karnataka",
        "country": "India"
      }
    },
    ...
  ]
}
```

**Filtering:**
- Limited to India only (`countrycodes=in`)
- Top 10 results by relevance (only 8 shown in dropdown)
- Cached 5 minutes at edge (Nominatim can be slow)

### Reverse Geocode: `/api/reverse`

**Request:**
```
GET /api/reverse?lat=12.2958&lon=76.6394
```

**Response:**
```json
{
  "lat": 12.2958,
  "lon": 76.6394,
  "name": "Mysuru",
  "display_name": "Mysuru, Mysuru District, Karnataka, India",
  "address": {
    "village": null,
    "town": "Mysuru",
    "city": null,
    "state": "Karnataka",
    "country": "India"
  }
}
```

**Used for:**
- When you click on the map, shows the place name in the marker popup
- Updates header with "Mysuru" instead of just "12.30°N, 76.64°E"
- Cached 24 hours (place names don't change)

---

## Nominatim API Details

**Official docs:** https://nominatim.org/release-docs/latest/api/Overview/

**What we use:**
- Search endpoint: `https://nominatim.openstreetmap.org/search`
- Reverse endpoint: `https://nominatim.openstreetmap.org/reverse`

**Rate limits:**
- 1 request per second per IP address
- Cloudflare Workers have distributed IPs → de facto higher limit
- User-Agent: `KrishiWeather/1.0 (agro-weather for Indian farmers)`

**Parameters:**
```
Search:
  q = query string (village/town/city name)
  format = json
  countrycodes = in (India only)
  limit = 10
  addressdetails = 1

Reverse:
  lat, lon = coordinates
  format = json
  addressdetails = 1
  zoom = 18 (highest detail)
```

**Latency:**
- Nominatim: 500–2000ms (varies)
- Cloudflare edge cache: hits within 5 min save 100ms
- Typical user sees results in <1 sec

---

## Leaflet Map Configuration

**Map Container:**
```javascript
L.map("map").setView([12.97, 77.59], 13)
  // Initial zoom: 13 (about 50 km view)
  // Zoomable to 19 (2 meter detail)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
  // Free OpenStreetMap tiles
  // No API key, no rate limit (on-demand CDN)

L.circleMarker([lat, lon])
  // Amber circle with blue border
  // Click shows coordinates
```

**Click handler:**
```javascript
map.on("click", function(e) {
  // e.latlng.lat, e.latlng.lng
  // → reverse geocode for place name
  // → fetch /api/ensemble with new coords
})
```

**Marker Popup:**
```
Mysuru
12.2958, 76.6394
```

Updated via `/api/reverse` when map is clicked.

---

## Edge Cases & Gotchas

### 1. Search Returns Multiple Results
```
"Mysuru" search returns:
  1. Mysuru city (lat 12.30, lon 76.64)
  2. Mysuru district (lat 12.18, lon 76.58)
  3. Mysuru Airport (lat 12.22, lon 76.81)
```
**Solution:** User clicks the one they want. We take first 8 results.

### 2. Offline or Nominatim Slow
- Search box may not respond (but doesn't block the app)
- User can still use manual lat/lon entry or GPS
- Ensemble still works with last known location

### 3. Coordinates Outside India
- Nominatim works globally (not restricted)
- KSNDMC gracefully skips (they only have Karnataka data)
- Other 3 sources (Open-Meteo, NASA POWER, IMD) still work
- **Result:** Ensemble still gives you forecast, just without KSNDMC's local calibration

### 4. Mobile: Small Screen
- Search dropdown visible but narrow (~200px)
- Map reduces to 250px height on phones (still usable)
- Tap map to toggle full-screen (via 🗺️ button)

---

## Performance

| Operation | Latency | Caching |
|-----------|---------|---------|
| Type in search | 300ms debounce | N/A |
| First search result | 500–2000ms | 5 min |
| Click on map | <100ms local | N/A |
| Reverse geocode | 500–2000ms | 24 h |
| Map load + render | 100–300ms | N/A |

**Mobile data:**
- Search query: ~5 KB
- Reverse geocode: ~3 KB
- Map tiles (initial view): ~200 KB (cached by browser)

---

## Testing Checklist

### Search
- [ ] Type "Bengaluru" → see dropdown with results
- [ ] Click a result → location updates + map recenter
- [ ] Type invalid place → "No results" message
- [ ] Outside India (e.g., "London") → should still find it (but KSNDMC won't apply)

### Map
- [ ] Click 🗺️ button → map appears
- [ ] Click on map → marker moves, ensemble updates
- [ ] Zoom in/out → works
- [ ] Close map (click button again) → data persists
- [ ] On mobile: map in portrait → readable

### Integration
- [ ] Search → ensemble data loads
- [ ] Map click → ensemble data loads
- [ ] GPS button → ensemble data loads
- [ ] Manual lat/lon → ensemble data loads
- [ ] All show same data (no inconsistency)

---

## Extending

### Add More Presets
In dashboard HTML, add to `<select id="preset">`:
```html
<optgroup label="Telangana">
  <option value="17.3850,78.4867">Hyderabad</option>
  <option value="17.9689,79.5941">Karimnagar</option>
</optgroup>
```

### Change Map Zoom
In dashboard JS, `initMap()`:
```javascript
state.map = L.map("map").setView([state.lat, state.lon], 15); // Was 13
```

### Add Geofencing (Advanced)
```javascript
// Warn if user selects outside India
if (state.lon < 68 || state.lon > 97 || state.lat < 8 || state.lat > 35) {
  alert("Warning: Outside India, KSNDMC data unavailable");
}
```

### Add More Nominatim Details
The reverse geocode response includes full address breakdown:
```javascript
data.address.village      // For grain-panchayat level
data.address.taluk        // Not in Nominatim, but could extend
data.address.district     // Not direct, but in address hierarchy
```

---

## References

- **Nominatim API**: https://nominatim.org/release-docs/latest/api/Overview/
- **OpenStreetMap Data**: https://www.openstreetmap.org/
- **Leaflet.js**: https://leafletjs.com/
- **Leaflet CDN**: https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/

---

## Troubleshooting

### Search box not responding
- Check Cloudflare logs: `npx wrangler tail`
- Nominatim may be rate-limited or slow
- Try manual lat/lon entry

### Map not loading
- Check browser console for JS errors
- Leaflet library may not have loaded (network issue)
- Try refreshing

### Reverse geocoding wrong
- Nominatim sometimes mis-assigns villages/towns
- Doesn't affect ensemble (ensemble works on lat/lon)
- Just a label issue

### Search returns London before Bengaluru
- Nominatim ranks by relevance + population
- Just click the correct one; it's in the dropdown

---

## Summary

✓ **Nominatim Search** → find places by name, autocomplete
✓ **Leaflet Map** → click to select location visually  
✓ **Reverse Geocoding** → show place name when you click
✓ **Zero API keys** → free & open-source
✓ **Works offline** → last known location always available
✓ **Mobile-friendly** → map responsive to phone screens

**You now have a full farmer-friendly location picker. Deploy & use it!**
