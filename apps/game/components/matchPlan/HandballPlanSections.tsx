"use client";
// HM-PLAYTEST-01 2.1-2.6: the handball match-plan sections of the tactics
// workspace. Every control here writes state the live match reads
// (lib/matchPlan/engineMatchPlan.ts -> engine matchPlanDirectives.ts), or
// state with a documented career effect (captaincy -> morale).
import type { CareerState } from "@/lib/career/types";
import type { PlayerMock } from "@/lib/game-data";
import type { MatchPlan, Position } from "@/lib/matchPlan/types";
import { defenceSystemKey, effectiveDefenceSpaces } from "@/lib/matchPlan/engineMatchPlan";
import { currentTeamRoles, leadershipOf, MAX_PENALTY_TAKERS, setCaptaincy, setPenaltyTakers, STEADYING_LEADERSHIP } from "@/lib/career/teamRoles";
import { matchFitnessOf } from "@/lib/players/matchFitness";

type Save = (edit: (current: MatchPlan) => MatchPlan) => void;
type UpdateCareer = (fn: (state: CareerState) => CareerState) => void;

const SIX_CODES = ["V6", "V9", "M9", "H9", "H6", "M6"] as const;
const CODE_LABEL: Record<string, string> = { V6: "V6 · vänstersexa", V9: "V9 · vänsternia", M9: "M9 · mittnia", H9: "H9 · högernia", H6: "H6 · högersexa", M6: "M6 · mittsexa/linjespelare" };
/** Screen order: as seen from behind our own goal, the defender's left on the left. */
const SPACE_ORDER = [5, 4, 3, 2, 1, 0] as const;
// STARKVIS Handbollsterminologi v0.1: 6-0 = V1, V2, V3, H3, H2, H1 (the
// defender's own left/right); 5-1 = 1:or, 2:or, centerhalv and the
// framskjuten center.
export const DEFENCE_SPACE_LABEL: Record<"6-0" | "5-1", Record<number, string>> = {
  "6-0": { 5: "V1 · vänster etta", 4: "V2 · vänster tvåa", 3: "V3 · vänster trea", 2: "H3 · höger trea", 1: "H2 · höger tvåa", 0: "H1 · höger etta" },
  "5-1": { 5: "V1 · vänster etta", 4: "V2 · vänster tvåa", 3: "Centerhalv (bakre)", 2: "Center (framskjuten)", 1: "H2 · höger tvåa", 0: "H1 · höger etta" },
};
const FIVE_SPACES = [5, 4, 2, 1, 0] as const;

const name = (p?: PlayerMock) => (p ? `${p.firstName} ${p.lastName}` : "—");

function PlayerSelect({ label, value, options, onChange, allowEmpty = true, emptyLabel = "Ingen" }: { label: string; value: string; options: readonly PlayerMock[]; onChange: (id: string) => void; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <label className="hm-plan-field">
      <span>{label}</span>
      <select className="hm-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((p) => <option key={p.id} value={p.id}>{p.shirtNumber ? `#${p.shirtNumber} ` : ""}{name(p)} · {p.position}</option>)}
      </select>
    </label>
  );
}

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section className="hm-plan-section" id={id} aria-labelledby={`${id}-title`}>
      <header><h2 id={`${id}-title`}>{title}</h2><p>{lede}</p></header>
      {children}
    </section>
  );
}

