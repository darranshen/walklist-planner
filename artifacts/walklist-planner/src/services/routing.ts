import { Location, LegTransitStep, TransitMode, RouteLeg } from '../types/route';
import { getHaversineDistance } from '../lib/haversine';

export interface OptimizableLocation {
  latitude: number | null;
  longitude: number | null;
}

export function totalHaversineDistance<T extends OptimizableLocation>(locations: T[]): number {
  let total = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    const a = locations[i], b = locations[i + 1];
    if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
      total += getHaversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    }
  }
  return total;
}

function nearestNeighborOrder<T extends OptimizableLocation>(locations: T[]): T[] {
  if (locations.length <= 2) return locations;
  const unvisited = [...locations];
  const result: T[] = [unvisited.shift()!];
  while (unvisited.length > 0) {
    const current = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const loc = unvisited[i];
      if (
        current.latitude == null || current.longitude == null ||
        loc.latitude == null || loc.longitude == null
      ) continue;
      const dist = getHaversineDistance(current.latitude, current.longitude, loc.latitude, loc.longitude);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    }
    result.push(unvisited.splice(nearestIdx, 1)[0]);
  }
  return result;
}

function bestNearestNeighborOrder<T extends OptimizableLocation>(locations: T[]): T[] {
  if (locations.length <= 2) return locations;
  let best = nearestNeighborOrder(locations);
  let bestDist = totalHaversineDistance(best);
  for (let start = 1; start < Math.min(locations.length, 8); start++) {
    const rotated = [locations[start], ...locations.slice(0, start), ...locations.slice(start + 1)];
    const result = nearestNeighborOrder(rotated);
    const dist = totalHaversineDistance(result);
    if (dist < bestDist) { bestDist = dist; best = result; }
  }
  return best;
}

function nearestNeighborFrom<T extends OptimizableLocation>(anchor: T, locations: T[]): T[] {
  const unvisited = [...locations];
  const result: T[] = [];
  let current = anchor;
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const loc = unvisited[i];
      if (
        current.latitude == null || current.longitude == null ||
        loc.latitude == null || loc.longitude == null
      ) continue;
      const dist = getHaversineDistance(current.latitude, current.longitude, loc.latitude, loc.longitude);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    result.push(next);
    current = next;
  }
  return result;
}

