"use client";
import Link from "next/link";
import { PageHeading } from "@/components/manager/Workspace";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUBS, COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextEventDate } from "@/lib/career/calendar";
import { getSeasonPhase } from "@/lib/career/preseason";
import { ClubLink } from "@/components/entityLinks";
import type { CareerFixtureType } from "@/lib/career/types";

const FIXTURE_TYPE_LABEL: Record<CareerFixtureType, string> = { LEAGUE: "Liga", CUP: "Cup", FRIENDLY: "Träningsmatch" };
const FIXTURE_TYPE_TONE: Record<CareerFixtureType, string> = { LEAGUE: "neutral", CUP: "warning", FRIENDLY: "positive" };

export default function SchedulePage() {
  const router = useRouter();
  const { career, bookFriendly } = useCareer();
  const club = getCareerClub(career);
  const nextEventDate = getNextEventDate(career);
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const seasonPhase = getSeasonPhase(career);

  const fixtures = career.fixtures
    .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="hm-grid" style={{ gap: 12 }}><PageHeading eyebrow={career.seasonId} title="Matcher & resultat" description="Ditt lags hela matchprogram, motståndare och rapporter." actions={<div className="hm-actions"><Link href="/career/calendar" className="hm-btn">Kalender →</Link><Link href="/career/match-2d" className="hm-btn">Matchrepriser →</Link></div>} />
      {seasonPhase === "PRESEASON" ? <FriendlyBooking clubId={club.id} onBook={bookFriendly} /> : null}

      <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Säsongsschema — {competitionName} {career.seasonId}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`hm-badge hm-badge-${seasonPhase === "PRESEASON" ? "warning" : "positive"}`}>{seasonPhase === "PRESEASON" ? "Försäsong" : "Tävlingssäsong"}</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{fixtures.length} matcher</span>
        </span>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead>
            <tr>
              <th>Omg</th>
              <th>Datum</th>
              <th>Typ</th>
              <th>Hemma / Borta</th>
              <th>Motstånd</th>
              <th>Status</th>
              <th>Resultat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => {
              const home = f.homeClubId === club.id;
              const opponent = getClub(home ? f.awayClubId : f.homeClubId)!;
              const result = career.results[f.id];
              const isNext = !result && f.date === nextEventDate;
              const played = Boolean(result);
              // HM-UX-0.2 (Spec §36): Match Preview always shows the
              // career's actual next fixture, not an arbitrary one --
              // it has no per-fixture route. A future (not-yet-next)
              // fixture must not link there, or clicking round 8 would
              // silently show round 3's preview. Only the real next
              // fixture, and every already-played one, are clickable.
              const clickable = played || isNext;
              const gf = result ? (home ? result.homeGoals : result.awayGoals) : undefined;
              const ga = result ? (home ? result.awayGoals : result.homeGoals) : undefined;
              const outcome = result ? (gf! > ga! ? "Vinst" : gf! < ga! ? "Förlust" : "Oavgjort") : undefined;
              const outcomeTone = outcome === "Vinst" ? "positive" : outcome === "Förlust" ? "negative" : "warning";
              return (
                <tr
                  key={f.id}
                  data-clickable={clickable}
                  data-highlight={isNext}
                  onClick={clickable ? () => router.push(played ? `/career/match-report/${f.id}` : "/career/match-preview") : undefined}
                >
                  <td>{f.type === "LEAGUE" ? f.round : "—"}</td>
                  <td>{new Date(f.date).toLocaleDateString("sv-SE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td>
                    <span className={`hm-badge hm-badge-${FIXTURE_TYPE_TONE[f.type]}`}>{FIXTURE_TYPE_LABEL[f.type]}</span>
                  </td>
                  <td>{home ? "Hemma" : "Borta"}</td>
                  <td className="hm-td-strong">
                    <ClubLink clubId={opponent.id} stopPropagation>
                      {opponent.name}
                    </ClubLink>
                  </td>
                  <td>
                    <span className={`hm-badge ${played ? "hm-badge-neutral" : isNext ? "hm-badge-positive" : "hm-badge-warning"}`}>
                      {played ? "Spelad" : isNext ? "Nästa match" : "Kommande"}
                    </span>
                  </td>
                  <td>
                    {result ? (
                      <span className="hm-td-strong">
                        {gf}–{ga}
                      </span>
                    ) : (
                      <span className="hm-text-muted">—</span>
                    )}
                  </td>
                  <td>{!played && <Link href={`/career/fixtures/${f.id}`} onClick={e => e.stopPropagation()}>Förhandsvisa →</Link>}{outcome ? <span className={`hm-badge hm-badge-${outcomeTone}`}>{outcome}</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

/** HM-PRESEASON-1.0: simple date + opponent booking form -- no negotiation, only date/opponent conflict validation (lib/career/preseason.ts's bookFriendly). */
function FriendlyBooking({ clubId, onBook }: { clubId: string; onBook: (date: string, opponentClubId: string) => { ok: boolean; error?: string } }) {
  const opponents = CLUBS.filter((c) => c.id !== clubId && c.playable);
  const [date, setDate] = useState("");
  const [opponentClubId, setOpponentClubId] = useState(opponents[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "positive" | "negative"; text: string } | null>(null);

  function handleBook() {
    if (!date || !opponentClubId) {
      setMessage({ tone: "negative", text: "Välj datum och motståndare." });
      return;
    }
    const result = onBook(date, opponentClubId);
    setMessage(result.ok ? { tone: "positive", text: "Träningsmatch bokad." } : { tone: "negative", text: result.error ?? "Kunde inte boka matchen." });
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Boka träningsmatch</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="hm-eyebrow">Datum</span>
          <input type="date" className="hm-select" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="hm-eyebrow">Motståndare</span>
          <select className="hm-select" value={opponentClubId} onChange={(e) => setOpponentClubId(e.target.value)}>
            {opponents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="hm-btn hm-btn-primary" onClick={handleBook}>
          Boka
        </button>
        {message ? <span className={`hm-badge hm-badge-${message.tone}`}>{message.text}</span> : null}
      </div>
    </div>
  );
}
