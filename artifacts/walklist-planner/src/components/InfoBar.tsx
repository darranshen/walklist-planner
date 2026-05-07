export function InfoBar() {
  return (
    <div className="hidden md:block border-t border-border bg-muted/30 p-4 text-xs text-muted-foreground flex-shrink-0">
      <h4 className="font-semibold text-foreground mb-2">Quick Tips</h4>
      <ul className="space-y-1.5 list-disc pl-3">
        <li><strong>Numbered Stops</strong> — The order of your route is shown here and on the map.</li>
        <li><strong>Change Route Order</strong> — Move stops earlier or later to change the walking route.</li>
        <li><strong>Remove from Route</strong> — Temporarily remove stops without losing them.</li>
        <li><strong>Add Back</strong> — Restore removed locations to your active route.</li>
        <li><strong>Walking Times</strong> — See time between each stop and totals for the entire route.</li>
      </ul>
    </div>
  );
}
