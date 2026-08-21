"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NATIONS, COMPETITIONS, CLUBS, TUMBA_CLUB_ID, GAME_CURRENT_DATE, type NationCode } from "@/lib/game-data";
import { createSave, setActiveSaveId } from "@/lib/save/saveRepository";
import ClubCrest from "@/components/ClubCrest";

const STEPS = ["Nationer", "Ligor", "Databas", "Klubb", "Manager", "Starta"] as const;

export default function NewGamePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nations, setNations] = useState<NationCode[]>(["SWE"]);
  const [competitionIds, setCompetitionIds] = useState<string[]>(["se_handbollsligan_herr", "swe-2"]);
  const [clubId, setClubId] = useState<string>(TUMBA_CLUB_ID);
  const [managerName, setManagerName] = useState("");
  const [managerNationality, setManagerNationality] = useState<NationCode>("SWE");
  const [managerDob, setManagerDob] = useState("1988-01-01");

  const availableCompetitions = useMemo(
    () => COMPETITIONS.filter((c) => nations.includes(c.nation)),
    [nations],
  );

  const availableClubs = useMemo(
    () => CLUBS.filter((c) => competitionIds.includes(c.competitionId)),
    [competitionIds],
  );

  function toggleNation(code: NationCode) {
    setNations((prev) => {
      const next = prev.includes(code) ? prev.filter((n) => n !== code) : [...prev, code];
      // Drop competitions for nations no longer selected.
      setCompetitionIds((prevComp) => prevComp.filter((id) => next.includes(COMPETITIONS.find((c) => c.id === id)!.nation)));
      return next;
    });
  }

  function toggleCompetition(id: string) {
    setCompetitionIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function canProceed(): boolean {
    if (step === 0) return nations.length > 0;
    if (step === 1) return competitionIds.length > 0;
    if (step === 3) return CLUBS.find((c) => c.id === clubId)?.playable === true;
    if (step === 4) return managerName.trim().length > 1;
    return true;
  }

  function handleStartCareer() {
    const save = createSave({
      selectedNations: nations,
      selectedCompetitionIds: competitionIds,
      clubId,
      manager: { name: managerName.trim(), nationality: managerNationality, dateOfBirth: managerDob },
      gameDate: GAME_CURRENT_DATE,
    });
    setActiveSaveId(save.saveId);
    router.push("/career");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--hm-bg-app)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <div style={{ width: 760 }}>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>Handball Manager — Nytt spel</div>

        {/* Step progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 26 }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: i <= step ? "var(--hm-accent)" : "var(--hm-border)",
                  marginBottom: 5,
                }}
              />
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: i === step ? 700 : 500,
                  color: i === step ? "var(--hm-text-primary)" : "var(--hm-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {i + 1}. {label}
              </div>
            </div>
          ))}
        </div>

        <div className="hm-panel">
          <div className="hm-panel-body">
            {step === 0 && (
              <>
                <StepHeading title="Välj nationer" desc="Vilka handbollsnationer ska finnas med i din spelvärld?" />
                <div className="hm-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  {NATIONS.map((n) => (
                    <label
                      key={n.code}
                      className="hm-panel"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 10px",
                        cursor: "pointer",
                        borderColor: nations.includes(n.code) ? "var(--hm-accent)" : undefined,
                      }}
                    >
                      <input type="checkbox" checked={nations.includes(n.code)} onChange={() => toggleNation(n.code)} />
                      <span style={{ fontSize: "var(--hm-text-xs)", fontWeight: 600 }}>{n.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading title="Välj ligor" desc="De två högsta herrdivisionerna finns tillgängliga per nation." />
                {nations.map((nation) => (
                  <div key={nation} style={{ marginBottom: 12 }}>
                    <div className="hm-eyebrow" style={{ marginBottom: 6 }}>{NATIONS.find((n) => n.code === nation)?.name}</div>
                    <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      {availableCompetitions
                        .filter((c) => c.nation === nation)
                        .map((c) => (
                          <label
                            key={c.id}
                            className="hm-panel"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer", borderColor: competitionIds.includes(c.id) ? "var(--hm-accent)" : undefined }}
                          >
                            <input type="checkbox" checked={competitionIds.includes(c.id)} onChange={() => toggleCompetition(c.id)} />
                            <span style={{ fontSize: "var(--hm-text-xs)" }}>
                              <span style={{ fontWeight: 700 }}>{c.name}</span>{" "}
                              <span className="hm-text-muted">(Tier {c.tier})</span>
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading title="Databas" desc="Spelvärlden byggs upp utifrån dina val." />
                <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <MiniStat label="Nationer" value={nations.length} />
                  <MiniStat label="Ligor" value={competitionIds.length} />
                  <MiniStat label="Klubbar" value={availableClubs.length} />
                </div>
                <div className="hm-divider" />
                <p className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>
                  Nations-, tävlings- och klubbnamn är verkliga där det är praktiskt möjligt. Spelartrupper,
                  matchresultat, personal och ekonomi i denna byggversion är fiktiva — se Klubb-sidan för detaljer.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <StepHeading title="Välj klubb" desc="Alla klubbar i Handbollsligan (verklig spelardatabas) samt IFK Tumba är spelbara." />
                <div className="hm-scroll-x">
                  <table className="hm-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Klubb</th>
                        <th>Liga</th>
                        <th>Stad</th>
                        <th>Data</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {availableClubs.map((c) => {
                        const comp = COMPETITIONS.find((x) => x.id === c.competitionId);
                        return (
                          <tr
                            key={c.id}
                            data-clickable={c.playable}
                            data-highlight={clubId === c.id}
                            className={c.playable ? "" : "hm-not-playable"}
                            onClick={() => c.playable && setClubId(c.id)}
                          >
                            <td>
                              <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={20} />
                            </td>
                            <td className="hm-td-strong">{c.name}</td>
                            <td>{comp?.name}</td>
                            <td>{c.city ?? "—"}</td>
                            <td>
                              {c.dataSource === "REAL_WORLD" ? (
                                <span className="hm-badge hm-badge-neutral" title="Spelartrupp importerad från verklig data">REAL DATA</span>
                              ) : (
                                <span className="hm-badge hm-badge-neutral" style={{ opacity: 0.6 }}>MOCK</span>
                              )}
                            </td>
                            <td>
                              {c.playable ? (
                                <span className="hm-badge hm-badge-positive">SPELBAR</span>
                              ) : (
                                <span className="hm-badge hm-badge-neutral">Ej spelbar i denna build</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <StepHeading title="Manager" desc="Skapa din managerprofil." />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
                  <Field label="Namn">
                    <input
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="För- och efternamn"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Nationalitet">
                    <select value={managerNationality} onChange={(e) => setManagerNationality(e.target.value as NationCode)} style={inputStyle}>
                      {NATIONS.map((n) => (
                        <option key={n.code} value={n.code}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Födelsedatum">
                    <input type="date" value={managerDob} onChange={(e) => setManagerDob(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <StepHeading title="Starta karriär" desc="Kontrollera dina val innan du börjar." />
                <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <SummaryRow label="Manager" value={managerName || "—"} />
                  <SummaryRow label="Nationalitet" value={NATIONS.find((n) => n.code === managerNationality)?.name ?? "—"} />
                  <SummaryRow label="Klubb" value={CLUBS.find((c) => c.id === clubId)?.name ?? "—"} />
                  <SummaryRow label="Liga" value={COMPETITIONS.find((c) => c.id === CLUBS.find((c2) => c2.id === clubId)?.competitionId)?.name ?? "—"} />
                  <SummaryRow label="Startdatum" value={GAME_CURRENT_DATE} />
                  <SummaryRow label="Nationer i spelvärlden" value={String(nations.length)} />
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderTop: "1px solid var(--hm-border-subtle)" }}>
            <button
              type="button"
              className="hm-btn"
              onClick={() => (step === 0 ? router.push("/") : setStep((s) => s - 1))}
            >
              ← Tillbaka
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="hm-btn hm-btn-primary" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
                Nästa →
              </button>
            ) : (
              <button type="button" className="hm-btn hm-btn-primary" disabled={!canProceed()} onClick={handleStartCareer}>
                STARTA KARRIÄR
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};

function StepHeading({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 700 }}>{title}</div>
      <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{desc}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="hm-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hm-panel" style={{ padding: "10px 12px" }}>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--hm-border-subtle)" }}>
      <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{label}</span>
      <span style={{ fontSize: "var(--hm-text-xs)", fontWeight: 700 }}>{value}</span>
    </div>
  );
}
