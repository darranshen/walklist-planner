import { useEffect, useRef, useState } from "react";
import { Location, RouteLeg } from "../types/route";
import { loadGoogleMaps } from "../services/googleMaps";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPanelProps {
  activeLocations: Location[];
  legs: RouteLeg[];
  isMockMode: boolean;
  onApiFailure: () => void;
  selectedLocationId?: string | null;
  onSelectLocation?: (id: string | null) => void;
}

// ─── Place preview helpers ───────────────────────────────────────────────────

const GENERIC_TYPES = new Set([
  "point_of_interest", "establishment", "premise", "subpremise",
  "political", "locality", "sublocality", "neighborhood",
  "street_address", "route", "geocode",
]);

function formatType(types: string[] = []): string {
  const t = types.find((t) => !GENERIC_TYPES.has(t));
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const star = `<span style="color:#fbbc04;">★</span>`;
  const halfStar = `<span style="color:#fbbc04;opacity:0.55;">★</span>`;
  const emptyStar = `<span style="color:#d1d5db;">★</span>`;
  return star.repeat(full) + halfStar.repeat(half) + emptyStar.repeat(empty);
}

function formatHoursStatus(hours: google.maps.places.OpeningHours): string {
  const isOpen = hours.isOpen();
  const jsDay = new Date().getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
  const todayText = hours.weekday_text?.[idx] ?? "";
  // Strip the day name prefix ("Monday: 9:00 AM – 10:00 PM" → "9:00 AM – 10:00 PM")
  const timeRange = todayText.replace(/^[^:]+:\s*/, "");

  const statusColor = isOpen ? "#16a34a" : "#dc2626";
  const statusLabel = isOpen ? "Open now" : "Closed";

  return `<div style="display:flex;align-items:baseline;gap:4px;margin-top:2px;">
    <span style="font-size:12px;font-weight:600;color:${statusColor};">${statusLabel}</span>
    ${timeRange ? `<span style="font-size:12px;color:#64748b;">· ${timeRange}</span>` : ""}
  </div>`;
}

const CLOSE_BTN = `<button onclick="window.__gmCloseIW&&window.__gmCloseIW()"
  style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;
         background:rgba(0,0,0,0.52);border:2px solid rgba(255,255,255,0.85);
         cursor:pointer;color:#fff;font-size:15px;line-height:22px;text-align:center;
         padding:0;font-weight:400;z-index:1;">&#x2715;</button>`;

function buildLoadingContent(name: string): string {
  return `
    <div style="width:268px;position:relative;padding:12px 42px 12px 14px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      ${CLOSE_BTN}
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">${name}</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">Loading preview…</p>
    </div>`;
}

function buildNameOnlyContent(name: string): string {
  return `
    <div style="width:268px;position:relative;padding:12px 42px 12px 14px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      ${CLOSE_BTN}
      <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">${name}</p>
    </div>`;
}

