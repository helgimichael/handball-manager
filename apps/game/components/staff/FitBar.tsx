// Arena Nights 231 -- the staff fit bar on the 1-20 scale (STF-01, STF-02a, STF-03c): a filled bar with the figure,
// a hatched range while the club does not know the person well, and an optional marker for whoever does the
// job today. Shared by the matrix, the dossier and the market.
import { fitTone } from "@/lib/staff/staffDesk";

/** A 1-20 fit as a bar with its figure. `range` draws uncertainty; `marker` marks someone to compare with. */
export function FitBar({ value, range, marker, markerLabel, label }: { value: number; range?: { low: number; high: number; exact: boolean }; marker?: number; markerLabel?: string; label?: string }) {
  const pct = (n: number) => `${((Math.max(1, Math.min(20, n)) - 1) / 19) * 100}%`;
  const low = range && !range.exact ? range.low : value;
  const high = range && !range.exact ? range.high : value;
  const tone = fitTone(range && !range.exact ? (low + high) / 2 : value);
  const text = range && !range.exact ? `${low}–${high}` : (Math.round(value * 10) / 10).toFixed(Number.isInteger(value) ? 0 : 1);
  return (
    <span className="sf-fit" data-tone={tone} role="img" aria-label={`${label ?? "Lämplighet"}: ${text} av 20${marker !== undefined ? `, ${markerLabel ?? "i dag"} ${Math.round(marker)}` : ""}`}>
      <span className="sf-fit-track" aria-hidden="true">
        <i className="sf-fit-fill" style={{ width: pct(low) }} />
        {range && !range.exact && <i className="sf-fit-range" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />}
        {marker !== undefined && <i className="sf-fit-marker" style={{ left: pct(marker) }} title={`${markerLabel ?? "I dag"}: ${Math.round(marker)}`} />}
      </span>
      <b className="sf-num">{text}</b>
    </span>
  );
}