export function DefenceSection({ plan, squad, save }: { plan: MatchPlan; squad: readonly PlayerMock[]; save: Save }) {
  const key = defenceSystemKey(plan);
  const spaces = effectiveDefenceSpaces(plan);
  const six = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK" && s.playerId);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const atSpace = (zone: number) => six.find((s) => spaces[s.playerId] === zone)?.playerId ?? "";
  const partnerOf = (id: string) => plan.substitutionPairs.find((p) => p.attackPlayerId === id)?.defencePlayerId;
  const assign = (zone: number, playerId: string) => save((current) => {
    const now = effectiveDefenceSpaces(current);
    const from = now[playerId];
    const occupant = Object.keys(now).find((id) => now[id] === zone);
    const next = { ...now, [playerId]: zone, ...(occupant && occupant !== playerId && from !== undefined ? { [occupant]: from } : {}) };
    return { ...current, defenceAssignments: { ...current.defenceAssignments, [key]: next } };
  });
  return (
    <Section id="plan-defence" title={`Försvar 6 mot 6 · ${key === "5-1" ? "5–1" : "6–0"}`} lede="Vem försvarar var i den valda försvarsformationen. Byter du formation sparas en egen placering för den. Försvarsspecialister tar sin partners plats (se Byten).">
      <div className="hm-defence-line" data-system={key}>
        {SPACE_ORDER.map((zone) => {
          const id = atSpace(zone);
          const specialist = id ? partnerOf(id) : undefined;
          return (
            <div key={zone} className="hm-defence-space" data-front={key === "5-1" && zone === 2}>
              <span className="hm-eyebrow">{DEFENCE_SPACE_LABEL[key][zone]}</span>
              <select className="hm-select" value={id} aria-label={`Försvarare ${DEFENCE_SPACE_LABEL[key][zone]}`} onChange={(e) => assign(zone, e.target.value)}>
                {six.map((s) => <option key={s.playerId} value={s.playerId}>{name(byId.get(s.playerId))}</option>)}
              </select>
              {specialist && <small className="hm-text-muted">Försvarar: <strong>{name(byId.get(specialist))}</strong></small>}
            </div>
          );
        })}
      </div>
      <p className="hm-plan-note">Målvakt i försvar: {name(byId.get(plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId ?? ""))}.</p>
    </Section>
  );
}

export function SubstitutionSection({ plan, squad, save }: { plan: MatchPlan; squad: readonly PlayerMock[]; save: Save }) {
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  const registered = new Set(plan.squad.players.map((p) => p.playerId));
  const bench = squad.filter((p) => registered.has(p.id) && !starters.has(p.id) && p.position !== "MV");
  const byId = new Map(squad.map((p) => [p.id, p]));
  const setPair = (attackId: string, defenceId: string) => save((current) => ({
    ...current,
    substitutionPairs: [
      ...current.substitutionPairs.filter((p) => p.attackPlayerId !== attackId && p.defencePlayerId !== defenceId),
      ...(defenceId ? [{ attackPlayerId: attackId, defencePlayerId: defenceId }] : []),
    ],
  }));
  return (
    <Section id="plan-substitutions" title="Byten anfall–försvar" lede="Spelare A anfaller, spelare B försvarar på A:s plats. Bytet görs vid bollinnehavsbyte genom egen bytesplats, ett i taget, och aldrig med en utvisad eller skadad spelare. Endast uttagna bänkspelare kan väljas.">
      {bench.length === 0 && <p className="hm-plan-note" role="status">Inga utespelare på bänken – ta ut fler spelare i matchtruppen för att kunna göra försvarsbyten.</p>}
      <div className="hm-plan-grid">
        {plan.attackStartingUnit.slots.filter((s) => s.position !== "GK" && s.playerId).map((slot) => {
          const current = plan.substitutionPairs.find((p) => p.attackPlayerId === slot.playerId)?.defencePlayerId ?? "";
          const taken = new Set(plan.substitutionPairs.filter((p) => p.attackPlayerId !== slot.playerId).map((p) => p.defencePlayerId));
          return <PlayerSelect key={slot.playerId} label={`${slot.position} · ${name(byId.get(slot.playerId))} anfaller – i försvar:`} value={current} emptyLabel="Spelar även försvar" options={bench.filter((p) => !taken.has(p.id))} onChange={(id) => setPair(slot.playerId, id)} />;
        })}
      </div>
    </Section>
  );
}

