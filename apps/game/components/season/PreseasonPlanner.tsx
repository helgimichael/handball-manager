"use client";
// HM-PLAYTEST-01 3.1: plan the preseason -- friendlies (single or a
// programme), training camps, trips abroad and friendly tournaments.
import { useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { CLUBS, getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { CAMP_LOCATIONS, MAX_CAMP_DAYS, planFriendly, planFriendlyTournament, planTrainingCamp, preseasonEvents, PRESEASON_COSTS, TRIP_LOCATIONS, type FriendlyVenue, type PlanResult } from "@/lib/career/preseasonPlanning";
import type { CareerState } from "@/lib/career/types";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink } from "@/components/entityLinks";

type Tab = "FRIENDLY" | "CAMP" | "TOURNAMENT";
const VENUE_LABEL: Record<FriendlyVenue, string> = { HOME: "Hemma", AWAY: "Borta", NEUTRAL: "Neutral plan" };

export function PreseasonPlanner() {
  const { career, updateCareer } = useCareer();
  const money = useMoney();
  const [tab, setTab] = useState<Tab>("FRIENDLY");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const opponents = CLUBS.filter((c) => c.id !== career.playerClubId && c.playable).sort((a, b) => a.name.localeCompare(b.name, "sv"));
  // Friendly
  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState(opponents[0]?.id ?? "");
  const [venue, setVenue] = useState<FriendlyVenue>("HOME");
  const [location, setLocation] = useState("");
  // Camp / trip
  const [campKind, setCampKind] = useState<"CAMP" | "TRIP">("CAMP");
  const [campLocation, setCampLocation] = useState<string>(CAMP_LOCATIONS[1]);
  const [campStart, setCampStart] = useState("");
  const [campDays, setCampDays] = useState(4);
  // Tournament
  const [tStart, setTStart] = useState("");
  const [tLocation, setTLocation] = useState("");
  const [tOpponents, setTOpponents] = useState<string[]>([opponents[0]?.id ?? "", opponents[1]?.id ?? "", ""]);

  const cash = career.clubEconomies?.[career.playerClubId]?.cashEur;
  function apply(plan: (s: CareerState) => PlanResult, success: string) {
    const preview = plan(career);
    if (!preview.ok) { setMessage({ ok: false, text: preview.error }); return; }
    updateCareer((s) => { const r = plan(s); return r.ok ? r.state : s; });
    setMessage({ ok: true, text: `${success}${preview.costEur ? ` Kostnad: ${money.format(preview.costEur)} (uppskattad), dragen från kassan.` : ""}` });
  }
  const campCost = campKind === "TRIP" ? PRESEASON_COSTS.tripTravel + PRESEASON_COSTS.tripPerDay * campDays : PRESEASON_COSTS.campPerDay * campDays;
  const friendlyCost = venue === "HOME" ? PRESEASON_COSTS.friendlyHome : venue === "AWAY" ? PRESEASON_COSTS.friendlyAway : PRESEASON_COSTS.friendlyNeutral;
  const friendlies = career.fixtures.filter((f) => f.type === "FRIENDLY" && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId)).sort((a, b) => a.date.localeCompare(b.date));
  const events = preseasonEvents(career);
  const selectedOpponentClub = getClub(opponent);

  return (
    <section className="hm-plan-section" aria-labelledby="preseason-title">
      <header>
        <h2 id="preseason-title">Försäsongsplanering</h2>
        <p>
          Boka träningsmatcher, läger, träningsresor och turneringar. Allt hamnar i kalendern, krockar med tävlingsmatcher stoppas och kostnaden dras från kassan
          {typeof cash === "number" ? ` (i kassan nu: ${money.format(cash)})` : ""}. Träningsmatcher bygger matchträning.
        </p>
      </header>
      <div className="hm-subnav" role="tablist">
        {(["FRIENDLY", "CAMP", "TOURNAMENT"] as Tab[]).map((t) => (
          <a
            key={t}
            role="tab"
            href="#preseason-title"
            aria-current={tab === t ? "page" : undefined}
            aria-selected={tab === t}
            onClick={(e) => {
              e.preventDefault();
              setTab(t);
              setMessage(null);
            }}
          >
            {t === "FRIENDLY" ? "Träningsmatch" : t === "CAMP" ? "Läger / resa" : "Turnering"}
          </a>
        ))}
      </div>
      {tab === "FRIENDLY" && (
        <div className="hm-plan-grid">
          <label className="hm-plan-field">
            <span>Datum</span>
            <input type="date" className="hm-input" value={date} min={career.gameDate} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="hm-plan-field">
            <span>Motståndare</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedOpponentClub && (
                <ClubCrest
                  clubId={selectedOpponentClub.id}
                  shortName={selectedOpponentClub.shortName}
                  primaryColor={selectedOpponentClub.primaryColor}
                  size={28}
                />
              )}
              <select className="hm-select" style={{ flex: 1 }} value={opponent} onChange={(e) => setOpponent(e.target.value)}>
                {opponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="hm-plan-field">
            <span>Spelplats</span>
            <select className="hm-select" value={venue} onChange={(e) => setVenue(e.target.value as FriendlyVenue)}>
              {(Object.keys(VENUE_LABEL) as FriendlyVenue[]).map((v) => (
                <option key={v} value={v}>
                  {VENUE_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          {venue === "NEUTRAL" && (
            <label className="hm-plan-field">
              <span>Ort</span>
              <input className="hm-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="t.ex. Halmstad" />
            </label>
          )}
          <div className="hm-plan-field">
            <span>Uppskattad kostnad: {money.format(friendlyCost)}</span>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              onClick={() => apply((s) => planFriendly(s, { date, opponentClubId: opponent, venue, location }), "Träningsmatchen är bokad.")}
            >
              Boka träningsmatch
            </button>
          </div>
        </div>
      )}
      {tab === "CAMP" && (
        <div className="hm-plan-grid">
          <label className="hm-plan-field">
            <span>Typ</span>
            <select
              className="hm-select"
              value={campKind}
              onChange={(e) => {
                const k = e.target.value as "CAMP" | "TRIP";
                setCampKind(k);
                setCampLocation(k === "TRIP" ? TRIP_LOCATIONS[0] : CAMP_LOCATIONS[1]);
              }}
            >
              <option value="CAMP">Träningsläger i Sverige</option>
              <option value="TRIP">Träningsresa utomlands</option>
            </select>
          </label>
          <label className="hm-plan-field">
            <span>Plats</span>
            <select className="hm-select" value={campLocation} onChange={(e) => setCampLocation(e.target.value)}>
              {(campKind === "TRIP" ? TRIP_LOCATIONS : CAMP_LOCATIONS).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="hm-plan-field">
            <span>Första dag</span>
            <input type="date" className="hm-input" value={campStart} min={career.gameDate} onChange={(e) => setCampStart(e.target.value)} />
          </label>
          <label className="hm-plan-field">
            <span>Antal dagar (1–{MAX_CAMP_DAYS})</span>
            <input
              type="number"
              className="hm-input"
              min={1}
              max={MAX_CAMP_DAYS}
              value={campDays}
              onChange={(e) => setCampDays(Number(e.target.value) || 1)}
            />
          </label>
          <div className="hm-plan-field">
            <span>Uppskattad kostnad: {money.format(campCost)}</span>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              onClick={() =>
                apply(
                  (s) => planTrainingCamp(s, { kind: campKind, location: campLocation, startDate: campStart, days: campDays }),
                  campKind === "TRIP" ? "Träningsresan är bokad." : "Lägret är bokat."
                )
              }
            >
              Boka {campKind === "TRIP" ? "träningsresa" : "läger"}
            </button>
          </div>
          <p className="hm-plan-note">
            Under lägret tränar laget matchlikt varje dag: matchträningen kan byggas till en högre nivå än vanlig träning, och gruppen får ett litet moralpåslag när lägret är slut. Inga matcher kan bokas under lägret.
          </p>
        </div>
      )}
      {tab === "TOURNAMENT" && (
        <div className="hm-plan-grid">
          <label className="hm-plan-field">
            <span>Första matchdag</span>
            <input type="date" className="hm-input" value={tStart} min={career.gameDate} onChange={(e) => setTStart(e.target.value)} />
          </label>
          <label className="hm-plan-field">
            <span>Ort</span>
            <input className="hm-input" value={tLocation} onChange={(e) => setTLocation(e.target.value)} placeholder="t.ex. Partille" />
          </label>
          {tOpponents.map((id, i) => (
            <label key={i} className="hm-plan-field">
              <span>
                Motståndare {i + 1}
                {i === 2 ? " (valfri)" : ""}
              </span>
              <select
                className="hm-select"
                value={id}
                onChange={(e) => setTOpponents((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              >
                {i === 2 && <option value="">Ingen</option>}
                {opponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="hm-plan-field">
            <span>Uppskattad kostnad: {money.format(PRESEASON_COSTS.tournamentEntry + PRESEASON_COSTS.friendlyNeutral)}</span>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              onClick={() =>
                apply(
                  (s) =>
                    planFriendlyTournament(s, {
                      name: tLocation ? `Träningsturnering i ${tLocation}` : "Träningsturnering",
                      location: tLocation || "Neutral ort",
                      startDate: tStart,
                      opponentClubIds: tOpponents,
                    }),
                  "Turneringen är bokad – en match per dag."
                )
              }
            >
              Boka turnering
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="hm-status" data-tone={message.ok ? "ok" : "bad"}>
          {message.text}
        </p>
      )}
      {(friendlies.length > 0 || events.length > 0) && (
        <>
          <h3>Planerat</h3>
          <ul className="hm-link-list">
            {events.map((e) => (
              <li key={e.id}>
                <span>
                  <b>{e.name}</b> · {e.startDate}
                  {e.endDate !== e.startDate ? `–${e.endDate}` : ""}
                </span>
                <span className="hm-text-muted">{money.format(e.costEur)}</span>
              </li>
            ))}
            {friendlies.map((f) => {
              const oppId = f.homeClubId === career.playerClubId ? f.awayClubId : f.homeClubId;
              const res = career.results[f.id];
              return (
                <li key={f.id}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{f.date} · Träningsmatch mot</span>
                    <ClubLink clubId={oppId}>{getClub(oppId)?.name ?? oppId}</ClubLink>
                    <span>· {f.location ? f.location : f.homeClubId === career.playerClubId ? "hemma" : "borta"}</span>
                  </span>
                  <span className="hm-text-muted">{res ? `${res.homeGoals}–${res.awayGoals}` : "Ej spelad"}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
