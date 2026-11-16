"use client";
// Arena 231 -- ENT-03a A 'Världen' advanced drawer + ENT-03b A league pyramid + ENT-03c A summary folded into the
// drawer footer. The nation/league choices themselves are unchanged (same state, same toggles as the old steps
// 1-3); they simply live here instead of being three wizard steps before the club.
import { useEffect, useRef } from "react";
import { NationFlag } from "@/components/game/NationFlag";
import { COMPETITIONS, NATIONS, type Club, type NationCode } from "@/lib/game-data";

export const DEFAULT_NATIONS: NationCode[] = ["SWE"];
export const DEFAULT_COMPETITIONS = ["se_handbollsligan_herr", "swe-2"];

/** Counts for the drawer footer and the Världen chip; computed by the New Game page from its own club lists. */
export type WorldSummary = { nations: number; leagues: number; clubs: number; playable: number };
/** Per league: its clubs and how many a human may lead (B-team rule applied by the page). */
export type LeagueClubs = Readonly<Record<string, { clubs: readonly Club[]; playable: number }>>;

export function worldSummaryText(s: WorldSummary): string {
  return `${s.nations} ${s.nations === 1 ? "nation" : "nationer"} · ${s.leagues} ${s.leagues === 1 ? "liga" : "ligor"} · ${s.clubs} klubbar · ${s.playable} spelbara`;
}

export default function WorldDrawer({ open, nations, competitionIds, summary, leagueClubs, onToggleNation, onToggleCompetition, onReset, onClose }: {
  open: boolean;
  nations: readonly NationCode[];
  competitionIds: readonly string[];
  summary: WorldSummary;
  leagueClubs: LeagueClubs;
  onToggleNation: (code: NationCode) => void;
  onToggleCompetition: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const isDefault = nations.length === DEFAULT_NATIONS.length && DEFAULT_NATIONS.every((n) => nations.includes(n)) && competitionIds.length === DEFAULT_COMPETITIONS.length && DEFAULT_COMPETITIONS.every((c) => competitionIds.includes(c));

  return <dialog ref={dialog} className="ce-drawer" aria-labelledby="ce-world-title" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ce-drawer-panel">
      <header className="ce-drawer-head">
        <div><span className="ce-kicker">Avancerat</span><h2 id="ce-world-title">Världen</h2><p>Vilka nationer och ligor som simuleras i din karriär. Ligavalet styr vilka klubbar du kan välja.</p></div>
        <button type="button" className="ce-icon-btn" onClick={onClose} aria-label="Stäng Världen">×</button>
      </header>
      <div className="ce-drawer-body">
        <section aria-labelledby="ce-nations-title">
          <h3 id="ce-nations-title" className="ce-kicker">Nationer</h3>
          <ul className="ce-toggle-list">
            {NATIONS.map((nation) => {
              const leagues = COMPETITIONS.filter((c) => c.nation === nation.code && !c.outsideCareerWorld);
              const on = nations.includes(nation.code);
              return <li key={nation.code}><label className="ce-toggle-row" data-on={on}>
                <input type="checkbox" aria-label={nation.name} checked={on} onChange={() => onToggleNation(nation.code)} />
                <span className="ce-toggle-name"><NationFlag code={nation.code} /> {nation.name}</span>
                <small className="ce-num">{leagues.length} {leagues.length === 1 ? "liga" : "ligor"}</small>
              </label></li>;
            })}
          </ul>
        </section>
        {nations.length === 0 && <p className="ce-drawer-warn" role="status">Välj minst en nation.</p>}
        {nations.map((code) => <LeaguePyramid key={code} nation={code} competitionIds={competitionIds} leagueClubs={leagueClubs} onToggle={onToggleCompetition} />)}
        {nations.length > 0 && competitionIds.length === 0 && <p className="ce-drawer-warn" role="status">Välj minst en liga.</p>}
        {summary.playable === 0 && competitionIds.length > 0 && <p className="ce-drawer-warn" role="status">Ingen spelbar klubb i dina ligaval ännu. Välj Handbollsligan eller Allsvenskan i Sverige för att börja en karriär.</p>}
      </div>
      <footer className="ce-drawer-foot">
        <p className="ce-num" aria-live="polite">{worldSummaryText(summary)}</p>
        <div><button type="button" className="hm-btn hm-btn-sm" onClick={onReset} disabled={isDefault}>Återställ standard</button><button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onClose}>Klar</button></div>
      </footer>
    </div>
  </dialog>;
}

/** ENT-03b A: a nation's leagues as a stacked pyramid -- top tier first, a kval arrow between tiers. */
function LeaguePyramid({ nation, competitionIds, leagueClubs, onToggle }: { nation: NationCode; competitionIds: readonly string[]; leagueClubs: LeagueClubs; onToggle: (id: string) => void }) {
  const leagues = COMPETITIONS.filter((c) => c.nation === nation && !c.outsideCareerWorld);
  const tiers = [...new Set(leagues.map((c) => c.tier))].sort((a, b) => a - b);
  const name = NATIONS.find((n) => n.code === nation)?.name ?? nation;
  if (!leagues.length) return null;
  return <section className="ce-pyramid" aria-label={`Ligor i ${name}`}>
    <h3 className="ce-kicker">{name} · ligapyramid</h3>
    <ol>
      {tiers.map((tier, i) => <li key={tier} style={{ ["--indent" as string]: i }}>
        {i > 0 && <span className="ce-kval" title={`Upp- och nedflyttning: efter säsongen byter lag plats mellan nivå ${tiers[i - 1]} och nivå ${tier}, direkt eller via kval.`} aria-label={`Upp- och nedflyttning mellan nivå ${tiers[i - 1]} och ${tier}`}>⇅ kval</span>}
        <div className="ce-tier">
          <span className="ce-tier-no ce-num" aria-hidden="true">{tier}</span>
          <div className="ce-tier-rows">
            {leagues.filter((c) => c.tier === tier).map((c) => {
              const clubs = leagueClubs[c.id]?.clubs ?? [];
              const playable = leagueClubs[c.id]?.playable ?? 0;
              const on = competitionIds.includes(c.id);
              return <label key={c.id} className="ce-toggle-row" data-on={on}>
                <input type="checkbox" aria-label={c.name} checked={on} onChange={() => onToggle(c.id)} />
                <span className="ce-toggle-name">{c.name}</span>
                <small className="ce-num">{clubs.length} klubbar{playable ? ` · ${playable} spelbara` : ""}</small>
              </label>;
            })}
          </div>
        </div>
      </li>)}
    </ol>
  </section>;
}
