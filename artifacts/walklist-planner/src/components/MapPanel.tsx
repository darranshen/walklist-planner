import { useEffect, useRef, useState } from "react";
import { Location, RouteLeg } from "../types/route";
import { loadGoogleMaps } from "../services/googleMaps";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPanelProps {
  activeLocations: Location[];
  legs: RouteLeg[];
  isMockMode: boolean;
}

export function MapPanel({ activeLocations, legs, isMockMode }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leaflet references
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const leafletPolylinesRef = useRef<L.Polyline[]>([]);

  // Google Maps references
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePolylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!isMockMode) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      loadGoogleMaps(apiKey)
        .then(() => setGoogleMapsLoaded(true))
        .catch((err) => setError("The map could not load. Check the map API key and try again."));
    }
  }, [isMockMode]);

  // Setup Leaflet map
  useEffect(() => {
    if (!isMockMode || !containerRef.current) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(containerRef.current).setView([37.7749, -122.4194], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;

    // Cleanup old markers/lines
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
          html: `<div style="background-color: hsl(221.2 83.2% 53.3%); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindTooltip(loc.name);
        leafletMarkersRef.current.push(marker);
        bounds.extend([loc.latitude, loc.longitude]);
      }
    });

    // Draw straight lines for mock mode
    for (let i = 0; i < activeLocations.length - 1; i++) {
      const from = activeLocations[i];
      const to = activeLocations[i + 1];
      if (from.latitude != null && from.longitude != null && to.latitude != null && to.longitude != null) {
        const polyline = L.polyline(
          [[from.latitude, from.longitude], [to.latitude, to.longitude]], 
          { color: 'hsl(221.2 83.2% 53.3%)', weight: 4, dashArray: '8, 8', opacity: 0.7 }
        ).addTo(map);
        leafletPolylinesRef.current.push(polyline);
      }
    }

    if (bounds.isValid() && activeLocations.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (activeLocations.length === 1 && activeLocations[0].latitude && activeLocations[0].longitude) {
      map.setView([activeLocations[0].latitude, activeLocations[0].longitude], 15);
    }

  }, [isMockMode, activeLocations, legs]);

  // Setup Google Map
  useEffect(() => {
    if (isMockMode || !googleMapsLoaded || !containerRef.current || !window.google) return;

    if (!googleMapRef.current) {
      googleMapRef.current = new window.google.maps.Map(containerRef.current, {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    const map = googleMapRef.current;

    // Cleanup
    googleMarkersRef.current.forEach(m => m.setMap(null));
    googlePolylinesRef.current.forEach(p => p.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current = [];

    if (activeLocations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    activeLocations.forEach((loc, i) => {
      if (loc.latitude != null && loc.longitude != null) {
        // Use custom marker via standard Marker with icon URL or SVG
        const marker = new window.google.maps.Marker({
          position: { lat: loc.latitude, lng: loc.longitude },
          map,
          title: loc.name,
          label: {
            text: (i + 1).toString(),
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
            scale: 14,
          }
        });
        googleMarkersRef.current.push(marker);
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      }
    });

    // Draw route using DirectionsService if available in legs, or fallback straight lines
    if (activeLocations.length > 1) {
      const directionsService = new window.google.maps.DirectionsService();
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#2563eb", // primary blue
          strokeOpacity: 0.8,
          strokeWeight: 5,
        }
      });
      
      // Store to clean up later
      (directionsRenderer as any).isManaged = true;
      
      const origin = activeLocations[0];
      const destination = activeLocations[activeLocations.length - 1];
      const waypoints = activeLocations.slice(1, activeLocations.length - 1)
        .filter(l => l.latitude != null && l.longitude != null)
        .map(l => ({ location: { lat: l.latitude!, lng: l.longitude! }, stopover: true }));

      if (origin.latitude != null && destination.latitude != null) {
        directionsService.route({
          origin: { lat: origin.latitude, lng: origin.longitude! },
          destination: { lat: destination.latitude, lng: destination.longitude! },
          waypoints,
          travelMode: window.google.maps.TravelMode.WALKING,
        }, (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
          } else {
            // Draw straight lines fallback
            for (let i = 0; i < activeLocations.length - 1; i++) {
              const from = activeLocations[i];
              const to = activeLocations[i + 1];
              if (from.latitude != null && to.latitude != null) {
                const polyline = new window.google.maps.Polyline({
                  path: [
                    { lat: from.latitude, lng: from.longitude! },
                    { lat: to.latitude, lng: to.longitude! }
                  ],
                  map,
                  strokeColor: "#2563eb",
                  strokeOpacity: 0.8,
                  strokeWeight: 4
                });
                googlePolylinesRef.current.push(polyline);
              }
            }
          }
        });
      }
    }

    if (activeLocations.length > 1) {
      map.fitBounds(bounds, 50);
    } else if (activeLocations.length === 1 && activeLocations[0].latitude) {
      map.setCenter({ lat: activeLocations[0].latitude, lng: activeLocations[0].longitude! });
      map.setZoom(15);
    }

    return () => {
      // Custom cleanup for directions renderer if needed
    };

  }, [isMockMode, googleMapsLoaded, activeLocations, legs]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground p-8 text-center">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {activeLocations.length < 2 && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-8 text-center">
          <div className="bg-background/80 backdrop-blur-sm border border-border text-foreground px-6 py-4 rounded-lg shadow-sm">
            <p className="font-medium">Add locations to see your route on the map.</p>
          </div>
        </div>
      )}
      
      {isMockMode && (
        <div className="absolute top-4 right-4 z-[400] bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm shadow-yellow-900/10 uppercase tracking-wider">
          Mock Mode
        </div>
      )}
      
      <div ref={containerRef} id="google-map" className="w-full h-full bg-muted" />
    </div>
  );
}
