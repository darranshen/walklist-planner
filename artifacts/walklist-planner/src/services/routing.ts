import { Location } from '../types/route';
import { getHaversineDistance } from '../lib/haversine';
import { RouteLeg } from '../types/route';

export async function calculateRoute(
  locations: Location[],
  isMockMode: boolean
): Promise<RouteLeg[]> {
  if (locations.length < 2) return [];

  if (isMockMode) {
    const legs: RouteLeg[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      const from = locations[i];
      const to = locations[i + 1];

      let distanceMeters = 0;
      let walkingMinutes = 0;

      if (from.latitude != null && from.longitude != null && to.latitude != null && to.longitude != null) {
        distanceMeters = getHaversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        // 4.8 km/h = 80 m/min
        walkingMinutes = Math.round(distanceMeters / 80);
      }

      legs.push({
        id: `leg-${from.id}-${to.id}`,
        fromLocationId: from.id,
        toLocationId: to.id,
        orderIndex: i,
        walkingMinutes,
        distanceMeters,
      });
    }
    return legs;
  } else {
    // Call Google Directions API
    if (!window.google || !window.google.maps) {
      throw new Error("Google Maps not loaded");
    }

    const directionsService = new window.google.maps.DirectionsService();

    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1, locations.length - 1).map(loc => ({
      location: { lat: loc.latitude!, lng: loc.longitude! },
      stopover: true,
    }));

    try {
      const result = await directionsService.route({
        origin: { lat: origin.latitude!, lng: origin.longitude! },
        destination: { lat: destination.latitude!, lng: destination.longitude! },
        waypoints,
        travelMode: window.google.maps.TravelMode.WALKING,
      });

      const legs: RouteLeg[] = [];
      const route = result.routes[0];
      
      if (route && route.legs) {
        for (let i = 0; i < route.legs.length; i++) {
          const leg = route.legs[i];
          const from = locations[i];
          const to = locations[i + 1];
          legs.push({
            id: `leg-${from.id}-${to.id}`,
            fromLocationId: from.id,
            toLocationId: to.id,
            orderIndex: i,
            walkingMinutes: Math.round((leg.duration?.value || 0) / 60),
            distanceMeters: leg.distance?.value || 0,
            // Approximate polyline from Google Maps Directions API can be pulled from route overview_polyline or legs steps
          });
        }
      }
      return legs;
    } catch (e) {
      console.error("Directions API failed:", e);
      throw e;
    }
  }
}
