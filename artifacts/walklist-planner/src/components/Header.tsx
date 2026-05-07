import { Footprints } from "lucide-react";

export function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-primary flex items-center gap-2">
        <Footprints className="w-5 h-5" />
        WalkList Planner
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Plan the perfect walking route from your Google Maps saved list.
      </p>
    </div>
  );
}