export function SpecialistSection({ plan, squad, save }: { plan: MatchPlan; squad: readonly PlayerMock[]; save: Save }) {
  const registered = new Set(plan.squad.players.map((p) => p.playerId));
  const outfield = squad.filter((p) => registered.has(p.id) && p.position !== "MV");
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  const six = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK");
  const attack = plan.situationUnits?.ATTACK_6V5 ?? six.map((s) => ({ playerId: s.playerId, position: s.position as (typeof SIX_CODES)[number] }));
  const defence = plan.situationUnits?.DEFENCE_5V6 ?? [];
  const setAttack = (index: number, playerId: string) => save((current) => {
    const base = current.situationUnits?.ATTACK_6V5 ?? current.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => ({ playerId: s.playerId, position: s.position as (typeof SIX_CODES)[number] }));
    const swapped = base.map((e, i) => (i === index ? { ...e, playerId } : e.playerId === playerId ? { ...e, playerId: base[index].playerId } : e));
    return { ...current, situationUnits: { ...current.situationUnits, ATTACK_6V5: swapped } };
  });
  const setDefence = (index: number, playerId: string) => save((current) => {
    const base = [...(current.situationUnits?.DEFENCE_5V6 ?? FIVE_SPACES.map((zone) => ({ playerId: "", zone })))];
    const clash = base.findIndex((e, i) => i !== index && e.playerId === playerId);
    if (clash >= 0) base[clash] = { ...base[clash], playerId: base[index].playerId };
    base[index] = { ...base[index], playerId };
    return { ...current, situationUnits: { ...current.situationUnits, DEFENCE_5V6: base } };
  });
  const defenceComplete = defence.length === 5 && defence.every((e) => e.playerId) && new Set(defence.map((e) => e.playerId)).size === 5;
  return (
    <Section id="plan-special" title="Specialsituationer" lede="Sparade uppställningar för numerärt övertag och undertag. Matchen byter in dem en spelare i taget via bytesplatsen när situationen uppstår.">
      <div className="hm-plan-columns">
        <div>
          <h3>Anfall 6 mot 5 · numerärt övertag <span className="hm-status" data-tone={plan.situationUnits?.ATTACK_6V5 ? "ok" : "neutral"}>{plan.situationUnits?.ATTACK_6V5 ? "Egen uppställning" : "Startsjuan"}</span></h3>
          <p className="hm-plan-note">När motståndarna har en spelare utvisad och vi anfaller.</p>
          {attack.map((entry, i) => <PlayerSelect key={entry.position} label={CODE_LABEL[entry.position] ?? entry.position} value={entry.playerId} allowEmpty={false} options={outfield} onChange={(id) => setAttack(i, id)} />)}
          {plan.situationUnits?.ATTACK_6V5 && <button type="button" className="hm-btn hm-btn-sm" onClick={() => save((c) => ({ ...c, situationUnits: { ...c.situationUnits, ATTACK_6V5: undefined } }))}>Använd startsjuan</button>}
        </div>
        <div>
          <h3>Försvar 5 mot 6 · numerärt undertag <span className="hm-status" data-tone={defenceComplete ? "ok" : "neutral"}>{defenceComplete ? "Egen uppställning" : "Ej vald – laget behåller de som är på plan"}</span></h3>
          <p className="hm-plan-note">När vi har en spelare utvisad och försvarar. Välj fem olika utespelare.</p>
          {FIVE_SPACES.map((zone, i) => <PlayerSelect key={zone} label={zone === 2 ? "Mitt · centralt i femmannalinjen" : DEFENCE_SPACE_LABEL["6-0"][zone]} value={defence[i]?.playerId ?? ""} emptyLabel="Välj spelare" options={outfield} onChange={(id) => setDefence(i, id)} />)}
          {defence.length > 0 && <button type="button" className="hm-btn hm-btn-sm" onClick={() => save((c) => ({ ...c, situationUnits: { ...c.situationUnits, DEFENCE_5V6: undefined } }))}>Rensa</button>}
        </div>
        <div>
          <h3>Anfall 7 mot 6</h3>
          <p className="hm-plan-note">Målvakten går ut för en sjunde utespelare enligt inställningen "7 mot 6" under Anfall. Välj vem som går in.</p>
          <PlayerSelect label="Sjunde utespelare" value={plan.sevenVSixPlayerId ?? ""} emptyLabel="Assistenten väljer (bästa linjespelare)" options={outfield.filter((p) => !starters.has(p.id))} onChange={(id) => save((c) => ({ ...c, sevenVSixPlayerId: id || undefined }))} />
          <h3>Försvar 6 mot 7</h3>
          <p className="hm-plan-note">Motståndarlagen i den här versionen spelar inte 7 mot 6, så ingen separat uppställning sparas – laget försvarar med sin vanliga försvarsuppställning.</p>
        </div>
      </div>
    </Section>
  );
}

export function SetPieceSection({ career, squad, updateCareer }: { career: CareerState; squad: readonly PlayerMock[]; updateCareer: UpdateCareer }) {
  const roles = currentTeamRoles(career);
  const outfield = squad.filter((p) => p.position !== "MV");
  const order = [...roles.penaltyTakers];
  const set = (index: number, id: string) => {
    const next = [...order];
    next[index] = id;
    updateCareer((s) => setPenaltyTakers(s, next.filter(Boolean)));
  };
  return (
    <Section id="plan-setpieces" title="Fasta situationer · 7-meter" lede="Straffläggarordningen gäller i varje match tills du ändrar den. Den första i ordningen som står på planen slår; annars nästa. Utan ordning väljer laget mittnian.">
      <div className="hm-plan-grid">
        {Array.from({ length: MAX_PENALTY_TAKERS }, (_, i) => <PlayerSelect key={i} label={i === 0 ? "Förstaval" : `Reserv ${i}`} value={order[i] ?? ""} emptyLabel={i === 0 ? "Lagets standard (mittnian)" : "Ingen"} options={outfield.filter((p) => !order.includes(p.id) || order[i] === p.id)} onChange={(id) => set(i, id)} />)}
      </div>
    </Section>
  );
}

