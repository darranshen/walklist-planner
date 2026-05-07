export interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  placeId?: string;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
}

export interface RouteLeg {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  orderIndex: number;
  walkingMinutes: number;
  distanceMeters: number;
  polyline?: string;
}

export interface RoutePlan {
  id: string;
  name: string;
  sourceListUrl: string;
  activeLocationIds: string[];
  removedLocationIds: string[];
  totalWalkingMinutes: number;
  totalDistanceMeters: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteState {
  plan: RoutePlan;
  locations: Record<string, Location>;
  legs: RouteLeg[];
  isMockMode: boolean;
}
