import { Button } from "@/components/ui/button";
import { Plus, Map, Route, Loader2 } from "lucide-react";

interface ActionButtonsProps {
  onAddClick: () => void;
  onLoadSample: () => void;
  onOptimize: () => void;
  isOptimizing: boolean;
  canOptimize: boolean;
}

export function ActionButtons({
  onAddClick,
  onLoadSample,
  onOptimize,
  isOptimizing,
  canOptimize,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col gap-2 mb-8">
      <div className="flex gap-3">
        <Button
          onClick={onAddClick}
          className="flex-1"
          data-testid="button-add-location"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
        <Button
          variant="outline"
          onClick={onLoadSample}
          className="flex-1"
          data-testid="button-load-sample"
        >
          <Map className="w-4 h-4 mr-2" />
          Load Sample Route
        </Button>
      </div>
      <Button
        variant="outline"
        onClick={onOptimize}
        disabled={!canOptimize || isOptimizing}
        className="w-full"
        data-testid="button-optimize-route"
      >
        {isOptimizing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Route className="w-4 h-4 mr-2" />
        )}
        {isOptimizing ? "Optimizing route..." : "Optimize Route"}
      </Button>
    </div>
  );
}
