import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRouteState } from "./hooks/useRouteState";

// Components
import { Header } from "./components/Header";
import { SourceUrlField } from "./components/SourceUrlField";
import { ActionButtons } from "./components/ActionButtons";
import { AddLocationModal } from "./components/AddLocationModal";
import { RouteList } from "./components/RouteList";
import { RemovedLocations } from "./components/RemovedLocations";
import { RouteSummary } from "./components/RouteSummary";
import { MapPanel } from "./components/MapPanel";
import { MockModeBanner } from "./components/MockModeBanner";
import { InfoBar } from "./components/InfoBar";

const queryClient = new QueryClient();

function WalkListApp() {
  const { state, actions } = useRouteState();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (!state) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const activeLocations = state.plan.activeLocationIds.map(id => state.locations[id]).filter(Boolean);
  const removedLocations = state.plan.removedLocationIds.map(id => state.locations[id]).filter(Boolean);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <MockModeBanner isMockMode={state.isMockMode} />
      
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-full md:w-[400px] flex flex-col h-full border-r border-border bg-card z-10 shadow-sm flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 relative">
            <Header />
            <SourceUrlField 
              initialUrl={state.plan.sourceListUrl} 
              onUpdate={actions.updateSourceUrl} 
            />
            <ActionButtons 
              onAddClick={() => setIsAddModalOpen(true)} 
              onLoadSample={actions.loadSampleRoute} 
            />
            <RouteList 
              activeLocations={activeLocations}
              legs={state.legs}
              isMockMode={state.isMockMode}
              onMoveUp={actions.moveLocationUp}
              onMoveDown={actions.moveLocationDown}
              onRemove={actions.removeLocation}
              onAddClick={() => setIsAddModalOpen(true)}
              onLoadSample={actions.loadSampleRoute}
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
