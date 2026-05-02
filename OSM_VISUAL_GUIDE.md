# Krishi Weather — OpenStreetMap Location Picker (Visual Guide)

## Dashboard Layout (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│  KRISHI WEATHER — Location Ensemble                         │
├─────────────────────────────────────────────────────────────┤
│  Location Input:                                             │
│                                                               │
│  [Preset ▼] · [Lat] [Lon] [Apply] [📍 GPS] [🗺️ Map]         │
│  ├─ Karnataka cities, search, GPS, map                       │
│                                                               │
│  [Search location (village, town, city)...                  │
│   Mysuru                                                      │
│   ├─ Mysuru city                    12.30°N, 76.64°E        │
│   ├─ Mysuru district                12.18°N, 76.58°E        │
│   └─ Mysuru Airport                 12.22°N, 76.81°E        │
│  ]                                                           │
│                                                               │
│  [─────────── Interactive Map ───────────────]              │
│  │                                             │             │
│  │  OpenStreetMap (when 🗺️ clicked)           │             │
│  │                                             │             │
│  │     🌍                                      │             │
│  │    [Roads, villages, water, forests]       │             │
│  │    [Zoom in/out to see detail]             │             │
│  │    [Click anywhere → location updates]     │             │
│  │                                             │             │
│  │          🟠 (Your farm location)            │             │
│  │          Mysuru                             │             │
│  │          12.30°N, 76.64°E                  │             │
│  │                                             │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  [Parameter Ensemble ── all 4 sources ranked]               │
│  ├─ Temperature (now): 27.3°C 🟢 High (0.94)                │
│  │   Open-Meteo 52% | IMD 48%                               │
│  ├─ Rainfall (forecast): 15.2mm 🟢 High (0.87)              │
│  │   Open-Meteo 52% | IMD 48%                               │
│  ├─ ET₀ (water demand): 4.1mm 🟢 High (0.94)                │
│  │   Open-Meteo 100% (only source)                          │
│  └─ ...                                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Search by Place Name

```
User Types:
  "Nanjanagudu"
          ↓
Frontend debounce (300ms)
          ↓
GET /api/search?q=Nanjanagudu
          ↓
Nominatim API
  Returns: {name, lat, lon, address, type}
          ↓
Dropdown shows:
  ┌─────────────────────────┐
  │ Nanjanagudu             │
  │ Village, Mysuru         │
  │ (click to select)       │
  │                         │
  │ Nanjanagudu Taluk       │
  │ Taluk, Mysuru           │
  └─────────────────────────┘
          ↓
User clicks result
          ↓
Frontend updates:
  state.lat = 12.1234
  state.lon = 76.5678
  Search box clears
  Map recenter (if open)
          ↓
GET /api/ensemble?lat=12.1234&lon=76.5678
          ↓
Dashboard shows:
  Nanjanagudu
  12.12°N, 76.57°E
  [Ensemble results for this location]
```

### Flow 2: Click on Map

```
User clicks [🗺️ Map] button
          ↓
Map container appears (Leaflet)
  Shows OpenStreetMap
  Current location: amber circle
  Zoomable to level 19 (2m detail)
          ↓
User clicks on map (e.g., over field)
          ↓
Frontend captures:
  e.latlng.lat = 12.1256
  e.latlng.lon = 76.5789
          ↓
Marker moves to click point
          ↓
GET /api/reverse?lat=12.1256&lon=76.5789
          ↓
Nominatim returns place name (optional)
          ↓
Marker popup shows:
  Nanjanagudu (or nearest name)
  12.1256°N, 76.5789°E
          ↓
GET /api/ensemble?lat=12.1256&lon=76.5789
          ↓
Dashboard updates:
  Coordinates in text boxes
  Ensemble results
  Map stays open (can click again)
```

### Flow 3: GPS Geolocation

