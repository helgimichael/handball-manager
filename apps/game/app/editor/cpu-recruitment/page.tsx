"use client";

// Arena Nights SYS-05 (A) "Move under dev gate": the CPU recruitment debug view, relocated from the
// player-facing /career/club/cpu-recruitment into the dev console (server-gated by app/editor/layout.tsx).
// Career context = this browser's active save, loaded by the same CareerProvider the game uses; switching
// careers happens in "Ladda spel". Read-only: the same squad-need assessment, pursuits and decision log the
// recruitment engine itself produces, read off CareerState (HM-CPU-SQUAD-BUILDING-1.0).
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DevPageHead } from "@/components/dev/DevShell";
import { CareerProvider, useCareer } from "@/lib/career/CareerContext";
import { careerClubsInCompetition } from "@/lib/career/competitionMembership";
import { assessSquadNeeds } from "@/lib/career/cpuSquadNeeds";
import { getCpuDecisionLogForClub, getCpuRecruitmentPlansForClub } from "@/lib/career/cpuRecruitment";
import { getClub } from "@/lib/game-data";
import { getActiveSave } from "@/lib/save/saveRepository";

const NEED_TONE: Record<string, string> = { NONE: "hm-dev-pos", LOW: "hm-dev-muted", MEDIUM: "hm-dev-warn", HIGH: "hm-dev-neg" };

const Head = () => (
  <DevPageHead eyebrow="Felsökning" title="CPU-rekrytering" note="Varför CPU-klubbarna i din aktiva karriär rekryterar som de gör. Endast läsning." />
);

function Notice({ children }: { children: ReactNode }) {
  return (
    <>
      <Head />
      <div className="hm-dev-panel"><div className="hm-dev-empty">{children}</div></div>
    </>
  );
}

export default function CpuRecruitmentDevPage() {
  const [active, setActive] = useState<"loading" | "none" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    getActiveSave()
      .then((save) => { if (!cancelled) setActive(save ? "ready" : "none"); })
      .catch(() => { if (!cancelled) setActive("error"); });
    return () => { cancelled = true; };
  }, []);

  if (active === "loading") return <Notice>Läser aktiv karriär…</Notice>;
  if (active === "error") return <Notice><span className="hm-dev-neg">Kunde inte läsa sparade karriärer i den här webbläsaren.</span></Notice>;
  if (active === "none") {
    return (
      <Notice>
        Ingen aktiv karriär i den här webbläsaren. <Link href="/load-game">Ladda en sparad karriär</Link> eller{" "}
        <Link href="/new-game">starta en ny</Link> och kom tillbaka hit.
      </Notice>
    );
  }
  return (
    <CareerProvider loadingFallback={<Notice>Läser in karriären…</Notice>}>
      <Head />
      <CpuRecruitmentTables />
    </CareerProvider>
  );
}

function CpuRecruitmentTables() {
  const { career } = useCareer();
  const rivalClubs = careerClubsInCompetition(career, career.competitionId).filter((club) => club.id !== career.playerClubId);
  const [clubId, setClubId] = useState(rivalClubs[0]?.id ?? "");
  const ownClub = getClub(career.playerClubId);

  const assessment = clubId ? assessSquadNeeds(career, clubId, career.gameDate) : null;
  const plans = clubId ? getCpuRecruitmentPlansForClub(career, clubId) : [];
  const log = clubId ? getCpuDecisionLogForClub(career, clubId, 30) : [];

  return (
    <>
      <div className="hm-dev-panel">
        <div className="hm-dev-panel-body" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="hm-dev-muted">
            Karriär: <b>{ownClub?.name ?? career.playerClubId}</b> · <span className="hm-dev-num">{career.gameDate}</span>
          </span>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="hm-dev-muted">CPU-klubb</span>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)} disabled={rivalClubs.length === 0}>
              {rivalClubs.map((club) => (
                <option key={club.id} value={club.id}>{club.name}</option>
              ))}
            </select>
          </label>
          <Link href="/load-game" className="hm-dev-btn hm-dev-btn--sm">Byt karriär</Link>
          {rivalClubs.length === 0 ? <span className="hm-dev-warn">Inga CPU-klubbar i din serie den här säsongen.</span> : null}
        </div>
      </div>

      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head">
          <span className="hm-dev-panel-title">Beslutslogg</span>
          <span className="hm-dev-muted hm-dev-num">{log.length} senaste</span>
        </div>
        {log.length === 0 ? (
          <div className="hm-dev-empty">Inga loggade beslut ännu. Spela vidare några dagar så utvärderar klubben sin trupp.</div>
        ) : (
          <div className="hm-dev-table-wrap">
            <table className="hm-dev-table">
              <thead><tr><th>Datum</th><th>Beslut</th><th>Motivering</th></tr></thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.id}>
                    <td className="hm-dev-num">{entry.date}</td>
                    <td><b>{entry.summary}</b></td>
                    <td className="hm-dev-muted" style={{ whiteSpace: "normal" }}>{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Aktiva/senaste pursuits</span></div>
        {plans.length === 0 ? (
          <div className="hm-dev-empty">Ingen aktiv rekrytering just nu.</div>
        ) : (
          <div className="hm-dev-table-wrap">
            <table className="hm-dev-table">
              <thead><tr><th>Position</th><th>Behov</th><th>Status</th><th>Kandidat</th><th>Senast utvärderad</th><th>Motivering</th></tr></thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td><b>{plan.targetPosition}</b></td>
                    <td>{plan.need}</td>
                    <td>{plan.status}</td>
                    <td className="hm-dev-num">{plan.candidatePlayerId ?? "—"}</td>
                    <td className="hm-dev-num">{plan.lastEvaluatedAt}</td>
                    <td className="hm-dev-muted" style={{ whiteSpace: "normal" }}>{plan.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {assessment ? (
        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Positionsbehov</span></div>
          <div className="hm-dev-table-wrap">
            <table className="hm-dev-table">
              <thead><tr><th>Position</th><th>Behov</th><th className="hm-dev-num">Spelare</th><th>Motivering</th></tr></thead>
              <tbody>
                {assessment.positions.map((pos) => (
                  <tr key={pos.position}>
                    <td><b>{pos.position}</b></td>
                    <td className={NEED_TONE[pos.level] ?? ""}>{pos.level}</td>
                    <td className="hm-dev-num">{pos.usableCount}</td>
                    <td className="hm-dev-muted" style={{ whiteSpace: "normal" }}>{pos.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
