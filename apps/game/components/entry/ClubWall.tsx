"use client";
// Arena 231 -- ENT-03d C "Club Wall by ambition": every playable club as a colour tile (kit colour field,
// secondary stripe, crest, name, town) with three micro-meters (Förväntan, Truppstyrka ±, Ekonomi), filtered by
// the story it offers (Vinna / Utmana / Överleva) and by league. 'Jämför' pins up to three tiles side by side.
// Selection stays a native radio group named by the club (e2e + a11y); the playable list is decided by the caller.
import { useMemo, useState, type CSSProperties } from "react";
import ClubCrest from "@/components/ClubCrest";
import { clubVisualIdentity, type Club, type Competition } from "@/lib/game-data";
import type { ClubPreseasonContext } from "@/lib/newGame/clubSelectionContext";
import { AMBITION_LABEL, AMBITION_NOTE, ambitionCounts, ambitionOf, expectationMeter, filterWall, strengthMeter, type AmbitionFilter } from "./clubWallModel";

const FILTERS: AmbitionFilter[] = ["ALLA", "VINNA", "UTMANA", "OVERLEVA"];

export function tileStyle(club: Pick<Club, "id" | "primaryColor">): CSSProperties {
  const v = clubVisualIdentity(club.id);
  return {
    ["--tile-primary" as string]: v.kit?.primary ?? club.primaryColor ?? "var(--arena-solid-3)",
    ["--tile-secondary" as string]: v.kit?.secondary ?? v.neon,
    ["--tile-neon" as string]: v.neon,
  };
}

