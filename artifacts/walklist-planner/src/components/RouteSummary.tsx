import { Footprints, Map } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RouteSummaryProps {
  totalMinutes: number;
  totalMeters: number;
  stopCount: number;
  isMockMode: boolean;
}

export function RouteSummary({ totalMinutes, totalMeters, stopCount, isMockMode }: RouteSummaryProps) {
  if (stopCount < 2) return null;

  const totalMiles = (totalMeters / 1609.34).toFixed(1);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  const timeString = hours > 0 
    ? `${hours} hr ${mins} min` 
    : `${mins} min`;

  return (
    <Card className="p-5 mb-8 bg-card border-border shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4 border-b border-border pb-2">
        Route Summary
      </h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Footprints className="w-3.5 h-3.5" /> Total Walking Time
          </div>
          <div className="font-semibold text-lg flex items-baseline gap-1.5">
            {timeString}
            {isMockMode && <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">(approx.)</span>}
          </div>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5" /> Total Distance
          </div>
          <div className="font-semibold text-lg flex items-baseline gap-1.5">
            {totalMiles} mi
            <span className="text-xs font-normal text-muted-foreground ml-1">({totalMeters} m)</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>{stopCount} stops &bull; {stopCount - 1} walking segments</span>
        <span className="italic">Times are estimates and may vary.</span>
      </div>
    </Card>
  );
}
