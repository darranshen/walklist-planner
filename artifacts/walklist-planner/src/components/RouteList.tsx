import { Location, RouteLeg, LegTransitStep, TransitMode } from "../types/route";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Trash2, MapPin, Ship, Train, Bus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RouteListProps {
  activeLocations: Location[];
  legs: RouteLeg[];
  isMockMode: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
  onLoadSample: () => void;
}

function transitIcon(mode: TransitMode) {
  switch (mode) {
    case 'FERRY': return <Ship className="w-3.5 h-3.5" />;
    case 'SUBWAY': return <Train className="w-3.5 h-3.5" />;
    case 'RAIL': return <Train className="w-3.5 h-3.5" />;
    case 'BUS': return <Bus className="w-3.5 h-3.5" />;
    case 'TRAM': return <Train className="w-3.5 h-3.5" />;
    default: return <ArrowRight className="w-3.5 h-3.5" />;
  }
}

function transitLabel(mode: TransitMode) {
  switch (mode) {
    case 'FERRY': return 'Ferry';
    case 'SUBWAY': return 'Subway';
    case 'RAIL': return 'Train';
    case 'BUS': return 'Bus';
    case 'TRAM': return 'Tram';
    default: return 'Transit';
  }
}

function transitColors(mode: TransitMode) {
  switch (mode) {
    case 'FERRY':
      return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300';
    case 'SUBWAY':
    case 'RAIL':
      return 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300';
    case 'BUS':
      return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300';
    case 'TRAM':
      return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300';
    default:
      return 'bg-muted border-border text-muted-foreground';
  }
}

function TransitStepBadge({ step }: { step: LegTransitStep }) {
  const colors = transitColors(step.mode);
  const label = transitLabel(step.mode);
  const mins = step.durationMinutes;
  const mi = (step.distanceMeters / 1609.34).toFixed(1);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${colors}`}>
      {transitIcon(step.mode)}
      <span>{label}</span>
      {mins > 0 && <span className="opacity-70">· {mins} min</span>}
      {step.distanceMeters > 0 && <span className="opacity-70">· {mi} mi</span>}
    </div>
  );
}

function LegConnector({
  leg,
  isMockMode,
  isLast,
}: {
  leg: RouteLeg | undefined;
  isMockMode: boolean;
  isLast: boolean;
}) {
  const hasTransit = leg?.transitSteps && leg.transitSteps.length > 0;

  return (
    <div className="ml-6 border-l-2 border-dashed border-border pl-6 py-2 min-h-[40px] flex flex-col justify-center gap-2">
      {!isLast ? (
        <>
          {hasTransit && (
            <div className="flex flex-col gap-1.5">
              {leg!.transitSteps!.map((step, i) => (
                <div key={i}>
                  <TransitStepBadge step={step} />
                  <p className="text-[11px] text-muted-foreground mt-0.5 pl-0.5">{step.label}</p>
                </div>
              ))}
            </div>
          )}
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 bg-background inline-block py-0.5">
            {leg ? (
              <>
                {leg.walkingMinutes} min ({(leg.distanceMeters / 1609.34).toFixed(1)} mi) to next
                {isMockMode && <span className="text-[10px] opacity-70">(approx.)</span>}
              </>
            ) : (
              <span className="opacity-50">Calculating...</span>
            )}
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-muted-foreground bg-background inline-block py-0.5 opacity-70">
          This is your last stop
        </span>
      )}
    </div>
  );
}

export function RouteList({
  activeLocations,
  legs,
  isMockMode,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddClick,
  onLoadSample
}: RouteListProps) {
  if (activeLocations.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4">Active Route (0 stops)</h2>
        <Card className="p-8 text-center border-dashed bg-muted/30">
          <MapPin className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">Add at least two locations to generate a walking route.</p>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onAddClick} data-testid="button-empty-add">Add Location</Button>
            <Button size="sm" variant="outline" onClick={onLoadSample} data-testid="button-empty-sample">Load Sample Route</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
          Active Route ({activeLocations.length} stops)
        </h2>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md p-3 mb-4 text-xs text-blue-800 dark:text-blue-300">
        Changing order changes the route sequence only. It does not edit location details.
      </div>

      {activeLocations.length === 1 && (
        <p className="text-sm text-muted-foreground mb-4 italic px-2">
          Add one more location to generate a walking route.
        </p>
      )}

      <div className="space-y-3">
        {activeLocations.map((loc, index) => {
          const isFirst = index === 0;
          const isLast = index === activeLocations.length - 1;
          const leg = legs[index];

          return (
            <div key={loc.id} className="relative">
              <Card className={`p-4 pr-14 min-h-[86px] transition-all hover:border-primary/30 ${
                isFirst ? 'border-primary/20 bg-primary/5' : ''
              } ${isLast && activeLocations.length > 1 ? 'border-border bg-card' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate" title={loc.name}>{loc.name}</h3>
                    <p className="text-xs text-muted-foreground truncate" title={loc.address}>{loc.address}</p>
                  </div>
                </div>

                <div className="absolute right-2 top-2 flex flex-col gap-1">
                  <div className="flex bg-muted/50 rounded-md border border-border overflow-hidden">
                    <button
                      onClick={() => onMoveUp(index)}
                      disabled={isFirst}
                      className="p-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      aria-label={`Move ${loc.name} earlier`}
                      data-testid={`button-up-${loc.id}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-foreground" />
                    </button>
                    <div className="w-[1px] bg-border" />
                    <button
                      onClick={() => onMoveDown(index)}
                      disabled={isLast}
                      className="p-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      aria-label={`Move ${loc.name} later`}
                      data-testid={`button-down-${loc.id}`}
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(loc.id)}
                    className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md self-end transition-colors"
                    aria-label={`Remove ${loc.name} from route`}
                    data-testid={`button-remove-${loc.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>

              {activeLocations.length > 1 && (
                <LegConnector leg={leg} isMockMode={isMockMode} isLast={isLast} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