export default function ClubWall({ clubs: clubList, worldClubs, competitions, leagueOf, contexts, selectedId, onSelect, onHover }: {
  clubs: readonly Club[];
  /** Each club's league, resolved by the New Game page (the reviewed static-catalogue read). */
  leagueOf: (clubId: string) => string;
  worldClubs: readonly Club[];
  competitions: readonly Competition[];
  contexts: Readonly<Record<string, ClubPreseasonContext>>;
  selectedId: string;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const clubs = useMemo(() => clubList.map((x) => Object.assign({}, x, { leagueId: leagueOf(x.id) })), [clubList, leagueOf]);
  const [ambition, setAmbition] = useState<AmbitionFilter>("ALLA");
  const [league, setLeague] = useState<string>("ALLA");
  const [compare, setCompare] = useState<string[]>([]);
  const leagues = useMemo(() => competitions.filter((c) => clubs.some((x) => x.leagueId === c.id)), [competitions, clubs]);
  const activeLeague = league !== "ALLA" && !leagues.some((l) => l.id === league) ? "ALLA" : league;
  const counts = ambitionCounts(clubs, contexts, activeLeague);
  const shown = filterWall(clubs, contexts, ambition, activeLeague);
  const compared = compare.map((id) => clubs.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  const toggleCompare = (id: string) => setCompare((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]);
  const loading = clubs.length > 0 && Object.keys(contexts).length === 0;

  return <div className="ce-wall">
    <div className="ce-wall-filters">
      <div className="ce-wall-tabs" role="group" aria-label="Utmaning">
        {FILTERS.map((f) => <button key={f} type="button" aria-pressed={ambition === f} onClick={() => setAmbition(f)} disabled={f !== "ALLA" && counts[f] === 0}>
          {AMBITION_LABEL[f]} <span className="ce-num">{counts[f]}</span>
        </button>)}
      </div>
      {leagues.length > 1 && <div className="ce-wall-tabs ce-wall-league" role="group" aria-label="Serie">
        <button type="button" aria-pressed={activeLeague === "ALLA"} onClick={() => setLeague("ALLA")}>Alla serier</button>
        {leagues.map((l) => <button key={l.id} type="button" aria-pressed={activeLeague === l.id} onClick={() => setLeague(l.id)}>{l.name}</button>)}
      </div>}
    </div>
    {ambition !== "ALLA" && <p className="ce-wall-note">{AMBITION_NOTE[ambition]}</p>}
    {loading && <p className="ce-wall-note" role="status">Hämtar förhandstips, truppstyrka och ekonomi för klubbarna…</p>}

    {compared.length > 0 && <section className="ce-compare" aria-label="Jämförelse">
      <header><span className="ce-kicker">Jämför · {compared.length} av 3</span><button type="button" className="ce-link" onClick={() => setCompare([])}>Rensa</button></header>
      <div className="ce-compare-grid" style={{ ["--cols" as string]: compared.length }}>
        {compared.map((club) => { const c = contexts[club.id]; return <article key={club.id} style={tileStyle(club)}>
          <div className="ce-compare-head"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={32} /><strong>{club.shortName}</strong></div>
          <dl>
            <div><dt>Förhandstips</dt><dd>{c ? `${c.predicted}:a av ${c.clubsInLeague}` : "—"}</dd></div>
            <div><dt>Förväntan</dt><dd>{c?.expectation ?? "—"}</dd></div>
            <div><dt>Truppstyrka</dt><dd className="ce-num">{c ? `${c.strengthVsLeague > 0 ? "+" : ""}${c.strengthVsLeague.toFixed(1)}` : "—"}</dd></div>
            <div><dt>Ekonomi</dt><dd>{c?.economyLabel ?? "—"}</dd></div>
            <div><dt>Arena</dt><dd>{club.venue ?? "Inte verifierad"}</dd></div>
          </dl>
          <button type="button" className="hm-btn hm-btn-sm" onClick={() => onSelect(club.id)} aria-pressed={selectedId === club.id}>{selectedId === club.id ? "✓ Vald" : "Välj"}</button>
        </article>; })}
      </div>
    </section>}

    {shown.length ? <fieldset className="career-club-fieldset">
      <legend className="career-entry-sr-only">Välj klubb</legend>
      <div className="ce-wall-grid">
        {shown.map((club) => {
          const c = contexts[club.id];
          const a = ambitionOf(c);
          const selected = selectedId === club.id;
          const pinned = compare.includes(club.id);
          return <div key={club.id} className="ce-tile" data-selected={selected} style={tileStyle(club)} onMouseEnter={() => onHover?.(club.id)} onMouseLeave={() => onHover?.(null)}>
            <label className="ce-tile-main">
              <input className="career-choice-input" type="radio" name="careerClub" aria-label={club.name} checked={selected} onChange={() => onSelect(club.id)} onFocus={() => onHover?.(club.id)} onBlur={() => onHover?.(null)} />
              <span className="ce-tile-field" aria-hidden="true"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={52} /></span>
              <span className="ce-tile-body">
                <strong className="ce-tile-name">{club.name}</strong>
                <small>{club.city ?? competitions.find((l) => l.id === club.leagueId)?.name}</small>
                {a && <span className="ce-tile-ambition" data-ambition={a}>{AMBITION_LABEL[a]}</span>}
              </span>
              <span className="ce-tile-state" aria-hidden="true">{selected ? "✓ Din klubb" : ""}</span>
            </label>
            {c ? <dl className="ce-meters">
              <Meter label="Förväntan" value={expectationMeter(c)} text={`${c.predicted}:a`} title={c.expectation} />
              <Meter label="Trupp" value={strengthMeter(c.strengthVsLeague)} text={`${c.strengthVsLeague > 0 ? "+" : ""}${c.strengthVsLeague.toFixed(1)}`} title="Truppstyrka mot serien" centered />
              <div className="ce-meter ce-meter-text"><dt>Ekonomi</dt><dd>{c.economyLabel}</dd></div>
            </dl> : <p className="ce-meters ce-meters-empty">{loading ? "Läser klubbens läge…" : "Förhandsdata saknas för den här serien."}</p>}
            {selected && <div className="ce-tile-expanded">
              <span>{club.venue ? `${club.venue}${club.venueCapacity ? ` · ${club.venueCapacity.toLocaleString("sv-SE")} platser` : ""}` : "Arena inte verifierad"}</span>
              {c && <span>Styrelsen: ”{c.expectation}”</span>}
            </div>}
            <button type="button" className="ce-tile-compare" aria-pressed={pinned} disabled={!pinned && compare.length >= 3} onClick={() => toggleCompare(club.id)} title={!pinned && compare.length >= 3 ? "Du kan jämföra högst tre klubbar" : undefined}>
              {pinned ? "✓ Jämförs" : "Jämför"}
            </button>
          </div>;
        })}
      </div>
    </fieldset> : <div className="ce-empty">
      <strong>{clubs.length ? "Ingen klubb i det urvalet." : "Ingen spelbar klubb i dina ligaval."}</strong>
      <p>{clubs.length ? "Välj en annan utmaning eller serie." : "Öppna Världen och välj Handbollsligan eller Allsvenskan i Sverige."}</p>
      {clubs.length > 0 && <button type="button" className="hm-btn hm-btn-sm" onClick={() => { setAmbition("ALLA"); setLeague("ALLA"); }}>Visa alla klubbar</button>}
    </div>}

    {worldClubs.length > 0 && <section className="ce-world-strip" aria-label="Övriga klubbar i världen">
      <span className="ce-kicker">Övriga klubbar i världen · {worldClubs.length} · kan inte väljas</span>
      <ul>{worldClubs.map((club) => <li key={club.id} title={`${club.name} · ${competitions.find((l) => l.id === leagueOf(club.id))?.name ?? ""}`}><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={26} /><span>{club.shortName}</span></li>)}</ul>
    </section>}
  </div>;
}

function Meter({ label, value, text, title, centered = false }: { label: string; value: number; text: string; title: string; centered?: boolean }) {
  return <div className="ce-meter" title={title}>
    <dt>{label}</dt>
    <dd><span className="ce-meter-bar" data-centered={centered} aria-hidden="true"><i style={{ ["--v" as string]: value }} /></span><span className="ce-num">{text}</span></dd>
  </div>;
}
