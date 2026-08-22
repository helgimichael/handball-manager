"use client";

// HM-UX-0.3: universal club profile for any club that ISN'T the
// manager's own (ClubLink routes the manager's own club to the
// existing /career/club workflow instead -- this page redirects there
// too, if reached directly). Shows only data this career already has
// real access to: identity/name/competition (game-data's Club record),
// squad (getCareerClubSquad -- real roster where imported, otherwise
// an honest "no roster data" message, never a fabricated squad),
// staff (the same non-editor-gated staff-snapshot endpoint Staff's own
// page already uses), fixtures/results already in career state, and
// this club's live table position. No new data-loading work, no
// speculative content.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { COMPETITIONS, getClub, playerAge, positionLabel } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad } from "@/lib/career/careerWorld";
import { getLiveStandings } from "@/lib/career/standings";
import { selectCurrentStaffAssignments, type StaffAssignment, type StaffPerson } from "@/lib/identity";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink, PlayerLink } from "@/components/entityLinks";

export default function ClubProfilePage() {
  const router = useRouter();
  const params = useParams<{ clubId: string }>();
  const { career } = useCareer();
  const club = getClub(params.clubId);
  const [staff, setStaff] = useState<{ people: StaffPerson[]; assignments: StaffAssignment[] } | null>(null);

  const isOwnClub = params.clubId === career.playerClubId;

  useEffect(() => {
    if (isOwnClub) {
      router.replace("/career/club");
    }
  }, [isOwnClub, router]);

  useEffect(() => {
    if (!club || isOwnClub) return;
    let cancelled = false;
    fetch(`/api/game-world/staff-snapshot?clubId=${encodeURIComponent(club.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStaff({ people: data.people ?? [], assignments: data.assignments ?? [] });
      })
      .catch(() => {
        if (!cancelled) setStaff({ people: [], assignments: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [club, isOwnClub]);

  if (!club) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Klubben hittades inte.</div>
      </div>
    );
  }
  if (isOwnClub) {
    return null; // redirecting
  }

  const squad = getCareerClubSquad(career, club.id);
  const competitionName = COMPETITIONS.find((c) => c.id === club.competitionId)?.name ?? club.competitionId;
  const table = career.competitionId === club.competitionId ? getLiveStandings(career) : [];
  const tableRow = table.find((r) => r.clubId === club.id);
  const tablePosition = tableRow ? table.indexOf(tableRow) + 1 : null;

  const fixtures = career.fixtures.filter((f) => f.homeClubId === club.id || f.awayClubId === club.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const currentStaffAssignments = staff ? selectCurrentStaffAssignments(staff.assignments, career.gameDate) : [];
  const peopleById = new Map((staff?.people ?? []).map((p) => [p.id, p]));

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{club.name}</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              {competitionName} · {club.city ?? "—"}
              {club.founded ? ` · Grundad ${club.founded}` : ""}
            </div>
          </div>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.back()}>
            ← Tillbaka
          </button>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 28, paddingTop: 0 }}>
          <MiniStat label="Tabellplacering" value={tablePosition ? `${tablePosition}:a` : "—"} />
          <MiniStat label="Poäng" value={tableRow?.points ?? "—"} />
          <MiniStat label="Trupp" value={squad.length} />
          <MiniStat label="Personal" value={currentStaffAssignments.length} />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Trupp</span>
        </div>
        {squad.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Ingen truppdata tillgänglig för denna klubb ännu.</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Nr</th>
                  <th>Spelare</th>
                  <th>Pos</th>
                  <th>Ålder</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span>
                    </td>
                    <td className="hm-td-strong">
                      <PlayerLink playerId={p.id}>
                        {p.firstName} {p.lastName}
                      </PlayerLink>
                    </td>
                    <td title={positionLabel(p.position)}>{p.position}</td>
                    <td>{playerAge(p.dateOfBirth, p.birthYear) ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Personal</span>
        </div>
        {staff === null ? (
          <div className="hm-panel-body hm-text-muted">Läser in…</div>
        ) : currentStaffAssignments.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Ingen personaldata tillgänglig för denna klubb ännu.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Officiell titel</th>
                <th>HM-roll</th>
              </tr>
            </thead>
            <tbody>
              {currentStaffAssignments.map((a) => {
                const person = peopleById.get(a.personId);
                return (
                  <tr key={`${a.personId}:${a.officialRole}`}>
                    <td className="hm-td-strong">{person?.displayName ?? a.personId}</td>
                    <td>{a.officialRole}</td>
                    <td>{a.standardRoles.join(" + ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matcher</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{fixtures.length} matcher</span>
        </div>
        {fixtures.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga matcher registrerade för denna klubb ännu.</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Omg</th>
                  <th>Datum</th>
                  <th>Hemma / Borta</th>
                  <th>Motstånd</th>
                  <th>Resultat</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((f) => {
                  const home = f.homeClubId === club.id;
                  const opponentId = home ? f.awayClubId : f.homeClubId;
                  const opponent = getClub(opponentId);
                  const result = career.results[f.id];
                  const gf = result ? (home ? result.homeGoals : result.awayGoals) : undefined;
                  const ga = result ? (home ? result.awayGoals : result.homeGoals) : undefined;
                  return (
                    <tr key={f.id}>
                      <td>{f.round}</td>
                      <td>{new Date(f.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" })}</td>
                      <td>{home ? "Hemma" : "Borta"}</td>
                      <td className="hm-td-strong">{opponent ? <ClubLink clubId={opponent.id}>{opponent.name}</ClubLink> : opponentId}</td>
                      <td>{result ? <span className="hm-td-strong">{gf}–{ga}</span> : <span className="hm-text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}