export function LeadershipSection({ career, squad, updateCareer }: { career: CareerState; squad: readonly PlayerMock[]; updateCareer: UpdateCareer }) {
  const roles = currentTeamRoles(career);
  const leadership = (id?: string) => (id ? leadershipOf(career, id) : null);
  const captainLeadership = leadership(roles.captainId);
  return (
    <Section id="plan-leadership" title="Ledarskap" lede="Kapten och vice kapten gäller över matcher och säsonger. Effekterna är små och förklarade: utnämningen lyfter spelarens moral en tid, att frånta någon bindeln sänker den, och en kapten med starkt ledarskap dämpar lagets moraltapp i en förlustsvit.">
      <div className="hm-plan-grid">
        <PlayerSelect label="Lagkapten" value={roles.captainId ?? ""} emptyLabel="Ingen utsedd" options={squad} onChange={(id) => updateCareer((s) => setCaptaincy(s, "CAPTAIN", id || null))} />
        <PlayerSelect label="Vice kapten" value={roles.viceCaptainId ?? ""} emptyLabel="Ingen utsedd" options={squad.filter((p) => p.id !== roles.captainId)} onChange={(id) => updateCareer((s) => setCaptaincy(s, "VICE", id || null))} />
      </div>
      {roles.captainId && <p className="hm-plan-note">{captainLeadership === null ? "Kaptenens ledarskap är inte bedömt i spelardatan – utnämningen påverkar bara hans egen moral." : captainLeadership >= STEADYING_LEADERSHIP ? `Ledarskap ${Math.round(captainLeadership)}/20 – håller ihop gruppen i motgång.` : `Ledarskap ${Math.round(captainLeadership)}/20 – för lågt för att dämpa lagets moraltapp i motgång (kräver ${STEADYING_LEADERSHIP}).`}</p>}
    </Section>
  );
}

/** Compact "who plays where" overview used at the top of the workspace. */
export function PlanSummary({ career, plan, squad }: { career: CareerState; plan: MatchPlan; squad: readonly PlayerMock[] }) {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const roles = currentTeamRoles(career);
  const registered = plan.squad.players.length;
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId).filter(Boolean));
  const unfit = plan.squad.players.filter((p) => matchFitnessOf(career, p.playerId) < 50).length;
  const items: [string, string][] = [
    ["Matchtrupp", `${registered} av 16 · ${Math.max(0, registered - starters.size)} på bänken`],
    ["Försvar", `${defenceSystemKey(plan) === "5-1" ? "5–1" : "6–0"} · ${plan.substitutionPairs.length} försvarsbyten`],
    ["Specialsituationer", [plan.situationUnits?.ATTACK_6V5 ? "6 mot 5" : null, plan.situationUnits?.DEFENCE_5V6?.every((e) => e.playerId) ? "5 mot 6" : null, plan.sevenVSixPlayerId ? "7 mot 6" : null].filter(Boolean).join(" · ") || "Standard"],
    ["7-meter", roles.penaltyTakers.length ? roles.penaltyTakers.map((id) => byId.get(id)?.lastName ?? "?").join(" → ") : "Lagets standard"],
    ["Kapten", roles.captainId ? `${byId.get(roles.captainId)?.lastName ?? "?"}${roles.viceCaptainId ? ` · vice ${byId.get(roles.viceCaptainId)?.lastName ?? "?"}` : ""}` : "Ingen utsedd"],
    ["Matchträning", unfit ? `${unfit} uttagna under 50 %` : "Inga uttagna under 50 %"],
  ];
  return <dl className="hm-plan-summary">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export const PLAN_SECTIONS: readonly { id: string; label: string }[] = [
  { id: "plan-attack", label: "Anfall" },
  { id: "plan-defence", label: "Försvar" },
  { id: "plan-substitutions", label: "Byten" },
  { id: "plan-special", label: "Specialsituationer" },
  { id: "plan-setpieces", label: "Fasta situationer" },
  { id: "plan-leadership", label: "Ledarskap" },
  { id: "plan-squad", label: "Matchtrupp" },
];
export type { Position };
