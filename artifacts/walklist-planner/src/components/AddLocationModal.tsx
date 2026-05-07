import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { geocodeAddress } from "../services/geocoding";
import { Location } from "../types/route";

interface AddLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (location: Omit<Location, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  isMockMode: boolean;
}

export function AddLocationModal({ open, onOpenChange, onAdd, isMockMode }: AddLocationModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) return;

    setIsGeocoding(true);
    setError(null);

    try {
      const geoResult = await geocodeAddress(address, isMockMode);
      
      onAdd({
        name: name.trim(),
        address: address.trim(),
        latitude: geoResult?.lat ?? null,
        longitude: geoResult?.lng ?? null,
        placeId: geoResult?.placeId,
      });
      
      setName("");
      setAddress("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to geocode address");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setAddress("");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const isValid = name.trim().length > 0 && address.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-add-location">
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="loc-name">Location Name</Label>
            <Input
              id="loc-name"
              placeholder="e.g. Blue Bottle Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-loc-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-address">Address</Label>
            <Input
              id="loc-address"
              placeholder="e.g. 66 Mint St, San Francisco, CA"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="input-loc-address"
            />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="text-geocode-error">{error}</p>}
          {isMockMode && !error && (
            <p className="text-xs text-muted-foreground italic">
              Address saved — coordinates will be set when Google Maps is configured.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-add">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isGeocoding} data-testid="button-save-location">
            {isGeocoding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