```
User clicks [📍 GPS] button
          ↓
Browser requests permission
  "Allow Krishi Weather to use your location?"
          ↓
If allowed:
  navigator.geolocation.getCurrentPosition()
  Returns: {latitude, longitude, accuracy}
          ↓
Frontend updates:
  state.lat = device_lat
  state.lon = device_lon
  Map recenter (if open)
          ↓
GET /api/ensemble?lat=...&lon=...
          ↓
Dashboard shows:
  Your current farm coordinates
  Ensemble data for this exact spot
```

### Flow 4: Manual Lat/Lon Entry

```
User types manually:
  Lat: 12.3456
  Lon: 76.5432
  [Apply button]
          ↓
Frontend validates:
  lat: -90 to 90?
  lon: -180 to 180?
          ↓
If invalid:
  Red highlight
  Error message
  No API call
          ↓
If valid:
  state.lat = 12.3456
  state.lon = 76.5432
  Map updates (if open)
          ↓
GET /api/ensemble?lat=12.3456&lon=76.5432
          ↓
Dashboard shows results
```

---

## Backend Request/Response Examples

### 1. Search Request

```bash
curl "https://your-worker.workers.dev/api/search?q=Bengaluru"
```

**Response:**
```json
{
  "query": "Bengaluru",
  "count": 8,
  "results": [
    {
      "id": 297969841,
      "name": "Bengaluru",
      "lat": 12.9716,
      "lon": 77.5946,
      "type": "city",
      "display_name": "Bengaluru, Bengaluru Urban District, Karnataka, India",
      "address": {
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India"
      }
    },
    {
      "id": 294097476,
      "name": "Bengaluru",
      "lat": 12.7489,
      "lon": 77.5419,
      "type": "administrative",
      "display_name": "Bengaluru Urban, Karnataka, India",
      "address": {
        "state": "Karnataka",
        "country": "India"
      }
    }
    // ... more results
  ]
}
```

### 2. Reverse Geocode Request

```bash
curl "https://your-worker.workers.dev/api/reverse?lat=12.9716&lon=77.5946"
```

**Response:**
```json
{
  "lat": 12.9716,
  "lon": 77.5946,
  "name": "Bengaluru",
  "address": {
    "building": null,
    "residential": "Residency Road",
    "suburb": "Challaghatta",
    "village": null,
    "town": "Bengaluru",
    "city": null,
    "state": "Karnataka",
    "postcode": "560001",
    "country": "India"
  },
  "display_name": "Residency Road, Bengaluru, Bengaluru Urban District, Karnataka, 560001, India"
}
```

### 3. Ensemble Request (After Location Selected)

```bash
curl "https://your-worker.workers.dev/api/ensemble?lat=12.9716&lon=77.5946"
```

**Response** (same as before, but now from user-selected location):
```json
{
  "location": {
    "lat": 12.9716,
    "lon": 77.5946
  },
  "sources_status": {
    "open-meteo": "fulfilled",
    "nasa-power": "fulfilled",
    "imd": "fulfilled",
    "ksndmc": "fulfilled"
  },
  "parameters": {
    "temperature_now": {
      "value": 27.3,
      "confidence": 0.94,
      "primary": "imd",
      "range": [26.8, 28.1],
      "contributions": [...]
    },
    ...
  }
}
```

---

## Map Features Explained

### Map Tiles (OpenStreetMap)

```
Zoom 0-4:    Countries, regions
Zoom 5-8:    States, districts
Zoom 9-12:   Taluks, towns (default: 13)
Zoom 13-16:  Villages, roads
Zoom 17-19:  Individual buildings, field details
```

**At zoom 13 (default):**
- Shows ~50 km × 50 km area
- Renders: roads, villages, fields, water bodies
- Pan/zoom with mouse wheel or touch

### Marker

