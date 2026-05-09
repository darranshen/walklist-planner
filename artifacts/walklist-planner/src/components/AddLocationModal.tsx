import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, MapPin, Loader2 } from "lucide-react";
import { Location } from "../types/route";

type PendingLocation = Omit<Location, "id" | "status" | "createdAt" | "updatedAt">;

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface AddLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMultiple: (locations: PendingLocation[]) => void;
  isMockMode: boolean;
}

export function AddLocationModal({
  open,
  onOpenChange,
  onAddMultiple,
  isMockMode,
}: AddLocationModalProps) {
  const [pending, setPending] = useState<PendingLocation[]>([]);

  // Live mode state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mock mode state
  const [mockName, setMockName] = useState("");
  const [mockAddress, setMockAddress] = useState("");

  const acServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usePlaces = !isMockMode && !!(window.google?.maps?.places?.AutocompleteService);

  // Init services when modal opens
  useEffect(() => {
    if (!open || !usePlaces) return;
    if (!acServiceRef.current) {
      acServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
    if (!placesServiceRef.current) {
      const div = document.createElement("div");
      placesServiceRef.current = new window.google.maps.places.PlacesService(div);
    }
  }, [open, usePlaces]);

  const fetchSuggestions = useCallback((value: string) => {
    if (!value.trim() || !acServiceRef.current) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);
    acServiceRef.current.getPlacePredictions(
      { input: value },
      (predictions, status) => {
        setIsFetchingSuggestions(false);
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          predictions
        ) {
          setSuggestions(
            predictions.map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text ?? "",
            }))
          );
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  }

  function handleSelectSuggestion(suggestion: Suggestion) {
    if (!placesServiceRef.current) return;
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery("");
    setIsResolvingPlace(true);

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.placeId,
        fields: ["name", "formatted_address", "geometry", "place_id"],
      },
      (place, status) => {
        setIsResolvingPlace(false);
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !place
        )
          return;
        setPending((prev) => [
          ...prev,
          {
            name: place.name || suggestion.mainText,
            address: place.formatted_address || suggestion.secondaryText,
            latitude: place.geometry?.location?.lat() ?? null,
            longitude: place.geometry?.location?.lng() ?? null,
            placeId: place.place_id,
            source: "manual" as const,
          },
        ]);
      }
    );
  }

  function addMockLocation() {
    if (!mockName.trim() || !mockAddress.trim()) return;
    setPending((prev) => [
      ...prev,
      {
        name: mockName.trim(),
        address: mockAddress.trim(),
        latitude: null,
        longitude: null,
        source: "manual" as const,
      },
    ]);
    setMockName("");
    setMockAddress("");
  }

  function removePending(i: number) {
    setPending((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleConfirm() {
    if (pending.length === 0) return;
    onAddMultiple(pending);
    handleClose();
  }

  function handleClose() {
    setPending([]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setMockName("");
    setMockAddress("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]" data-testid="modal-add-location">
        <DialogHeader>
          <DialogTitle>Add Locations</DialogTitle>
          <DialogDescription>
            Locations added here are saved in this planner only — they won't be
            added to your Google Maps saved list.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {usePlaces ? (
            <div className="grid gap-1.5">
              <Label htmlFor="loc-search">Search for a place</Label>
              <div className="relative">
                <div className="relative">
                  <Input
                    id="loc-search"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="e.g. Blue Bottle Coffee, San Francisco"
                    autoComplete="off"
                    data-testid="input-loc-search"
                    className={isResolvingPlace ? "pr-8" : ""}
                  />
                  {(isFetchingSuggestions || isResolvingPlace) && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.placeId}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(s);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                      >
                        <p className="text-sm font-medium leading-snug">{s.mainText}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{s.secondaryText}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Select from the dropdown to add to the queue below.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="loc-name">Location Name</Label>
                <Input
                  id="loc-name"
                  placeholder="e.g. Blue Bottle Coffee"
                  value={mockName}
                  onChange={(e) => setMockName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMockLocation()}
                  data-testid="input-loc-name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="loc-address">Address</Label>
                <Input
                  id="loc-address"
                  placeholder="e.g. 66 Mint St, San Francisco, CA"
                  value={mockAddress}
                  onChange={(e) => setMockAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMockLocation()}
                  data-testid="input-loc-address"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addMockLocation}
                disabled={!mockName.trim() || !mockAddress.trim()}
              >
                Add to queue
              </Button>
            </div>
          )}

          {pending.length > 0 && (
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {pending.length} location{pending.length !== 1 ? "s" : ""} queued
              </p>
              <div className="grid gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                {pending.map((loc, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-muted/50 border border-border text-sm"
                  >
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug">{loc.name}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{loc.address}</p>
                    </div>
                    <button
                      onClick={() => removePending(i)}
                      className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                      aria-label={`Remove ${loc.name} from queue`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-add">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending.length === 0}
            data-testid="button-save-location"
          >
            {pending.length > 0 ? `Add ${pending.length} to Route` : "Add to Route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
