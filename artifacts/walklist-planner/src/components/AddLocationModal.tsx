import { useState, useEffect, useRef } from "react";
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
import { X, MapPin } from "lucide-react";
import { Location } from "../types/route";

type PendingLocation = Omit<Location, "id" | "status" | "createdAt" | "updatedAt">;

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
  const [mockName, setMockName] = useState("");
  const [mockAddress, setMockAddress] = useState("");
  const [placesReady, setPlacesReady] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const usePlaces = !isMockMode && placesReady;

  // Detect Places availability
  useEffect(() => {
    setPlacesReady(!!(window.google?.maps?.places));
  }, [open]);

  // Attach Places Autocomplete to the input
  useEffect(() => {
    if (!open || !usePlaces || !inputRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["name", "formatted_address", "geometry", "place_id"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;

      setPending((prev) => [
        ...prev,
        {
          name: place.name || inputRef.current?.value || "",
          address: place.formatted_address || "",
          latitude: place.geometry!.location!.lat(),
          longitude: place.geometry!.location!.lng(),
          placeId: place.place_id,
          source: "manual" as const,
        },
      ]);

      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    });

    autocompleteRef.current = ac;

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [open, usePlaces]);

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
              <Input
                ref={inputRef}
                id="loc-search"
                placeholder="e.g. Blue Bottle Coffee, San Francisco"
                autoComplete="off"
                data-testid="input-loc-search"
              />
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
            {pending.length > 0
              ? `Add ${pending.length} to Route`
              : "Add to Route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
