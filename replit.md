# WalkList Planner

A focused route-planning workspace that helps users turn a Google Maps saved list of places into an interactive walking route with ordered stops, walking times, and route summaries.

## Run & Operate

- `pnpm --filter @workspace/walklist-planner run dev` — run the WalkList Planner web app
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui components
- Map: Google Maps JavaScript API (with Leaflet fallback when API key is missing)
- Routing: Google Maps Directions API (walking mode) with haversine mock fallback
- Geocoding: Google Maps Geocoding API with mock fallback
- Storage: Browser localStorage (no backend, no database for MVP)

## Where things live

- `artifacts/walklist-planner/src/` — main app source
  - `types/route.ts` — TypeScript types (Location, RoutePlan, RouteLeg, RouteState)
  - `data/sampleRoute.ts` — hardcoded SF sample route data
  - `hooks/useRouteState.ts` — state management + localStorage persistence
  - `services/` — geocoding, routing, Google Maps loader
  - `components/` — UI components (RouteList, MapPanel, AddLocationModal, etc.)
- `artifacts/walklist-planner/.env.example` — environment variable template

## Architecture decisions

- **No backend** — MVP is 100% client-side; localStorage is the only persistence layer.
- **Graceful API degradation** — App detects missing `VITE_GOOGLE_MAPS_API_KEY` and falls back to Leaflet + haversine distance estimates automatically, so it always works.
- **Route order = sequence only** — Reordering stops changes `activeLocationIds` array only; location details (name, address, coords) are never mutated.
- **Debounced recalculation** — Route and localStorage writes are debounced (400ms / 300ms) to avoid thrashing on rapid reorder.

## Product

Users add locations (name + address), view them on an interactive map, and get walking times between consecutive stops. They can remove stops temporarily (they stay in a "Removed" list), restore them, reorder stops, and see total walking time and distance update live. A sample San Francisco route demonstrates the app immediately.

## User preferences

- No emojis in the UI
- Clean, calm, mobile-first design
- All CSS variables must be real HSL values (no red placeholders)

## Gotchas

- `VITE_GOOGLE_MAPS_API_KEY` must be set as a Replit Secret (not a plain env var) to appear in the frontend via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
- Enable Maps JavaScript API, Directions API, and Geocoding API in Google Cloud Console
- Leaflet CSS must be imported for mock map mode to render correctly
- Route recalculation is debounced — changes may take ~400ms to reflect on the map

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
