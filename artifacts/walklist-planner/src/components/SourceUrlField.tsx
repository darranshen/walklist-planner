import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Download, Loader2, AlertCircle } from "lucide-react";
import { importFromMapsUrl, type ImportedLocation } from "@/services/mapsListImport";

interface SourceUrlFieldProps {
  initialUrl: string;
  hasExistingLocations: boolean;
  onUpdate: (url: string) => void;
  onImport: (locations: ImportedLocation[], keepExisting: boolean) => void;
}

const GOOGLE_MAPS_HOSTS = [
  "maps.app.goo.gl",
  "maps.google.com",
  "www.google.com",
  "goo.gl",
];

function isGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!GOOGLE_MAPS_HOSTS.includes(url.hostname)) return false;
    if (url.hostname === "www.google.com" && !url.pathname.startsWith("/maps")) return false;
    return true;
  } catch {
    return false;
  }
}

export function SourceUrlField({ initialUrl, hasExistingLocations, onUpdate, onImport }: SourceUrlFieldProps) {
  const [value, setValue] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [pendingLocations, setPendingLocations] = useState<ImportedLocation[] | null>(null);

  useEffect(() => {
    setValue(initialUrl);
  }, [initialUrl]);

  const handleBlur = () => {
    setImportError(null);
    setImportedCount(null);

    if (!value.trim()) {
      setError(null);
      onUpdate("");
      return;
    }

    if (isGoogleMapsUrl(value.trim())) {
      setError(null);
      onUpdate(value.trim());
    } else {
      setError("Paste a Google Maps shared list URL (e.g. https://maps.app.goo.gl/…), or leave blank.");
    }
  };

  const handleImport = async () => {
    if (!value.trim() || !isGoogleMapsUrl(value.trim())) return;
    setImporting(true);
    setImportError(null);
    setImportedCount(null);

    try {
      const locations = await importFromMapsUrl(value.trim());
      if (hasExistingLocations) {
        setPendingLocations(locations);
      } else {
        onImport(locations, true);
        setImportedCount(locations.length);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import locations.");
    } finally {
      setImporting(false);
    }
  };

  const handleKeepExisting = () => {
    if (!pendingLocations) return;
    onImport(pendingLocations, true);
    setImportedCount(pendingLocations.length);
    setPendingLocations(null);
  };

  const handleReplaceAll = () => {
    if (!pendingLocations) return;
    onImport(pendingLocations, false);
    setImportedCount(pendingLocations.length);
    setPendingLocations(null);
  };

  const handleDialogCancel = () => {
    setPendingLocations(null);
  };

  const isValidSaved = !error && value && value === initialUrl;
  const canImport = isValidSaved && !importing;

  return (
    <>
      <div className="mb-6 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="source-url"
              type="url"
              placeholder="https://maps.app.goo.gl/abc123example"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setImportError(null);
                setImportedCount(null);
              }}
              onBlur={handleBlur}
              className={error ? "border-destructive pr-8" : "pr-8"}
              data-testid="input-source-url"
            />
            {isValidSaved && !importing && (
              <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
            )}
          </div>

          {isValidSaved && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={!canImport}
              className="flex-shrink-0 gap-1.5"
              data-testid="btn-import-locations"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {importing ? "Importing..." : "Import"}
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {!error && importError && (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {!error && !importError && importedCount !== null && (
          <p className="text-xs text-green-600 dark:text-green-400">
            {importedCount} location{importedCount !== 1 ? "s" : ""} added to your route.
          </p>
        )}

        {!error && !importError && importedCount === null && (
          <p className="text-xs text-muted-foreground">
            {isValidSaved
              ? "Click Import to load locations from this list into your route."
              : "We'll keep this link for reference only."}
          </p>
        )}
      </div>

      <AlertDialog open={pendingLocations !== null} onOpenChange={(open) => { if (!open) handleDialogCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep existing locations?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have locations in your route. Would you like to keep them alongside the{" "}
              {pendingLocations?.length ?? 0} newly imported location{pendingLocations?.length !== 1 ? "s" : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleReplaceAll}>
              No, replace all
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleKeepExisting}>
              Yes, keep existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
