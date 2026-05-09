import { useState, useEffect, useCallback, useRef } from 'react';
import { RouteState, Location } from '../types/route';
import { sampleRouteState } from '../data/sampleRoute';
import { calculateRoute } from '../services/routing';

const STORAGE_KEY = 'walklist-route-state';
const ROUTE_DEBOUNCE_MS = 400;

function emptyState(isMockMode: boolean): RouteState {
  return {
    plan: {
      id: crypto.randomUUID(),
      name: 'New WalkList',
      sourceListUrl: '',
      activeLocationIds: [],
      removedLocationIds: [],
      totalWalkingMinutes: 0,
      totalDistanceMeters: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    locations: {},
    legs: [],
    isMockMode,
    routeWarning: null,
  };
}

export function useRouteState() {
  const [state, setState] = useState<RouteState | null>(null);
  const isInitialMount = useRef(true);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const hasApiKey = !!import.meta.env.VITE_GOOGLE_API_KEY;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RouteState;
        parsed.isMockMode = !hasApiKey;
        parsed.routeWarning = parsed.routeWarning ?? null;
        setState(parsed);
        // Always recalculate on load so transit/error detection is fresh
        if (parsed.plan.activeLocationIds.length >= 2) {
          scheduleRouteUpdate(parsed.plan.activeLocationIds, parsed.locations, !hasApiKey);
        }
      } catch (e) {
        setState(emptyState(!hasApiKey));
      }
    } else {
      if (!hasApiKey) {
        setState(sampleRouteState);
      } else {
        setState(emptyState(false));
      }
    }
  }, []);

  // Persist with debounce
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (state) {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }, 300);
    }

    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [state]);

  const scheduleRouteUpdate = (
    activeIds: string[],
    locs: Record<string, Location>,
    isMockMode: boolean,
  ) => {
    if (routeDebounceRef.current) clearTimeout(routeDebounceRef.current);
    routeDebounceRef.current = setTimeout(
      () => updateRouteTotals(activeIds, locs, isMockMode),
      ROUTE_DEBOUNCE_MS,
    );
  };

  const updateRouteTotals = async (
    activeIds: string[],
    locs: Record<string, Location>,
    isMockMode: boolean,
  ) => {
    const activeLocs = activeIds.map(id => locs[id]).filter(Boolean);

    try {
      const legs = await calculateRoute(activeLocs, isMockMode);
      const totalTime = legs.reduce((sum, leg) => sum + leg.walkingMinutes, 0);
      const totalDist = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);

      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          legs,
          routeWarning: null,
          plan: {
            ...prev.plan,
            totalWalkingMinutes: totalTime,
            totalDistanceMeters: totalDist,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    } catch (e) {
      // Google Directions API failed — fall back to haversine mock estimates
      console.warn('Route calculation failed, falling back to mock estimates:', e);
      try {
        const mockLegs = await calculateRoute(activeLocs, true);
        const totalTime = mockLegs.reduce((sum, leg) => sum + leg.walkingMinutes, 0);
        const totalDist = mockLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);

        setState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            isMockMode: true,
            legs: mockLegs,
            routeWarning:
              'Live walking directions are unavailable. Showing estimated straight-line times.',
            plan: {
              ...prev.plan,
              totalWalkingMinutes: totalTime,
              totalDistanceMeters: totalDist,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      } catch (fallbackErr) {
        console.error('Fallback route calculation also failed:', fallbackErr);
      }
    }
  };

  const addLocation = useCallback((
    location: Omit<Location, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newLocation: Location = {
      ...location,
      id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    setState(prev => {
      if (!prev) return prev;
      const newLocs: Record<string, Location> = { ...prev.locations, [id]: newLocation };
      const newActiveIds = [...prev.plan.activeLocationIds, id];

      scheduleRouteUpdate(newActiveIds, newLocs, prev.isMockMode);

      return {
        ...prev,
        locations: newLocs,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          updatedAt: now,
        },
      };
    });
  }, []);

  const removeLocation = useCallback((id: string) => {
    setState(prev => {
      if (!prev) return prev;

      const now = new Date().toISOString();
      const updated: Location = { ...prev.locations[id], status: 'removed', updatedAt: now };
      const newLocs: Record<string, Location> = { ...prev.locations, [id]: updated };
      const newActiveIds = prev.plan.activeLocationIds.filter(locId => locId !== id);
      const newRemovedIds = [...prev.plan.removedLocationIds, id];

      scheduleRouteUpdate(newActiveIds, newLocs, prev.isMockMode);

      return {
        ...prev,
        locations: newLocs,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          removedLocationIds: newRemovedIds,
          updatedAt: now,
        },
      };
    });
  }, []);

  const restoreLocation = useCallback((id: string) => {
    setState(prev => {
      if (!prev) return prev;

      const now = new Date().toISOString();
      const updated: Location = { ...prev.locations[id], status: 'active', updatedAt: now };
      const newLocs: Record<string, Location> = { ...prev.locations, [id]: updated };
      const newRemovedIds = prev.plan.removedLocationIds.filter(locId => locId !== id);
      const newActiveIds = [...prev.plan.activeLocationIds, id];

      scheduleRouteUpdate(newActiveIds, newLocs, prev.isMockMode);

      return {
        ...prev,
        locations: newLocs,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          removedLocationIds: newRemovedIds,
          updatedAt: now,
        },
      };
    });
  }, []);

  const moveLocationUp = useCallback((index: number) => {
    setState(prev => {
      if (!prev || index <= 0) return prev;
      const newActiveIds = [...prev.plan.activeLocationIds];
      [newActiveIds[index - 1], newActiveIds[index]] = [newActiveIds[index], newActiveIds[index - 1]];

      scheduleRouteUpdate(newActiveIds, prev.locations, prev.isMockMode);

      return {
        ...prev,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const moveLocationDown = useCallback((index: number) => {
    setState(prev => {
      if (!prev || index >= prev.plan.activeLocationIds.length - 1) return prev;
      const newActiveIds = [...prev.plan.activeLocationIds];
      [newActiveIds[index + 1], newActiveIds[index]] = [newActiveIds[index], newActiveIds[index + 1]];

      scheduleRouteUpdate(newActiveIds, prev.locations, prev.isMockMode);

      return {
        ...prev,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const loadSampleRoute = useCallback(() => {
    setState({
      ...sampleRouteState,
      isMockMode: !import.meta.env.VITE_GOOGLE_API_KEY,
      routeWarning: null,
    });
  }, []);

  const updateSourceUrl = useCallback((url: string) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: {
          ...prev.plan,
          sourceListUrl: url,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState(emptyState(!import.meta.env.VITE_GOOGLE_API_KEY));
  }, []);

  const setMockMode = useCallback((isMock: boolean) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        isMockMode: isMock,
        routeWarning: isMock
          ? 'Google Maps failed to load. Using the offline map with estimated walking times.'
          : null,
      };
    });
  }, []);

  const bulkAddLocations = useCallback((
    incoming: Array<Omit<Location, 'id' | 'status' | 'createdAt' | 'updatedAt'>>,
  ) => {
    if (!incoming.length) return;
    const now = new Date().toISOString();
    const newEntries: [string, Location][] = incoming.map(loc => {
      const id = crypto.randomUUID();
      return [id, { ...loc, id, status: 'active' as const, createdAt: now, updatedAt: now }];
    });

    setState(prev => {
      if (!prev) return prev;
      const newLocs: Record<string, Location> = { ...prev.locations };
      const addedIds: string[] = [];
      for (const [id, loc] of newEntries) {
        newLocs[id] = loc;
        addedIds.push(id);
      }
      const newActiveIds = [...prev.plan.activeLocationIds, ...addedIds];
      scheduleRouteUpdate(newActiveIds, newLocs, prev.isMockMode);
      return {
        ...prev,
        locations: newLocs,
        plan: { ...prev.plan, activeLocationIds: newActiveIds, updatedAt: now },
      };
    });
  }, []);

  const reorderLocations = useCallback((newActiveIds: string[]) => {
    setState(prev => {
      if (!prev) return prev;
      scheduleRouteUpdate(newActiveIds, prev.locations, prev.isMockMode);
      return {
        ...prev,
        plan: {
          ...prev.plan,
          activeLocationIds: newActiveIds,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const bulkReplaceLocations = useCallback((
    incoming: Array<Omit<Location, 'id' | 'status' | 'createdAt' | 'updatedAt'>>,
  ) => {
    if (!incoming.length) return;
    const now = new Date().toISOString();
    const newEntries: [string, Location][] = incoming.map(loc => {
      const id = crypto.randomUUID();
      return [id, { ...loc, id, status: 'active' as const, createdAt: now, updatedAt: now }];
    });

    setState(prev => {
      if (!prev) return prev;
      const newLocs: Record<string, Location> = {};
      const addedIds: string[] = [];
      for (const [id, loc] of newEntries) {
        newLocs[id] = loc;
        addedIds.push(id);
      }
      scheduleRouteUpdate(addedIds, newLocs, prev.isMockMode);
      return {
        ...prev,
        locations: newLocs,
        legs: [],
        plan: {
          ...prev.plan,
          activeLocationIds: addedIds,
          removedLocationIds: [],
          totalWalkingMinutes: 0,
          totalDistanceMeters: 0,
          updatedAt: now,
        },
      };
    });
  }, []);

  const toggleLockLocation = useCallback((id: string) => {
    setState(prev => {
      if (!prev) return prev;
      const loc = prev.locations[id];
      if (!loc) return prev;
      return {
        ...prev,
        locations: {
          ...prev.locations,
          [id]: { ...loc, locked: !loc.locked, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const dismissRouteWarning = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, routeWarning: null };
    });
  }, []);

  return {
    state,
    actions: {
      addLocation,
      bulkAddLocations,
      bulkReplaceLocations,
      reorderLocations,
      removeLocation,
      restoreLocation,
      moveLocationUp,
      moveLocationDown,
      loadSampleRoute,
      updateSourceUrl,
      clearAll,
      setMockMode,
      toggleLockLocation,
      dismissRouteWarning,
    },
  };
}
