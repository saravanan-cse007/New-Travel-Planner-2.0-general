# Travel Planner AI — Product Requirements (PRD)

## Original Problem
Continuation work on an existing Travel Planner AI (React + FastAPI + Mongo + Gemini + Google Maps + OpenWeather + Unsplash).
Goal: enhance functionality to match Google Travel / Wanderlog / TripIt / Expedia while preserving the existing premium dark purple UI.

## Source Codebase
- Provided as ZIP: `Travel-Planner-AI-sara-main.zip` (extracted to `/app`)
- Pre-existing stack: zustand auth, recharts, framer-motion, sonner toasts, glass/glow theme

## What's been implemented (Jan 2026 session)

### Phase 1 — Trip Planner page
- **Google Places Autocomplete** for Source (From) & Destination (To) — `/api/places/autocomplete` + `/api/places/details`
- **Swap button** between Source & Destination
- **Auto-calculated Number of Days** (read-only) — derived from start/end dates
- **Date validation** — "End date cannot be before start date", blocks submission
- **Smart Currency Detection** — destination country → suggested currency, exchange rate via `open.er-api.com` (no API key)
- **Budget Breakdown** card — live percentages + amounts for Accommodation / Transport / Food / Activities / Shopping / Emergency
- **Smart Transport cards** — destination-aware filtered modes (Tokyo gets metro/train, Venice gets boat/walking), per-mode cost estimate via Distance Matrix + per-km heuristics, % of budget
- **Food Preference adds "Both"** (Vegetarian + Non-Vegetarian)
- **Form validation** — Generate AI Itinerary disabled until all required fields filled, contextual hint
- **Backend stores extra data**: source_location, destination_location, exchange_rate, transport_mode, transport_cost_estimate, budget_breakdown_input

### Phase 2 — Itinerary page
- **Day Header**: Day N • Weekday • DD MMM YYYY • Destination (via date-fns)
- **Live OpenWeather** — current + per-day forecast with feels-like, humidity, wind, rain%, UV, sunrise/sunset, condition icons (lucide-react mapping)
- **Weather-aware AI planning** — server fetches forecast and includes it in Gemini prompt; itinerary adapts to rainy/sunny/cloudy days
- **DayWeatherBanner** — replaces small "Rain Plan" with "Today's Weather: … plan optimized for indoor attractions" card
- **Smart Activity Cards** — photo (Unsplash + Places geocode for Maps link), rating, duration, opening hours, travel time/distance from previous stop, cost, Open-in-Google-Maps button
- **Daily Budget Summary** at bottom of each day — Stay/Transit/Food/Activities/Shopping/Emergency + Daily Total
- **Per-day regenerate** — `/api/trips/{id}/regenerate-day` endpoint, button on every day card, AI chat detects "day N" + intent verbs to auto-regenerate single day
- **WeatherTab** — hourly forecast (10h carousel), 7-day forecast, AQI from OpenWeather Air Pollution API
- **BudgetTab** — interactive pie + bar charts (recharts), pct used progress, optimization tips when over budget
- **EnhancedMapTab** — Google Maps Embed + tabs to switch between Attractions / Hotels / Restaurants / Transit Stops, each backed by Google Places Nearby
- **SafetyTab** — emergency number (country lookup), nearby hospitals, police, pharmacies, embassies, ATMs (all from Google Places Nearby)
- **AI Chat** — improved with day-targeting (mention "day 3" + verb → regenerate only that day), suggestion chips

### Performance
- Server-side TTL caches: autocomplete (10m), place details (1d), geocode (1d), exchange rates (6h), distance matrix (1h)
- Debounced (180ms) autocomplete input
- Lazy-loaded images
- Skeleton loaders on every tab
- Graceful API error handling (e.g. AQI hidden if endpoint fails)

### Backend (`/app/backend/server.py`)
- Switched LLM from Emergent Universal Key to **direct Google Gen AI SDK** (model `gemini-2.5-flash`) since user's universal-key budget was depleted; still falls back to `emergentintegrations` if `GEMINI_API_KEY` missing.
- New endpoints: `/api/places/autocomplete`, `/api/places/details`, `/api/places/nearby`, `/api/places/photo`, `/api/directions`, `/api/currency/rates`, `/api/currency/convert`, `/api/budget/breakdown`, `/api/transport/options`, `/api/transport/estimate`, `/api/weather/air-quality`, `/api/trips/{id}/regenerate-day`

## Backlog / Future
- P1 — Add `interest`-aware activity filtering in transport options (currently country/city-only).
- P1 — Wire OpenWeather One-Call 3.0 for accurate UV index (currently UV is null; subscription required).
- P2 — Replace Unsplash photos with Google Places photo for stronger relevance (endpoint already exists, integration in ActivityCard pending).
- P2 — Add multi-stop route polyline on the Map tab using Directions API.
- P2 — Native mobile-app push for itinerary changes.

## Test credentials & sample data
- See `/app/memory/test_credentials.md`
