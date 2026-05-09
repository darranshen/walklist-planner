import { Button } from "@/components/ui/button";
import { Plus, Route, Loader2 } from "lucide-react";

interface ActionButtonsProps {
  onAddClick: () => void;
  onOptimize: () => void;
  isOptimizing: boolean;
  canOptimize: boolean;
}

export function ActionButtons({
  onAddClick,
  onOptimize,
  isOptimizing,
  canOptimize,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col gap-2 mb-8">
      <Button
        variant="outline"
        onClick={onAddClick}
        className="w-full"
        data-testid="button-add-location"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Location
      </Button>
      <Button
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
