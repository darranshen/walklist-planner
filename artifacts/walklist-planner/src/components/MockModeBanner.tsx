import { useState } from "react";
import { Info, X } from "lucide-react";

interface MockModeBannerProps {
  isMockMode: boolean;
}

export function MockModeBanner({ isMockMode }: MockModeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isMockMode || dismissed) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200 px-4 py-3 flex items-start gap-3 w-full z-50">
      <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p>
          <strong>Google Maps API key is missing.</strong> Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your environment to enable real maps and routing. Showing demo route with estimated times.
        </p>
      </div>
      <button 
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors text-blue-600 dark:text-blue-300"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