```
🟠 Amber circle with blue border
  Size: radius 8px (adjustable)
  Click shows popup:
    Place name (from reverse geocode, or empty)
    Coordinates: 12.9716°N, 77.5946°E

Moves when:
  - You click the map
  - You select from search dropdown
  - You tap GPS button
  - You manually enter lat/lon
```

### Interaction

```
Click & Drag  → Pan map
Scroll wheel  → Zoom in/out
Double-click  → Zoom in at point
Pinch (mobile)→ Zoom in/out
Click marker  → Show popup
Click map     → Update location
```

---

## Data Flow Diagram

```
┌──────────────────┐
│  User Input      │
├──────────────────┤
│ • Search box     │
│ • Map click      │
│ • GPS button     │
│ • Manual entry   │
│ • Preset select  │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend Validation & Updates      │
├─────────────────────────────────────┤
│ • Bounds check (lat/lon)            │
│ • Debounce search (300ms)           │
│ • Update map marker (if visible)    │
│ • Show/hide dropdown                │
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Cloudflare Worker (Edge)           │
├─────────────────────────────────────┤
│ • /api/search → Nominatim           │ Cache: 5 min
│ • /api/reverse → Nominatim          │ Cache: 24 h
│ • /api/ensemble → 4 sources         │ Cache: 15 min
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  External APIs (Public, Free)       │
├─────────────────────────────────────┤
│ • Nominatim (OSM) → places          │
│ • Open-Meteo → forecast             │
│ • NASA POWER → climatology          │
│ • IMD → observations                │
│ • KSNDMC/CKAN → Karnataka climate   │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Dashboard Renders   │
├──────────────────────┤
│ • Confidence badges  │
│ • Source rankings    │
│ • Per-parameter data │
└──────────────────────┘
```

---

## Mobile Experience

### Portrait (Phone)

```
┌──────────────────┐
│ Krishi Weather   │
├──────────────────┤
│ [Preset] [GPS]   │
│ [Map]            │ ← 2 buttons per row
├──────────────────┤
│ [Search...]      │
├──────────────────┤
│                  │
│  Map Container   │ ← 250px height
│  (if enabled)    │
│                  │
├──────────────────┤
│ Temp: 27.3°C     │
│ Rain: 15.2mm     │
│ ...              │
└──────────────────┘
```

### Landscape (Tablet/Wide)

```
┌─────────────────────────────────────────────┐
│ Krishi Weather — Location Ensemble          │
├─────────────────────────────────────────────┤
│ [Preset] [Lat] [Lon] [Apply] [GPS] [Map]   │
│ [Search location...]                         │
├────────────────────┬──────────────────────────┤
│                    │                          │
│  Map Container     │  Ensemble Results        │
│  (400px height)    │  Temp, Rain, Wind, ET₀  │
│  [Click to set]    │  with confidence badges  │
│                    │                          │
│                    │  Source contributions    │
├────────────────────┴──────────────────────────┤
```

---

## Common Tasks

### Find your exact farm location

1. Click [🗺️ Map]
2. Zoom in (scroll wheel) until you see fields
3. Click on your farm
4. Ensemble updates for that exact spot
5. Done! Coordinates saved.

### Compare rainfall across your region

1. Click map, move to different field
2. Check rainfall forecast (updates instantly)
3. Compare to another location
4. Click original location to reset

### Find nearest weather data source (advanced)

1. Use ensemble endpoint directly
2. Check `contributions` array
3. See which source has highest `weight_pct`
4. That's the nearest/freshest data for your location

---

## Summary

✅ **Search** — Type place name, get autocomplete from Nominatim
✅ **Map** — Interactive OpenStreetMap, click to select
✅ **Reverse** — Click on map, see place name automatically
✅ **Mobile** — Works on phones (250px map, responsive layout)
✅ **Performance** — Cached, edge-optimized, sub-second updates
✅ **Free** — Nominatim + OpenStreetMap + Leaflet all free & open-source

**Deploy with OSM integration and give farmers a real geographic context for their weather data!**
