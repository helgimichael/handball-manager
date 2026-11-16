"use client";
// Arena Nights TRN-01d (A: development leaderboard). Own squad ranked by
// visible attribute gains in the last 28 days, Swedish attribute labels,
// delta chips, focus chip and stars as graphics. Tap a player -> dossier.
import Link from "next/link";
import { useMemo } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { PlayerGlyph } from "@/components/game/Identity";
import { playerProfileHref } from "@/components/entityLinks/PlayerLink";
import { DEVELOPMENT_STATUS_LABEL, DEVELOPMENT_WINDOW_DAYS, developmentLeaderboard } from "@/lib/training/developmentBoard";
import type { IndividualDevelopmentFocus } from "@/lib/development/types";
import { FOCUS_LABEL } from "./PlayerReadinessStrip";
import { shortDate } from "./weekParts";

function Stars({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="trn-stars" data-unknown>—</span>;
  return (
    <span className="trn-stars" role="img" aria-label={`${label}: ${value} av 5 stjärnor`}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} data-fill={i < value || undefined} />)}
    </span>
  );
}

export default function DevelopmentLeaderboard() {
  const { career } = useCareer();
  const rows = useMemo(() => developmentLeaderboard(career), [career]);
  const growing = rows.filter((r) => r.totalGain > 0).length;
  return (
    <section className="hm-panel trn-dev" aria-labelledby="trn-dev-title">
      <div className="trn-planner-head">
        <h2 id="trn-dev-title" className="hm-panel-title">Utveckling</h2>
        <span className="trn-hint">{growing ? `${growing} spelare har förbättrats de senaste ${DEVELOPMENT_WINDOW_DAYS} dagarna` : `Ingen synlig förbättring de senaste ${DEVELOPMENT_WINDOW_DAYS} dagarna`}</span>
      </div>
      {growing === 0 && (
        <p className="trn-hint">
          Synliga förbättringar avgörs vid veckans utvecklingsavstämning. Styr stimulansen med <a href="#trn-readiness">individuellt fokus i Spelarberedskap</a> och passtyperna i veckoschemat.
        </p>
      )}
      <ol className="trn-dev-list">
        {rows.map((r, i) => {
          const focus = FOCUS_LABEL[(r.focus as IndividualDevelopmentFocus)] ?? FOCUS_LABEL.NORMAL;
          return (
            <li key={r.player.id} data-gain={r.totalGain > 0 || undefined}>
              <Link href={playerProfileHref(r.player.id)} className="trn-dev-row">
                <span className="trn-dev-rank trn-num">{r.totalGain > 0 ? i + 1 : "–"}</span>
                <PlayerGlyph player={r.player} size={30} />
                <span className="trn-dev-who">
                  <b>{r.player.firstName} {r.player.lastName}</b>
                  <small>{r.player.position}{r.age !== null ? ` · ${r.age} år` : ""} · <span data-status={r.status}>{DEVELOPMENT_STATUS_LABEL[r.status]}</span></small>
                </span>
                <span className="trn-dev-stars">
                  <Stars value={r.level} label="Nivå" />
                  <Stars value={r.potential} label="Potential" />
                </span>
                <span className="trn-dev-gains">
                  {r.gains.length ? r.gains.slice(0, 3).map((g) => (
                    <em key={g.attribute} className="trn-delta" data-neg={g.to < g.from || undefined}>{g.label} <span className="trn-num">{g.from} → {g.to}</span></em>
                  )) : r.latest ? (
                    <small>Senast: {r.latest.label} {r.latest.from} → {r.latest.to} ({shortDate(r.latest.date)})</small>
                  ) : <small>Ingen förändring registrerad</small>}
                  {r.gains.length > 3 && <small>+{r.gains.length - 3} till</small>}
                </span>
                <span className="trn-dev-focus" data-active={r.focus !== "NORMAL" || undefined}>{focus}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
