import { Button } from "@/components/ui/button";
import { Plus, Map } from "lucide-react";

interface ActionButtonsProps {
  onAddClick: () => void;
  onLoadSample: () => void;
}

export function ActionButtons({ onAddClick, onLoadSample }: ActionButtonsProps) {
  return (
    <div className="flex gap-3 mb-8">
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
  );
}
