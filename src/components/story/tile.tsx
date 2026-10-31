/** A figure and what it measures, for a `<dl>` grid of tiles separated by hairlines. */
export function Tile({ label, value }: { label: string; value: string }) {
  return (
    // dt must come first in a dl; column-reverse shows the value on top, justify-end keeps values level.
    <div className="flex flex-col-reverse justify-end bg-surface p-5 md:p-6">
      <dt className="mt-1 text-sm leading-snug text-pretty text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">{value}</dd>
    </div>
  );
}
