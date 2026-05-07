import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

interface SourceUrlFieldProps {
  initialUrl: string;
  onUpdate: (url: string) => void;
}

export function SourceUrlField({ initialUrl, onUpdate }: SourceUrlFieldProps) {
  const [value, setValue] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialUrl);
  }, [initialUrl]);

  const handleBlur = () => {
    if (!value.trim()) {
      setError(null);
      onUpdate("");
      return;
    }

    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        setError(null);
        onUpdate(value.trim());
      } else {
        setError("Enter a valid Google Maps shared list URL, or leave this field blank.");
      }
    } catch {
      setError("Enter a valid Google Maps shared list URL, or leave this field blank.");
    }
  };

  const isValidSaved = !error && value && value === initialUrl;

  return (
    <div className="mb-6 space-y-2">
      <Label htmlFor="source-url" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        Source: Google Maps Shared List (optional)
      </Label>
      <div className="relative">
        <Input
          id="source-url"
          type="url"
          placeholder="https://maps.app.goo.gl/abc123example"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          className={error ? "border-destructive pr-10" : "pr-10"}
          data-testid="input-source-url"
        />
        {isValidSaved && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">We'll keep this link for reference only.</p>
      )}
    </div>
  );
}
