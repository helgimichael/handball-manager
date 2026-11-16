"use client";
// Arena Nights TRN-01: projected matchday readiness rail -- today, your
// current schedule and (when pending) the assistant's proposal, from the
// read-only replay in lib/training/readinessProjection.ts.
import { MatchHero } from "@/components/game/Identity";
import type { CareerState } from "@/lib/career/types";
import { getClub } from "@/lib/game-data";
import { READY_THRESHOLD, type ReadinessProjection } from "@/lib/training/readinessProjection";
import { shortDate } from "./weekParts";

const WEEKDAY = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"];

export function targetLabel(career: CareerState, projection: ReadinessProjection | null): string {
  const t = projection?.target;
  if (!t) return "– veckan är genomförd";
  const weekday = WEEKDAY[new Date(`${t.date}T00:00:00Z`).getUTCDay()];
  if (t.kind === "MATCH") {
    const opp = t.opponentClubId ? getClub(t.opponentClubId)?.shortName ?? getClub(t.opponentClubId)?.name ?? t.opponentClubId : "";
    return `${weekday} ${shortDate(t.date)}${opp ? ` mot ${opp}` : ""}`;
  }
  return `vid veckans slut (${weekday} ${shortDate(t.date)})`;
}

function Bar({ label, value, emphasis }: { label: string; value: number | null; emphasis?: boolean }) {
  const tone = value === null ? undefined : value >= READY_THRESHOLD ? "pos" : value >= 55 ? "warn" : "neg";
  return (
    <div className="trn-fc-row" data-emphasis={emphasis || undefined}>
      <span>{label}</span>
      <span className="trn-fc-track" aria-hidden="true"><i data-tone={tone} style={{ width: `${value ?? 0}%` }} /></span>
      <b className="trn-num">{value === null ? "—" : `${value} %`}</b>
    </div>
  );
}

export default function ReadinessForecast({ career, live, proposed }: { career: CareerState; live: ReadinessProjection; proposed?: ReadinessProjection | null }) {
  const t = live.target;
  const fixture = t?.fixtureId ? career.fixtures.find((f) => f.id === t.fixtureId) : undefined;
  return (
    <aside className="hm-panel trn-forecast" aria-labelledby="trn-forecast-title">
      <span className="hm-eyebrow">Prognos</span>
      <h2 id="trn-forecast-title">Matchberedskap {targetLabel(career, live)}</h2>
      {t ? (
        <>
          <div className="trn-fc">
            <Bar label="Truppen idag" value={live.averageNow} />
            <Bar label={proposed ? "Ditt schema" : "Med veckans plan"} value={live.averageProjected} emphasis={!proposed} />
            {proposed && <Bar label="Med förslaget" value={proposed.averageProjected} emphasis />}
          </div>
          <p className="trn-fc-note">
            <b className="trn-num">{proposed ? proposed.belowThreshold : live.belowThreshold}</b> spelare under {READY_THRESHOLD} %{proposed ? ` med förslaget (${live.belowThreshold} med ditt schema)` : ""}.
            {live.days > 0 ? ` Bygger på ${live.days} återstående ${live.days === 1 ? "dag" : "dagar"}.` : ""}
          </p>
          <p className="trn-hint">Uppskattning från passens typ, intensitet (×0,6–×1,8) och längd (×0,7–×1,3), spelarens belastningsinställning och individuella återhämtning. Matcher, skador och nya beslut kan ändra utfallet.</p>
        </>
      ) : (
        <p className="trn-hint">Alla dagar i veckan är genomförda. Byt till kommande vecka för en prognos.</p>
      )}
      {fixture && <MatchHero career={career} fixture={fixture} context="Veckan byggs runt matchen" compact />}
    </aside>
  );
}
