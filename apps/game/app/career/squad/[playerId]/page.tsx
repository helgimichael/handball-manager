"use client";

import { useParams, useRouter } from "next/navigation";
import { abilityStars, playerAge, positionLabel, potentialStars } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { averageRating, emptyPlayerSeasonStats } from "@/lib/career/types";
import { resolveStatusLabel } from "@/lib/career/playerStatus";
import StarRating from "@/components/StarRating";
import StatValue from "@/components/StatValue";

export default function PlayerProfilePage() {
  const router = useRouter();
  const params = useParams<{ playerId: string }>();
  const { career } = useCareer();
  const player = getCareerPlayer(career, params.playerId);

  if (!player) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Spelaren hittades inte.</div>
      </div>
    );
  }

  const seasonStats = career.playerSeasonStats[player.id] ?? emptyPlayerSeasonStats(player.id);
  const age = playerAge(player.dateOfBirth, player.birthYear);
  const isWonderkid = age !== null && age <= 19 && potentialStars(player) >= 5;

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
      <div className="hm-grid" style={{ gap: 12 }}>
        {/* Header */}
        <div className="hm-panel">
          <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--hm-surface-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 800,
                color: "var(--hm-text-muted)",
                flexShrink: 0,
              }}
            >
              {player.firstName[0]}
              {player.lastName[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="hm-shirt-number">{player.shirtNumber ?? "–"}</span>
                <span style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>
                  {player.firstName} {player.lastName}
                </span>
                {isWonderkid ? <span className="hm-badge hm-badge-warning">TALANG</span> : null}
                {player.dataSource === "REAL_WORLD" ? (
                  <span className="hm-badge hm-badge-neutral" title="Importerad från verklig spelardata">
                    REAL DATA
                  </span>
                ) : null}
              </div>
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 2 }}>
                {positionLabel(player.position)}
                {player.secondaryPosition ? ` / ${positionLabel(player.secondaryPosition)}` : ""} · {age ?? "–"} år · {player.nationality} · {player.foot ?? "Okänd"}
              </div>
            </div>
            <button type="button" className="hm-btn" onClick={() => router.push("/career/squad")}>
              ← Trupp
            </button>
          </div>
        </div>

        {/* Overview */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Översikt</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
            <MetricBlock label="Matcher" value={seasonStats.appearances} />
            <MetricBlock label="Mål" value={seasonStats.goals} />
            <MetricBlock label="Snittbetyg" value={seasonStats.appearances > 0 ? averageRating(seasonStats).toFixed(1) : "—"} />
            {player.position === "MV" ? (
              <MetricBlock label="Räddningar" value={`${seasonStats.saves}/${seasonStats.shotsFaced}`} />
            ) : (
              <MetricBlock label="Skott" value={seasonStats.shots} />
            )}
            <MetricBlock label="Fitness" value={`${player.fitnessPct}%`} />
            <MetricBlock label="Status" value={resolveStatusLabel(career.playerStatuses, player)} />
          </div>
        </div>

        {/* Attributes -- explicitly marked mock */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Egenskaper</span>
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Mockat attributset — ej slutgiltig modell</span>
          </div>
          <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <AttributeGroup title="Tekniska" entries={[
              ["Skott", player.attributes.technical.skott],
              ["Passning", player.attributes.technical.passning],
              ["Spelförståelse", player.attributes.technical.spelforstaelse],
              ["Genombrott", player.attributes.technical.genombrott],
              ["Mottagning", player.attributes.technical.mottagning],
              ["Fint", player.attributes.technical.fint],
              ["Spel utan boll", player.attributes.technical.spelUtanBoll],
            ]} />
            <AttributeGroup title="Mentala" entries={[
              ["Beslutsfattande", player.attributes.mental.beslutsfattande],
              ["Kyla", player.attributes.mental.kyla],
              ["Arbetskapacitet", player.attributes.mental.arbetskapacitet],
              ["Kampvilja", player.attributes.mental.kampvilja],
              ["Positionering", player.attributes.mental.positionering],
              ["Lagarbete", player.attributes.mental.lagarbete],
              ["Ledarskap", player.attributes.mental.ledarskap],
            ]} />
            <AttributeGroup title="Fysiska" entries={[
              ["Snabbhet", player.attributes.physical.snabbhet],
              ["Acceleration", player.attributes.physical.acceleration],
              ["Styrka", player.attributes.physical.styrka],
              ["Explosivitet", player.attributes.physical.explosivitet],
              ["Uthållighet", player.attributes.physical.uthallighet],
              ["Rörlighet", player.attributes.physical.rorlighet],
            ]} />
          </div>
        </div>
      </div>

      <div className="hm-grid" style={{ gap: 12 }}>
        {/* Ability / potential */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Förmåga</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Nuvarande nivå</span>
              <StarRating stars={abilityStars(player)} title="Tränarstabens bedömning av nuvarande nivå" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Potential</span>
              <StarRating stars={potentialStars(player)} title="Scoutingens uppskattning — osäker" />
            </div>
            <div className="hm-divider" />
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>
              {isWonderkid
                ? "En av klubbens mest lovande unga spelare. Scoutingavdelningen ser stor utvecklingspotential, men bedömningen är fortfarande osäker så här tidigt."
                : "Tränarstabens löpande bedömning baserat på matcher och träning."}
            </p>
          </div>
        </div>

        {/* Contract */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kontrakt</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Kontrakt t.o.m." value={player.contractEndSeason} />
            <ContractRow label="Lön / månad" value={`${player.wageSekPerMonth.toLocaleString("sv-SE")} kr`} />
            <ContractRow label="Tröjnummer" value={player.shirtNumber !== null ? String(player.shirtNumber) : "Okänt"} />
          </div>
        </div>

        {/* Development */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Utveckling</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Längd" value={player.heightCm !== null ? `${player.heightCm} cm` : "Okänd"} />
            <ContractRow label="Vikt" value={player.weightKg !== null ? `${player.weightKg} kg` : "Okänd"} />
            <ContractRow label="Ålder" value={age !== null ? `${age} år` : "Okänd"} />
            <ContractRow label="Född" value={player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString("sv-SE") : player.birthYear ? String(player.birthYear) : "Okänt"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function AttributeGroup({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div>
      <div className="hm-eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      {entries.map(([label, value]) => (
        <div key={label} className="hm-stat-row">
          <span className="hm-stat-label">{label}</span>
          <StatValue value={value} />
        </div>
      ))}
    </div>
  );
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
