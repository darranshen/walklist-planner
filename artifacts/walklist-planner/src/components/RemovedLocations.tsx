import { Location } from "../types/route";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RemovedLocationsProps {
  locations: Location[];
  onRestore: (id: string) => void;
}

export function RemovedLocations({ locations, onRestore }: RemovedLocationsProps) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4">
        Removed Locations ({locations.length})
      </h2>
      
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-2">
          Removed locations will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <Card key={loc.id} className="p-3 flex items-center justify-between gap-3 bg-muted/20 border-dashed">
              <div className="min-w-0 flex-1 opacity-70">
                <h3 className="font-medium text-sm truncate" title={loc.name}>{loc.name}</h3>
                <p className="text-xs text-muted-foreground truncate" title={loc.address}>{loc.address}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onRestore(loc.id)}
                className="flex-shrink-0 text-primary hover:text-primary hover:bg-primary/10 h-8 px-2"
                data-testid={`button-restore-${loc.id}`}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Add Back
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