export function optimizeLocationsOrder<T extends OptimizableLocation & { locked?: boolean }>(
  locations: T[],
): T[] {
  if (locations.length <= 2) return locations;
  const hasCoords = locations.every(l => l.latitude != null && l.longitude != null);
  if (!hasCoords) return locations;

  const hasLocked = locations.some(l => l.locked);
  if (!hasLocked) return bestNearestNeighborOrder(locations);

  // Optimize each segment of unlocked stops between locked anchors
  const result: T[] = [];
  let pending: T[] = [];

  for (const loc of locations) {
    if (loc.locked) {
      if (pending.length > 0) {
        const anchor = result.length > 0 ? result[result.length - 1] : null;
        const optimized = anchor ? nearestNeighborFrom(anchor, pending) : bestNearestNeighborOrder(pending);
        result.push(...optimized);
        pending = [];
      }
      result.push(loc);
    } else {
      pending.push(loc);
    }
  }

  // Trailing unlocked segment
  if (pending.length > 0) {
    const anchor = result.length > 0 ? result[result.length - 1] : null;
    const optimized = anchor ? nearestNeighborFrom(anchor, pending) : bestNearestNeighborOrder(pending);
    result.push(...optimized);
  }

  return result;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stepInstruction(step: any): string {
  return stripHtml(step.instructions || step.html_instructions || '');
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
    const mode: string = (step.travel_mode || '').toString().toUpperCase();
    const instruction = stepInstruction(step);
    const isTransit = mode !== 'WALKING';
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

const LONG_WALK_THRESHOLD_MINUTES = 90;

function haversineLeg(from: Location, to: Location, index: number): RouteLeg {
  const distanceMeters =
    from.latitude != null && from.longitude != null && to.latitude != null && to.longitude != null
      ? getHaversineDistance(from.latitude, from.longitude, to.latitude, to.longitude)
      : 0;
  return {
    id: `leg-${from.id}-${to.id}`,
    fromLocationId: from.id,
    toLocationId: to.id,
    orderIndex: index,
    walkingMinutes: Math.round(distanceMeters / 80),
    distanceMeters,
  };
}

async function routeSingleLeg(
  directionsService: google.maps.DirectionsService,
  from: Location,
  to: Location,
  index: number,
): Promise<RouteLeg> {
  try {
    const result = await directionsService.route({
      origin: { lat: from.latitude!, lng: from.longitude! },
      destination: { lat: to.latitude!, lng: to.longitude! },
      travelMode: window.google.maps.TravelMode.WALKING,
    });

    const leg = result.routes[0]?.legs[0];
    if (!leg) throw new Error('No leg in result');

    const transitSteps = extractTransitSteps(leg.steps || []);
    const walkingMinutes = Math.round((leg.duration?.value || 0) / 60);

    console.log(`[routing] leg ${index} steps:`, (leg.steps || []).map((s: any) => ({
      mode: (s.travel_mode || '').toString(),
      instruction: stepInstruction(s),
    })));

    const isUnreasonablyLong = walkingMinutes > LONG_WALK_THRESHOLD_MINUTES && transitSteps.length === 0;

    return {
      id: `leg-${from.id}-${to.id}`,
      fromLocationId: from.id,
      toLocationId: to.id,
      orderIndex: index,
      walkingMinutes,
      distanceMeters: leg.distance?.value || 0,
      transitSteps: transitSteps.length > 0 ? transitSteps : undefined,
      routeError: isUnreasonablyLong
        ? 'This is a very long walking leg. A ferry, train, or other transit may be needed.'
        : undefined,
    };
  } catch (e) {
    console.warn(`[routing] leg ${index} (${from.name} → ${to.name}) has no walking route:`, e);
    return {
      ...haversineLeg(from, to, index),
      routeError: 'No walking route found. This leg may require a ferry or other transit.',
    };
  }
}

export async function calculateRoute(
  locations: Location[],
  isMockMode: boolean
): Promise<RouteLeg[]> {
  if (locations.length < 2) return [];

  if (isMockMode) {
    const legs: RouteLeg[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      legs.push(haversineLeg(locations[i], locations[i + 1], i));
    }
    return legs;
  }

  if (!window.google || !window.google.maps) {
    throw new Error('Google Maps not loaded');
  }

  const directionsService = new window.google.maps.DirectionsService();

  if (locations.length <= 10) {
    try {
      const origin = locations[0];
      const destination = locations[locations.length - 1];
      const waypoints = locations.slice(1, locations.length - 1).map(loc => ({
        location: { lat: loc.latitude!, lng: loc.longitude! },
        stopover: true,
      }));

      const result = await directionsService.route({
        origin: { lat: origin.latitude!, lng: origin.longitude! },
        destination: { lat: destination.latitude!, lng: destination.longitude! },
        waypoints,
        travelMode: window.google.maps.TravelMode.WALKING,
      });

      const route = result.routes[0];
      if (route?.legs) {
        const legs: RouteLeg[] = [];
        for (let i = 0; i < route.legs.length; i++) {
          const leg = route.legs[i];
          const from = locations[i];
          const to = locations[i + 1];
          const transitSteps = extractTransitSteps(leg.steps || []);
          const walkingMinutes = Math.round((leg.duration?.value || 0) / 60);
          const isUnreasonablyLong = walkingMinutes > LONG_WALK_THRESHOLD_MINUTES && transitSteps.length === 0;

          console.log(`[routing] full-route leg ${i} (${walkingMinutes}min):`, (leg.steps || []).map((s: any) => ({
            mode: (s.travel_mode || '').toString(),
            instruction: stepInstruction(s),
          })));

          legs.push({
            id: `leg-${from.id}-${to.id}`,
            fromLocationId: from.id,
            toLocationId: to.id,
            orderIndex: i,
            walkingMinutes,
            distanceMeters: leg.distance?.value || 0,
            transitSteps: transitSteps.length > 0 ? transitSteps : undefined,
            routeError: isUnreasonablyLong
              ? 'This is a very long walking leg. A ferry, train, or other transit may be needed.'
              : undefined,
          });
        }
        return legs;
      }
    } catch (fullRouteErr) {
      console.warn('[routing] Full-route request failed, trying legs individually:', fullRouteErr);
    }
  }

  const legs: RouteLeg[] = [];
  for (let i = 0; i < locations.length - 1; i++) {
    const leg = await routeSingleLeg(directionsService, locations[i], locations[i + 1], i);
    legs.push(leg);
  }
  return legs;
}