function buildRichContent(place: google.maps.places.PlaceResult): string {
  const name = place.name ?? "";
  const rating = place.rating;
  const reviews = place.user_ratings_total;
  const price = place.price_level != null ? "$".repeat(place.price_level) : "";
  const type = formatType(place.types ?? []);
  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 292, maxHeight: 120 });
  const address = place.formatted_address ?? place.vicinity ?? "";
  const summary = (place as any).editorial_summary?.overview ?? "";
  const hours = place.opening_hours;

  const photoSection = photoUrl
    ? `<div style="position:relative;">
        <img src="${photoUrl}" style="display:block;width:100%;height:128px;object-fit:cover;" />
        ${CLOSE_BTN}
       </div>`
    : "";

  const ratingLine = rating != null
    ? `<p style="margin:0 0 2px;font-size:12px;line-height:1.4;">
        ${buildStars(rating)}
        <span style="color:#1e293b;font-weight:600;margin-left:3px;">${rating.toFixed(1)}</span>
        ${reviews != null ? `<span style="color:#64748b;"> (${reviews.toLocaleString()})</span>` : ""}
        ${price ? `<span style="color:#64748b;"> · ${price}</span>` : ""}
       </p>`
    : "";

  const typeLine = type
    ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;">${type}</p>`
    : `<div style="margin-bottom:6px;"></div>`;

  const divider = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0;">`;

  const summaryBlock = summary
    ? `<p style="margin:0 0 5px;font-size:12px;color:#475569;line-height:1.45;font-style:italic;">${summary}</p>`
    : "";

  const addressBlock = address
    ? `<p style="margin:0 0 4px;font-size:12px;color:#475569;line-height:1.4;">${address}</p>`
    : "";

  const hoursBlock = hours ? formatHoursStatus(hours) : "";

  const hasExtra = summaryBlock || addressBlock || hoursBlock;

  /* When there is no photo, leave room for the close button in the header */
  const nameRow = photoUrl
    ? `<p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;">${name}</p>`
    : `<div style="position:relative;padding-right:32px;">
        ${CLOSE_BTN}
        <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;">${name}</p>
       </div>`;

  return `
    <div style="width:280px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;">
      ${photoSection}
      <div style="padding:10px 14px 10px;">
        ${nameRow}
        ${ratingLine}
        ${typeLine}
        ${hasExtra ? divider : ""}
        ${summaryBlock}
        ${addressBlock}
        ${hoursBlock}
      </div>
    </div>`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MapPanel({ activeLocations, legs, isMockMode, onApiFailure, selectedLocationId, onSelectLocation }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Leaflet references
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const leafletPolylinesRef = useRef<L.Polyline[]>([]);

  // Google Maps references
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const placesCacheRef = useRef<Map<string, google.maps.places.PlaceResult>>(new Map());
  const pinnedMarkerRef = useRef<string | null>(null);
  const markerMapRef = useRef<Map<string, { loc: Location; marker: google.maps.Marker }>>(new Map());
  const showPreviewFnRef = useRef<((loc: Location, marker: google.maps.Marker) => void) | null>(null);
  const onSelectLocationRef = useRef(onSelectLocation);
  // Keep the ref current on every render so event listeners never go stale
  onSelectLocationRef.current = onSelectLocation;

  useEffect(() => {
    if (!isMockMode) {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      loadGoogleMaps(apiKey)
        .then(() => setGoogleMapsLoaded(true))
        .catch(() => {
          setMapError("Google Maps failed to load. Switching to offline map.");
          onApiFailure();
        });
    }
  }, [isMockMode, onApiFailure]);

  // Setup Leaflet map (mock mode or after API failure)
  useEffect(() => {
    if (!isMockMode || !containerRef.current) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(containerRef.current).setView([37.7749, -122.4194], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;

    leafletMarkersRef.current.forEach(m => m.remove());
    leafletPolylinesRef.current.forEach(p => p.remove());
    leafletMarkersRef.current = [];
    leafletPolylinesRef.current = [];

    if (activeLocations.length === 0) return;

    const bounds = L.latLngBounds([]);

    activeLocations.forEach((loc, i) => {
      if (loc.latitude != null && loc.longitude != null) {
        const icon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color:#2563eb;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindTooltip(loc.name);
        leafletMarkersRef.current.push(marker);
        bounds.extend([loc.latitude, loc.longitude]);
      }
    });

    for (let i = 0; i < activeLocations.length - 1; i++) {
      const from = activeLocations[i];
      const to = activeLocations[i + 1];
      if (from.latitude != null && from.longitude != null && to.latitude != null && to.longitude != null) {
        const polyline = L.polyline(
          [[from.latitude, from.longitude], [to.latitude, to.longitude]],
          { color: '#2563eb', weight: 4, dashArray: '8, 8', opacity: 0.7 },
        ).addTo(map);
        leafletPolylinesRef.current.push(polyline);
      }
    }

    if (bounds.isValid() && activeLocations.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (activeLocations.length === 1 && activeLocations[0].latitude && activeLocations[0].longitude) {
      map.setView([activeLocations[0].latitude, activeLocations[0].longitude], 15);
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [isMockMode, activeLocations, legs]);

  // Setup Google Map
  useEffect(() => {
    if (isMockMode || !googleMapsLoaded || !containerRef.current || !window.google) return;

    if (!googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(containerRef.current, {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    const map = googleMapRef.current;

    googleMarkersRef.current.forEach(m => m.setMap(null));
    googlePolylinesRef.current.forEach(p => p.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current = [];

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    if (activeLocations.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: true });
    }
    const infoWindow = infoWindowRef.current;

    // Expose a global so the custom X button embedded in card HTML can close and unpin
    (window as any).__gmCloseIW = () => {
      infoWindow.close();
      pinnedMarkerRef.current = null;
      onSelectLocationRef.current?.(null);
    };

    if (!placesServiceRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(map);
    }
    const placesService = placesServiceRef.current;
    const cache = placesCacheRef.current;

    // Reset marker map for this render cycle
    markerMapRef.current = new Map();

    // Shared helper: fetch & display the rich preview for a location
    function showPreview(loc: typeof activeLocations[number], marker: google.maps.Marker) {
      const cacheKey = loc.id;
      const cached = cache.get(cacheKey);
      if (cached) {
        infoWindow.setContent(buildRichContent(cached));
        infoWindow.open(map, marker);
        return;
      }

      infoWindow.setContent(buildLoadingContent(loc.name));
      infoWindow.open(map, marker);

      placesService.textSearch(
        { query: loc.name, location: { lat: loc.latitude!, lng: loc.longitude! }, radius: 300 },
        (results, textStatus) => {
          const placeId = results?.[0]?.place_id;
          if (textStatus !== google.maps.places.PlacesServiceStatus.OK || !placeId) {
            infoWindow.setContent(buildNameOnlyContent(loc.name));
            return;
          }
          placesService.getDetails(
            {
              placeId,
              fields: [
                "name", "rating", "user_ratings_total", "photos",
                "types", "price_level", "formatted_address",
                "editorial_summary", "opening_hours",
              ],
            },
            (place, detailStatus) => {
              if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place) {
                cache.set(cacheKey, place);
                infoWindow.setContent(buildRichContent(place));
              } else {
                cache.set(cacheKey, results![0]);
                infoWindow.setContent(buildRichContent(results![0]));
              }
            }
          );
        }
      );
    }
    // Store reference so the selection effect can invoke it
    showPreviewFnRef.current = showPreview;

    activeLocations.forEach((loc, i) => {
      if (loc.latitude != null && loc.longitude != null) {
        const marker = new google.maps.Marker({
          position: { lat: loc.latitude, lng: loc.longitude },
          map,
          title: loc.name,
          label: {
            text: (i + 1).toString(),
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
            scale: 14,
          },
        });

        // Hover: only show when nothing is pinned
        marker.addListener("mouseover", () => {
          if (pinnedMarkerRef.current !== null) return;
          showPreview(loc, marker);
        });

        marker.addListener("mouseout", () => {
          if (pinnedMarkerRef.current !== null) return;
          infoWindow.close();
        });

        // Click: toggle pin on this marker and notify parent for list highlighting
        marker.addListener("click", () => {
          if (pinnedMarkerRef.current === loc.id) {
            pinnedMarkerRef.current = null;
            infoWindow.close();
            onSelectLocationRef.current?.(null);
          } else {
            pinnedMarkerRef.current = loc.id;
            showPreview(loc, marker);
            onSelectLocationRef.current?.(loc.id);
          }
        });

        markerMapRef.current.set(loc.id, { loc, marker });
        googleMarkersRef.current.push(marker);
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      }
    });

    if (activeLocations.length > 1) {
      const origin = activeLocations[0];
      const destination = activeLocations[activeLocations.length - 1];
      const waypoints = activeLocations
        .slice(1, activeLocations.length - 1)
        .filter(l => l.latitude != null && l.longitude != null)
        .map(l => ({ location: { lat: l.latitude!, lng: l.longitude! }, stopover: true }));

      if (origin.latitude != null && destination.latitude != null) {
        const directionsService = new google.maps.DirectionsService();
        const renderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeOpacity: 0.8,
            strokeWeight: 5,
          },
        });
        directionsRendererRef.current = renderer;

        directionsService.route(
          {
            origin: { lat: origin.latitude, lng: origin.longitude! },
            destination: { lat: destination.latitude, lng: destination.longitude! },
            waypoints,
            travelMode: google.maps.TravelMode.WALKING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              renderer.setDirections(result);
            } else {
              renderer.setMap(null);
              directionsRendererRef.current = null;
              for (let i = 0; i < activeLocations.length - 1; i++) {
                const from = activeLocations[i];
                const to = activeLocations[i + 1];
                if (from.latitude != null && to.latitude != null) {
                  const polyline = new google.maps.Polyline({
                    path: [
                      { lat: from.latitude, lng: from.longitude! },
                      { lat: to.latitude, lng: to.longitude! },
                    ],
                    map,
                    strokeColor: "#2563eb",
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                  });
                  googlePolylinesRef.current.push(polyline);
                }
              }
            }
          },
        );
      }
    }

    if (activeLocations.length > 1) {
      map.fitBounds(bounds, 50);
    } else if (activeLocations.length === 1 && activeLocations[0].latitude) {
      map.setCenter({ lat: activeLocations[0].latitude, lng: activeLocations[0].longitude! });
      map.setZoom(15);
    }
  }, [isMockMode, googleMapsLoaded, activeLocations, legs]);

  // When the list selects a location, open its InfoWindow on the map
  useEffect(() => {
    if (!googleMapsLoaded) return;
    const infoWindow = infoWindowRef.current;
    const map = googleMapRef.current;
    if (!infoWindow || !map) return;

    if (!selectedLocationId) {
      if (pinnedMarkerRef.current) {
        infoWindow.close();
        pinnedMarkerRef.current = null;
      }
      return;
    }

    // Already pinned here — no need to re-open
    if (pinnedMarkerRef.current === selectedLocationId) return;

    const entry = markerMapRef.current.get(selectedLocationId);
    if (!entry) return;

    pinnedMarkerRef.current = selectedLocationId;
    showPreviewFnRef.current?.(entry.loc, entry.marker);
  }, [selectedLocationId, googleMapsLoaded]);

  if (mapError && !isMockMode) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground p-8 text-center">
        <p>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {activeLocations.length < 2 && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-8 text-center">
          <div className="bg-background/80 backdrop-blur-sm border border-border text-foreground px-6 py-4 rounded-lg shadow-sm">
            <p className="font-medium">Add at least two locations to see your route on the map.</p>
          </div>
        </div>
      )}

      {isMockMode && (
        <div className="absolute top-4 right-4 z-[400] bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm uppercase tracking-wider">
          Offline Map
        </div>
      )}

      <div ref={containerRef} id="google-map" className="w-full h-full bg-muted" />
    </div>
  );
}
