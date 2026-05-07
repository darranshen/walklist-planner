import { Location, LegTransitStep, TransitMode } from '../types/route';
import { getHaversineDistance } from '../lib/haversine';
import { RouteLeg } from '../types/route';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function detectTransitMode(
  vehicleType: string | undefined,
  instruction: string,
): TransitMode {
  const v = (vehicleType || '').toUpperCase();
  const t = instruction.toLowerCase();

  if (v === 'FERRY' || t.includes('ferry')) return 'FERRY';
  if (v === 'SUBWAY' || v === 'METRO' || t.includes('subway') || t.includes('metro')) return 'SUBWAY';
  if (v === 'RAIL' || v === 'HEAVY_RAIL' || v === 'COMMUTER_TRAIN' || t.includes('train') || t.includes('rail')) return 'RAIL';
  if (v === 'BUS' || t.includes('bus')) return 'BUS';
  if (v === 'TRAM' || v === 'LIGHT_RAIL' || t.includes('tram') || t.includes('light rail')) return 'TRAM';
  return 'TRANSIT';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTransitSteps(steps: any[]): LegTransitStep[] {
  const result: LegTransitStep[] = [];
  for (const step of steps) {
    const mode: string = step.travel_mode || '';
    const instruction = stripHtml(step.html_instructions || '');
    const isTransit = mode.toUpperCase() !== 'WALKING';
    const isFerryInstruction = instruction.toLowerCase().includes('ferry');

    if (isTransit || isFerryInstruction) {
      const vehicleType: string | undefined =
        step.transit?.line?.vehicle?.type ||
        step.transit_details?.line?.vehicle?.type;

      result.push({
        mode: detectTransitMode(vehicleType, instruction),
        label: instruction || 'Take transit',
        durationMinutes: Math.round((step.duration?.value || 0) / 60),
        distanceMeters: step.distance?.value || 0,
      });
    }
  }
  return result;
}

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
          const transitSteps = extractTransitSteps(leg.steps || []);

          legs.push({
            id: `leg-${from.id}-${to.id}`,
            fromLocationId: from.id,
            toLocationId: to.id,
            orderIndex: i,
            walkingMinutes: Math.round((leg.duration?.value || 0) / 60),
            distanceMeters: leg.distance?.value || 0,
            transitSteps: transitSteps.length > 0 ? transitSteps : undefined,
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
