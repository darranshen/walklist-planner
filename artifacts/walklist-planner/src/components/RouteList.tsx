import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Location, RouteLeg, LegTransitStep, TransitMode } from "../types/route";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Trash2, MapPin, Ship, Train, Bus, ArrowRight, AlertTriangle, GripVertical, Loader2, CheckCircle, Lock, LockOpen } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface OptimizeResult {
  type: "success" | "error";
  message: string;
}

interface RouteListProps {
  activeLocations: Location[];
  legs: RouteLeg[];
  isMockMode: boolean;
  isOptimizing?: boolean;
  optimizeResult?: OptimizeResult | null;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onReorder: (newIds: string[]) => void;
  onToggleLock: (id: string) => void;
  onAddClick: () => void;
  selectedLocationId?: string | null;
  onSelectLocation?: (id: string | null) => void;
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
  const hasError = !!leg?.routeError;

  return (
    <div className="ml-6 border-l-2 border-dashed border-border pl-6 py-2 min-h-[40px] flex flex-col justify-center gap-2">
      {!isLast ? (
        <>
          {hasError && (
            <div className="flex flex-col gap-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>No walking route found</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 pl-0.5">
                This leg may require a ferry, train, or other transit. Check Google Maps for options.
              </p>
            </div>
          )}
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
                {(isMockMode || hasError) && <span className="text-[10px] opacity-70">(approx.)</span>}
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

interface LocationCardProps {
  loc: Location;
  index: number;
  total: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}

function LocationCardInner({
  loc,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleLock,
  isDragging = false,
  dragHandleProps = {},
  isSelected = false,
  onSelect,
}: LocationCardProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isLocked = !!loc.locked;

  return (
    <Card
      className={`relative p-4 pr-[60px] transition-all cursor-pointer ${
        isDragging
          ? 'shadow-lg border-primary/50 bg-primary/5'
          : isSelected
            ? 'border-blue-300 bg-blue-50/70 dark:border-blue-600 dark:bg-blue-950/40'
            : isLocked
              ? 'border-green-300 bg-green-50/40 dark:border-green-700 dark:bg-green-950/20'
              : 'hover:border-primary/30'
      }`}
      onClick={() => onSelect?.(isSelected ? null : loc.id)}
    >
      <div className="flex items-start gap-3">
        <button
          className={`flex-shrink-0 mt-1 transition-colors touch-none ${
            isLocked
              ? 'cursor-not-allowed text-muted-foreground/20'
              : 'cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground'
          }`}
          aria-label={isLocked ? `${loc.name} is locked and cannot be dragged` : `Drag to reorder ${loc.name}`}
          tabIndex={-1}
          {...(isLocked ? {} : dragHandleProps)}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
          isLocked ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
        }`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-sm" title={loc.name}>{loc.name}</h3>
            {loc.source === 'manual' && (
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded flex-shrink-0">
                manual
              </span>
            )}
            {isLocked && (
              <span className="text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded flex-shrink-0">
                locked
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{loc.address}</p>
        </div>
      </div>

      <div className="absolute right-2 top-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
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
        <div className="flex bg-muted/50 rounded-md border border-border overflow-hidden">
          <button
            onClick={() => onToggleLock(loc.id)}
            className={`p-1 transition-colors ${
              isLocked
                ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/40'
                : 'text-foreground hover:bg-muted'
            }`}
            aria-label={isLocked ? `Unlock ${loc.name}` : `Lock ${loc.name} in place`}
            data-testid={`button-lock-${loc.id}`}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="w-[1px] bg-border" />
          <button
            onClick={() => onRemove(loc.id)}
            className="p-1 hover:bg-destructive/10 text-foreground hover:text-destructive transition-colors"
            aria-label={`Remove ${loc.name} from route`}
            data-testid={`button-remove-${loc.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function SortableLocationCard(props: LocationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.loc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} data-loc-id={props.loc.id}>
      <LocationCardInner
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function RouteList({
  activeLocations,
  legs,
  isMockMode,
  isOptimizing = false,
  optimizeResult,
  onMoveUp,
  onMoveDown,
  onRemove,
  onReorder,
  onToggleLock,
  onAddClick,
  selectedLocationId,
  onSelectLocation,
}: RouteListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the highlighted card into view when selection changes from outside (map click)
  useEffect(() => {
    if (!selectedLocationId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-loc-id="${selectedLocationId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedLocationId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const activeLocation = activeId ? activeLocations.find(l => l.id === activeId) : null;
  const activeIndex = activeLocation ? activeLocations.indexOf(activeLocation) : -1;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = activeLocations.findIndex(l => l.id === active.id);
    const newIndex = activeLocations.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newIds = arrayMove(activeLocations, oldIndex, newIndex).map(l => l.id);
    onReorder(newIds);
  }

  if (activeLocations.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-4">Active Route (0 stops)</h2>
        <Card className="p-8 text-center border-dashed bg-muted/30">
          <MapPin className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">Add at least two locations to generate a walking route.</p>
          <Button size="sm" onClick={onAddClick} data-testid="button-empty-add">Add Location</Button>
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
        {isOptimizing && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Optimizing...
          </span>
        )}
      </div>

      {optimizeResult && !isOptimizing && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2.5 mb-4 text-xs ${
          optimizeResult.type === "success"
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300"
            : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
        }`}>
          {optimizeResult.type === "success" ? (
            <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          )}
          <span>{optimizeResult.message}</span>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md p-3 mb-4 text-xs text-blue-800 dark:text-blue-300">
        Drag the <GripVertical className="inline w-3 h-3 -mt-0.5" /> handle or use the arrows to reorder stops. Changing order changes the route sequence only.
      </div>

      {activeLocations.length === 1 && (
        <p className="text-sm text-muted-foreground mb-4 italic px-2">
          Add one more location to generate a walking route.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeLocations.map(l => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3" ref={listRef}>
            {activeLocations.map((loc, index) => {
              const isLast = index === activeLocations.length - 1;
              return (
                <div key={loc.id}>
                  <SortableLocationCard
                    loc={loc}
                    index={index}
                    total={activeLocations.length}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onRemove={onRemove}
                    onToggleLock={onToggleLock}
                    isSelected={selectedLocationId === loc.id}
                    onSelect={onSelectLocation}
                  />
                  {activeLocations.length > 1 && (
                    <LegConnector leg={legs[index]} isMockMode={isMockMode} isLast={isLast} />
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeLocation ? (
            <div className="shadow-2xl rotate-[1deg]">
              <LocationCardInner
                loc={activeLocation}
                index={activeIndex}
                total={activeLocations.length}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                onRemove={() => {}}
                onToggleLock={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
