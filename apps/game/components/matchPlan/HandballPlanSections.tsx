"use client";
// HM-PLAYTEST-01 2.1-2.6 + HM-RICH-EXPERIENCE-01 Stage C: the handball
// match-plan sections of the tactics workspace with visual role cards,
// drag-and-drop dropzones, and synchronized court-mode links.
import type { DragEvent, ReactNode } from "react";
import type { CareerState } from "@/lib/career/types";
import type { PlayerMock } from "@/lib/game-data";
import type { MatchPlan, Position } from "@/lib/matchPlan/types";
import { defenceSystemKey, effectiveDefenceSpaces } from "@/lib/matchPlan/engineMatchPlan";
import { currentTeamRoles, leadershipOf, MAX_PENALTY_TAKERS, setCaptaincy, setPenaltyTakers, STEADYING_LEADERSHIP } from "@/lib/career/teamRoles";
import { matchFitnessOf } from "@/lib/players/matchFitness";
import { PlayerGlyph } from "@/components/game/Identity";
import { NationFlag } from "@/components/game/NationFlag";

export type TacticalCourtMode =
  | "ATTACK_6V6"
  | "DEFENCE_6V6"
  | "EXCHANGES"
  | "ATTACK_6V5"
  | "DEFENCE_5V6"
  | "ATTACK_7V6";

export const TACTICAL_DRAG_PLAYER_MIME = "text/hm-player-id";

type Save = (edit: (current: MatchPlan) => MatchPlan) => void;
type UpdateCareer = (fn: (state: CareerState) => CareerState) => void;

export type SixCode = "V6" | "V9" | "M9" | "H9" | "H6" | "M6";
export const COURT_ORDER: readonly SixCode[] = ["V6", "V9", "M9", "H9", "H6", "M6"];
export const CODE_LABEL: Record<string, string> = {
  V6: "V6 · vänstersexa",
  V9: "V9 · vänsternia",
  M9: "M9 · mittnia",
  H9: "H9 · högernia",
  H6: "H6 · högersexa",
  M6: "M6 · mittsexa/linjespelare",
};
/** Screen order: as seen from behind our own goal, the defender's left on the left. */
export const SPACE_ORDER = [5, 4, 3, 2, 1, 0] as const;
// STARKVIS Handbollsterminologi v0.1: 6-0 = V1, V2, V3, H3, H2, H1 (the
// defender's own left/right); 5-1 = 1:or, 2:or, centerhalv and the
// framskjuten center.
export const DEFENCE_SPACE_LABEL: Record<"6-0" | "5-1", Record<number, string>> = {
  "6-0": {
    5: "V1 · vänster etta",
    4: "V2 · vänster tvåa",
    3: "V3 · vänster trea",
    2: "H3 · höger trea",
    1: "H2 · höger tvåa",
    0: "H1 · höger etta",
  },
  "5-1": {
    5: "V1 · vänster etta",
    4: "V2 · vänster tvåa",
    3: "Centerhalv (bakre)",
    2: "Center (framskjuten)",
    1: "H2 · höger tvåa",
    0: "H1 · höger etta",
  },
};
export const FIVE_SPACES = [5, 4, 2, 1, 0] as const;

const name = (p?: PlayerMock) => (p ? `${p.firstName} ${p.lastName}` : "—");

function readDraggedPlayerId(e: DragEvent<HTMLElement>): string | null {
  return e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData("text/plain") || null;
}

function PlayerSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty = true,
  emptyLabel = "Ingen",
  player,
  badge,
}: {
  label: string;
  value: string;
  options: readonly PlayerMock[];
  onChange: (id: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  player?: PlayerMock;
  badge?: string;
}) {
  return (
    <label
      className="hm-plan-field hm-role-slot-card"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const pid = readDraggedPlayerId(e);
        if (pid && options.some((o) => o.id === pid)) {
          onChange(pid);
        }
      }}
    >
      <div className="hm-role-slot-top">
        {badge && <span className="hm-role-slot-badge">{badge}</span>}
        <span>{label}</span>
      </div>
      {player && (
        <div className="hm-role-slot-player">
          <PlayerGlyph player={player} size={30} />
          <div className="hm-role-slot-player-meta">
            <strong>
              {name(player)}{" "}
              {player.nationality && player.nationality !== "UNK" && <NationFlag code={player.nationality} />}
            </strong>
            <small>
              {player.position}
              {player.shirtNumber ? ` · #${player.shirtNumber}` : ""}
            </small>
          </div>
        </div>
      )}
      <select className="hm-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.shirtNumber ? `#${p.shirtNumber} ` : ""}
            {name(p)} · {p.position}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({
  id,
  title,
  lede,
  action,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="hm-plan-section" id={id} aria-labelledby={`${id}-title`}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{lede}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DefenceSection({
  plan,
  squad,
  save,
  onSelectCourtMode,
}: {
  plan: MatchPlan;
  squad: readonly PlayerMock[];
  save: Save;
  onSelectCourtMode?: (mode: TacticalCourtMode) => void;
}) {
  const key = defenceSystemKey(plan);
  const spaces = effectiveDefenceSpaces(plan);
  const six = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK" && s.playerId);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const atSpace = (zone: number) => six.find((s) => spaces[s.playerId] === zone)?.playerId ?? "";
  const partnerOf = (id: string) => plan.substitutionPairs.find((p) => p.attackPlayerId === id)?.defencePlayerId;
  const assign = (zone: number, playerId: string) =>
    save((current) => {
      const now = effectiveDefenceSpaces(current);
      const from = now[playerId];
      const occupant = Object.keys(now).find((id) => now[id] === zone);
      const next = { ...now, [playerId]: zone, ...(occupant && occupant !== playerId && from !== undefined ? { [occupant]: from } : {}) };
      return { ...current, defenceAssignments: { ...current.defenceAssignments, [key]: next } };
    });
  return (
    <Section
      id="plan-defence"
      title={`Försvar 6 mot 6 · ${key === "5-1" ? "5–1" : "6–0"}`}
      lede="Vem försvarar var i den valda försvarsformationen. Byter du formation sparas en egen placering för den. Försvarsspecialister tar sin partners plats (se Byten)."
      action={
        onSelectCourtMode && (
          <button
            type="button"
            className="hm-btn hm-btn-sm"
            onClick={() => {
              onSelectCourtMode("DEFENCE_6V6");
              document.getElementById("plan-attack")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Visa på taktiktavlan →
          </button>
        )
      }
    >
      <div className="hm-defence-line" data-system={key}>
        {SPACE_ORDER.map((zone) => {
          const id = atSpace(zone);
          const specialist = id ? partnerOf(id) : undefined;
          const displayPlayer = byId.get(specialist ?? id);
          return (
            <div
              key={zone}
              className="hm-defence-space"
              data-front={key === "5-1" && zone === 2}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const pid = readDraggedPlayerId(e);
                if (pid && six.some((s) => s.playerId === pid)) {
                  assign(zone, pid);
                }
              }}
            >
              <span className="hm-eyebrow">{DEFENCE_SPACE_LABEL[key][zone]}</span>
              {displayPlayer && (
                <div className="hm-role-slot-player" style={{ margin: "4px 0" }}>
                  <PlayerGlyph player={displayPlayer} size={32} />
                  <div className="hm-role-slot-player-meta">
                    <strong>{displayPlayer.lastName}</strong>
                    <small>{specialist ? "⇄ Försvarsspecialist" : `Anfall: ${six.find((s) => s.playerId === id)?.position ?? ""}`}</small>
                  </div>
                </div>
              )}
              <select
                className="hm-select"
                value={id}
                aria-label={`Försvarare ${DEFENCE_SPACE_LABEL[key][zone]}`}
                onChange={(e) => assign(zone, e.target.value)}
              >
                {six.map((s) => {
                  const p = byId.get(s.playerId);
                  return (
                    <option key={s.playerId} value={s.playerId} title={name(p)}>
                      {p?.shirtNumber ? `#${p.shirtNumber} ` : ""}
                      {p?.lastName ?? "—"}
                    </option>
                  );
                })}
              </select>
              {specialist && (
                <small className="hm-text-muted">
                  Försvarar: <strong>{name(byId.get(specialist))}</strong>
                </small>
              )}
            </div>
          );
        })}
      </div>
      <p className="hm-plan-note">
        Målvakt i försvar: {name(byId.get(plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId ?? ""))}.
      </p>
    </Section>
  );
}

export function SubstitutionSection({
  plan,
  squad,
  save,
  onSelectCourtMode,
}: {
  plan: MatchPlan;
  squad: readonly PlayerMock[];
  save: Save;
  onSelectCourtMode?: (mode: TacticalCourtMode) => void;
}) {
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  const registered = new Set(plan.squad.players.map((p) => p.playerId));
  const bench = squad.filter((p) => registered.has(p.id) && !starters.has(p.id) && p.position !== "MV");
  const byId = new Map(squad.map((p) => [p.id, p]));
  const setPair = (attackId: string, defenceId: string) =>
    save((current) => ({
      ...current,
      substitutionPairs: [
        ...current.substitutionPairs.filter((p) => p.attackPlayerId !== attackId && p.defencePlayerId !== defenceId),
        ...(defenceId ? [{ attackPlayerId: attackId, defencePlayerId: defenceId }] : []),
      ],
    }));
  return (
    <Section
      id="plan-substitutions"
      title="Byten anfall–försvar"
      lede="Spelare A anfaller, spelare B försvarar på A:s plats. Bytet görs vid bollinnehavsbyte genom egen bytesplats, ett i taget, och aldrig med en utvisad eller skadad spelare. Endast uttagna bänkspelare kan väljas."
      action={
        onSelectCourtMode && (
          <button
            type="button"
            className="hm-btn hm-btn-sm"
            onClick={() => {
              onSelectCourtMode("EXCHANGES");
              document.getElementById("plan-attack")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Visa byten på taktiktavlan →
          </button>
        )
      }
    >
      {bench.length === 0 && (
        <p className="hm-plan-note" role="status">
          Inga utespelare på bänken – ta ut fler spelare i matchtruppen för att kunna göra försvarsbyten.
        </p>
      )}
      <div className="hm-plan-grid">
        {plan.attackStartingUnit.slots
          .filter((s) => s.position !== "GK" && s.playerId)
          .map((slot) => {
            const current = plan.substitutionPairs.find((p) => p.attackPlayerId === slot.playerId)?.defencePlayerId ?? "";
            const taken = new Set(plan.substitutionPairs.filter((p) => p.attackPlayerId !== slot.playerId).map((p) => p.defencePlayerId));
            return (
              <PlayerSelect
                key={slot.playerId}
                badge={slot.position}
                player={current ? byId.get(current) : byId.get(slot.playerId)}
                label={`${slot.position} · ${name(byId.get(slot.playerId))} anfaller – i försvar:`}
                value={current}
                emptyLabel="Spelar även försvar"
                options={bench.filter((p) => !taken.has(p.id))}
                onChange={(id) => setPair(slot.playerId, id)}
              />
            );
          })}
      </div>
    </Section>
  );
}

export function SpecialistSection({
  plan,
  squad,
  save,
  onSelectCourtMode,
}: {
  plan: MatchPlan;
  squad: readonly PlayerMock[];
  save: Save;
  onSelectCourtMode?: (mode: TacticalCourtMode) => void;
}) {
  const registered = new Set(plan.squad.players.map((p) => p.playerId));
  const outfield = squad.filter((p) => registered.has(p.id) && p.position !== "MV");
  const byId = new Map(squad.map((p) => [p.id, p]));
  const starters = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  const six = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK");
  const courtOrder = (a: { position: string }, b: { position: string }) =>
    COURT_ORDER.indexOf(a.position as SixCode) - COURT_ORDER.indexOf(b.position as SixCode);
  const attack = [...(plan.situationUnits?.ATTACK_6V5 ?? six.map((s) => ({ playerId: s.playerId, position: s.position as SixCode })))].sort(
    courtOrder
  );
  const defence = plan.situationUnits?.DEFENCE_5V6 ?? [];
  const setAttack = (position: SixCode, playerId: string) =>
    save((current) => {
      const base =
        current.situationUnits?.ATTACK_6V5 ??
        current.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => ({ playerId: s.playerId, position: s.position as SixCode }));
      const previous = base.find((e) => e.position === position)?.playerId ?? "";
      const swapped = base.map((e) =>
        e.position === position ? { ...e, playerId } : e.playerId === playerId ? { ...e, playerId: previous } : e
      );
      return { ...current, situationUnits: { ...current.situationUnits, ATTACK_6V5: swapped } };
    });
  const setDefence = (index: number, playerId: string) =>
    save((current) => {
      const base = [...(current.situationUnits?.DEFENCE_5V6 ?? FIVE_SPACES.map((zone) => ({ playerId: "", zone })))];
      const clash = base.findIndex((e, i) => i !== index && e.playerId === playerId);
      if (clash >= 0) base[clash] = { ...base[clash], playerId: base[index].playerId };
      base[index] = { ...base[index], playerId };
      return { ...current, situationUnits: { ...current.situationUnits, DEFENCE_5V6: base } };
    });
  const defenceComplete =
    defence.length === 5 && defence.every((e) => e.playerId) && new Set(defence.map((e) => e.playerId)).size === 5;
  return (
    <Section
      id="plan-special"
      title="Specialsituationer"
      lede="Sparade uppställningar för numerärt övertag och undertag. Matchen byter in dem en spelare i taget via bytesplatsen när situationen uppstår."
      action={
        onSelectCourtMode && (
          <div className="hm-actions">
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => {
                onSelectCourtMode("ATTACK_6V5");
                document.getElementById("plan-attack")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              6v5 på tavlan →
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => {
                onSelectCourtMode("DEFENCE_5V6");
                document.getElementById("plan-attack")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              5v6 på tavlan →
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => {
                onSelectCourtMode("ATTACK_7V6");
                document.getElementById("plan-attack")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              7v6 på tavlan →
            </button>
          </div>
        )
      }
    >
      <div className="hm-plan-columns">
        <div>
          <h3>
            Anfall 6 mot 5 · numerärt övertag{" "}
            <span className="hm-status" data-tone={plan.situationUnits?.ATTACK_6V5 ? "ok" : "neutral"}>
              {plan.situationUnits?.ATTACK_6V5 ? "Egen uppställning" : "Startsjuan"}
            </span>
          </h3>
          <p className="hm-plan-note">När motståndarna har en spelare utvisad och vi anfaller.</p>
          {attack.map((entry) => (
            <PlayerSelect
              key={entry.position}
              badge={entry.position}
              player={byId.get(entry.playerId)}
              label={CODE_LABEL[entry.position] ?? entry.position}
              value={entry.playerId}
              allowEmpty={false}
              options={outfield}
              onChange={(id) => setAttack(entry.position as SixCode, id)}
            />
          ))}
          {plan.situationUnits?.ATTACK_6V5 && (
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => save((c) => ({ ...c, situationUnits: { ...c.situationUnits, ATTACK_6V5: undefined } }))}
            >
              Använd startsjuan
            </button>
          )}
        </div>
        <div>
          <h3>
            Försvar 5 mot 6 · numerärt undertag{" "}
            <span className="hm-status" data-tone={defenceComplete ? "ok" : "neutral"}>
              {defenceComplete ? "Egen uppställning" : "Ej vald – laget behåller de som är på plan"}
            </span>
          </h3>
          <p className="hm-plan-note">När vi har en spelare utvisad och försvarar. Välj fem olika utespelare.</p>
          {FIVE_SPACES.map((zone, i) => (
            <PlayerSelect
              key={zone}
              badge={`Z${i + 1}`}
              player={defence[i]?.playerId ? byId.get(defence[i].playerId) : undefined}
              label={zone === 2 ? "Mitt · centralt i femmannalinjen" : DEFENCE_SPACE_LABEL["6-0"][zone]}
              value={defence[i]?.playerId ?? ""}
              emptyLabel="Välj spelare"
              options={outfield}
              onChange={(id) => setDefence(i, id)}
            />
          ))}
          {defence.length > 0 && (
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => save((c) => ({ ...c, situationUnits: { ...c.situationUnits, DEFENCE_5V6: undefined } }))}
            >
              Rensa
            </button>
          )}
        </div>
        <div>
          <h3>Anfall 7 mot 6</h3>
          <p className="hm-plan-note">
            Målvakten går ut för en sjunde utespelare enligt inställningen «7 mot 6» under Anfall. Välj vem som går in.
          </p>
          <PlayerSelect
            badge="7v6"
            player={plan.sevenVSixPlayerId ? byId.get(plan.sevenVSixPlayerId) : undefined}
            label="Sjunde utespelare"
            value={plan.sevenVSixPlayerId ?? ""}
            emptyLabel="Assistenten väljer (bästa linjespelare)"
            options={outfield.filter((p) => !starters.has(p.id))}
            onChange={(id) => save((c) => ({ ...c, sevenVSixPlayerId: id || undefined }))}
          />
          <h3>Försvar 6 mot 7</h3>
          <p className="hm-plan-note">
            Motståndarlagen i den här versionen spelar inte 7 mot 6, så ingen separat uppställning sparas – laget försvarar med sin vanliga försvarsuppställning.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function SetPieceSection({
  career,
  squad,
  updateCareer,
}: {
  career: CareerState;
  squad: readonly PlayerMock[];
  updateCareer: UpdateCareer;
}) {
  const roles = currentTeamRoles(career);
  const outfield = squad.filter((p) => p.position !== "MV");
  const byId = new Map(squad.map((p) => [p.id, p]));
  const order = [...roles.penaltyTakers];
  const set = (index: number, id: string) => {
    const next = [...order];
    next[index] = id;
    updateCareer((s) => setPenaltyTakers(s, next.filter(Boolean)));
  };
  return (
    <Section
      id="plan-setpieces"
      title="Fasta situationer · 7-meter"
      lede="Straffläggarordningen gäller i varje match tills du ändrar den. Den första i ordningen som står på planen slår; annars nästa. Utan ordning väljer laget mittnian."
    >
      <div className="hm-plan-grid">
        {Array.from({ length: MAX_PENALTY_TAKERS }, (_, i) => (
          <PlayerSelect
            key={i}
            badge={`7m #${i + 1}`}
            player={order[i] ? byId.get(order[i]) : undefined}
            label={i === 0 ? "Förstaval" : `Reserv ${i}`}
            value={order[i] ?? ""}
            emptyLabel={i === 0 ? "Lagets standard (mittnian)" : "Ingen"}
            options={outfield.filter((p) => !order.includes(p.id) || order[i] === p.id)}
            onChange={(id) => set(i, id)}
          />
        ))}
      </div>
    </Section>
  );
}

export function LeadershipSection({
  career,
  squad,
  updateCareer,
}: {
  career: CareerState;
  squad: readonly PlayerMock[];
  updateCareer: UpdateCareer;
}) {
  const roles = currentTeamRoles(career);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const leadership = (id?: string) => (id ? leadershipOf(career, id) : null);
  const captainLeadership = leadership(roles.captainId);
  return (
    <Section
      id="plan-leadership"
      title="Ledarskap"
      lede="Kapten och vice kapten gäller över matcher och säsonger. Effekterna är små och förklarade: utnämningen lyfter spelarens moral en tid, att frånta någon bindeln sänker den, och en kapten med starkt ledarskap dämpar lagets moraltapp i en förlustsvit."
    >
      <div className="hm-plan-grid">
        <PlayerSelect
          badge="K"
          player={roles.captainId ? byId.get(roles.captainId) : undefined}
          label="Lagkapten"
          value={roles.captainId ?? ""}
          emptyLabel="Ingen utsedd"
          options={squad}
          onChange={(id) => updateCareer((s) => setCaptaincy(s, "CAPTAIN", id || null))}
        />
        <PlayerSelect
          badge="VK"
          player={roles.viceCaptainId ? byId.get(roles.viceCaptainId) : undefined}
          label="Vice kapten"
          value={roles.viceCaptainId ?? ""}
          emptyLabel="Ingen utsedd"
          options={squad.filter((p) => p.id !== roles.captainId)}
          onChange={(id) => updateCareer((s) => setCaptaincy(s, "VICE", id || null))}
        />
      </div>
      {roles.captainId && (
        <p className="hm-plan-note">
          {captainLeadership === null
            ? "Kaptenens ledarskap är inte bedömt i spelardatan – utnämningen påverkar bara hans egen moral."
            : captainLeadership >= STEADYING_LEADERSHIP
            ? `Ledarskap ${Math.round(captainLeadership)}/20 – håller ihop gruppen i motgång.`
            : `Ledarskap ${Math.round(captainLeadership)}/20 – för lågt för att dämpa lagets moraltapp i motgång (kräver ${STEADYING_LEADERSHIP}).`}
        </p>
      )}
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
    [
      "Specialsituationer",
      [
        plan.situationUnits?.ATTACK_6V5 ? "6 mot 5" : null,
        plan.situationUnits?.DEFENCE_5V6?.every((e) => e.playerId) ? "5 mot 6" : null,
        plan.sevenVSixPlayerId ? "7 mot 6" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Standard",
    ],
    ["7-meter", roles.penaltyTakers.length ? roles.penaltyTakers.map((id) => byId.get(id)?.lastName ?? "?").join(" → ") : "Lagets standard"],
    ["Kapten", roles.captainId ? `${byId.get(roles.captainId)?.lastName ?? "?"}${roles.viceCaptainId ? ` · vice ${byId.get(roles.viceCaptainId)?.lastName ?? "?"}` : ""}` : "Ingen utsedd"],
    ["Matchträning", unfit ? `${unfit} uttagna under 50 %` : "Inga uttagna under 50 %"],
  ];
  return (
    <dl className="hm-plan-summary">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
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
