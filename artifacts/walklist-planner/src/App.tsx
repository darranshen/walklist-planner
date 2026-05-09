import { useState, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRouteState } from "./hooks/useRouteState";
import { optimizeLocationsOrder } from "./services/routing";
import { Location } from "./types/route";
import { X } from "lucide-react";

// Components
import { Header } from "./components/Header";
import { SourceUrlField } from "./components/SourceUrlField";
import { ActionButtons } from "./components/ActionButtons";
import { AddLocationModal } from "./components/AddLocationModal";
import { RouteList } from "./components/RouteList";
import type { OptimizeResult } from "./components/RouteList";
import { RemovedLocations } from "./components/RemovedLocations";
import { RouteSummary } from "./components/RouteSummary";
import { MapPanel } from "./components/MapPanel";
import { MockModeBanner } from "./components/MockModeBanner";
import { InfoBar } from "./components/InfoBar";

const queryClient = new QueryClient();

function WalkListApp() {
  const { state, actions } = useRouteState();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!state) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const activeLocations = state.plan.activeLocationIds.map(id => state.locations[id]).filter(Boolean);
  const removedLocations = state.plan.removedLocationIds.map(id => state.locations[id]).filter(Boolean);

  function scheduleResultDismiss() {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setOptimizeResult(null), 6000);
  }

  function showSuccess(message: string) {
    setOptimizeResult({ type: "success", message });
    scheduleResultDismiss();
  }

  function showError(message: string) {
    setOptimizeResult({ type: "error", message });
    scheduleResultDismiss();
  }

  function handleManualOptimize() {
    if (activeLocations.length < 2 || isOptimizing) return;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setIsOptimizing(true);
    setOptimizeResult(null);

    const prevIds = activeLocations.map((l: Location) => l.id);
    try {
      const optimized = optimizeLocationsOrder(activeLocations);
      const newIds = optimized.map((l: Location) => l.id);
      const changed = newIds.some((id, i) => id !== prevIds[i]);
      actions.reorderLocations(newIds);
      showSuccess(
        changed
          ? "Route reordered to minimize walking distance."
          : "Route is already in the optimal order."
      );
    } catch {
      actions.reorderLocations(prevIds);
      showError("Optimization failed. Your previous route order was kept.");
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <MockModeBanner isMockMode={state.isMockMode} />

      {state.routeWarning && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
          <span className="flex-1">{state.routeWarning}</span>
          <button
            onClick={actions.dismissRouteWarning}
            className="p-0.5 rounded hover:bg-amber-100 transition-colors flex-shrink-0"
            aria-label="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-full md:w-[400px] flex flex-col h-full border-r border-border bg-card z-10 shadow-sm flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 relative">
            <Header />
            <SourceUrlField
              initialUrl={state.plan.sourceListUrl}
              hasExistingLocations={
                state.plan.activeLocationIds.length > 0 ||
                state.plan.removedLocationIds.length > 0
              }
              onUpdate={actions.updateSourceUrl}
              onImport={(locs, keepExisting) => {
                if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                setIsOptimizing(true);
                setOptimizeResult(null);

                let optimizedLocs = locs;
                try {
                  optimizedLocs = optimizeLocationsOrder(locs);
                } catch {
                  // fall through with original order
                }

                const mapped = optimizedLocs.map((l) => ({
                  name: l.name,
                  address: l.address,
                  latitude: l.latitude,
                  longitude: l.longitude,
                }));

                if (keepExisting) {
                  actions.bulkAddLocations(mapped);
                } else {
                  actions.bulkReplaceLocations(mapped);
                }

                showSuccess("Route imported and reordered to minimize walking distance.");
                setIsOptimizing(false);
              }}
            />
            <ActionButtons
              onAddClick={() => setIsAddModalOpen(true)}
              onOptimize={handleManualOptimize}
              isOptimizing={isOptimizing}
              canOptimize={activeLocations.length >= 2}
            />
            <RouteList
              activeLocations={activeLocations}
              legs={state.legs}
              isMockMode={state.isMockMode}
              isOptimizing={isOptimizing}
              optimizeResult={optimizeResult}
              onMoveUp={actions.moveLocationUp}
              onMoveDown={actions.moveLocationDown}
              onRemove={actions.removeLocation}
              onReorder={actions.reorderLocations}
              onToggleLock={actions.toggleLockLocation}
              onAddClick={() => setIsAddModalOpen(true)}
            />
            <RemovedLocations
              locations={removedLocations}
              onRestore={actions.restoreLocation}
            />
            <RouteSummary
              totalMinutes={state.plan.totalWalkingMinutes}
              totalMeters={state.plan.totalDistanceMeters}
              stopCount={activeLocations.length}
              isMockMode={state.isMockMode}
            />
          </div>
          <InfoBar />
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 h-[50vh] md:h-full relative bg-muted z-0">
          <MapPanel
            activeLocations={activeLocations}
            legs={state.legs}
            isMockMode={state.isMockMode}
            onApiFailure={() => actions.setMockMode(true)}
          />
        </div>
      </div>

      <AddLocationModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAdd={actions.addLocation}
        isMockMode={state.isMockMode}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalkListApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
