"use client";
// Arena Nights 231 -- STF-01b A "Health-coloured tree": the organisation as a tree -- the manager at the top,
// departments as branches, positions as nodes coloured by fit (good / ok / weak / vacant). It is the "Träd"
// lens of the STF-01 matrix and reads the same rows (lib/staff/staffDesk.ts), so the club is drawn once.
// Tap a holder for the Peek; a vacant node goes straight to its candidates. Horizontal on desktop, an
// indented list on phones.
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { DEPARTMENT_LABEL } from "@/lib/staff/organisation";
import type { MatrixGroup } from "@/lib/staff/staffDesk";

const TONE_LABEL = { good: "bra passform", ok: "godtagbar passform", weak: "svag passform", vacant: "vakant" } as const;

export function OrganisationChart({ groups, onPeek }: { groups: MatrixGroup[]; onPeek: (id: string) => void }) {
  const { career } = useCareer();
  const club = getCareerClub(career);
  return (
    <section className="sf-tree" aria-label={`${club.name}: organisationsträd`}>
      <div className="sf-tree-root"><span className="sf-node" data-tone="root"><small>Manager</small><b>Du</b><Link href="/career/manager">Profil →</Link></span></div>
      <ul className="sf-tree-branches">
        {groups.map((g) => (
          <li key={g.department}>
            <span className="sf-tree-dept"><b>{DEPARTMENT_LABEL[g.department]}</b><small className="sf-num">{g.vacant ? `${g.vacant} vakant` : `${g.rows.length} tjänster`}</small></span>
            <ul>
              {g.rows.map((r) => {
                const label = r.role ? `${STAFF_ROLE_LABEL[r.role]}${r.slot > 1 ? ` ${r.slot}` : ""}` : "Styrelsen";
                const tone = r.state === "vacant" ? "vacant" : r.state === "covered" ? "covered" : r.state === "manager" || r.state === "board" ? "neutral" : r.tone ?? "neutral";
                const name = r.state === "manager" ? "Du (manager)" : r.state === "covered" ? `Täcks av ${r.coveredBy ? STAFF_ROLE_LABEL[r.coveredBy].toLowerCase() : "annan roll"}` : r.holderName ?? "Vakant";
                const title = `${label}: ${name}${r.fit !== null ? ` · ${r.fit}/20 · ${TONE_LABEL[r.tone as keyof typeof TONE_LABEL] ?? ""}` : r.state === "vacant" ? " · vakant" : ""}`;
                return (
                  <li key={r.key}>
                    {r.state === "vacant" ? (
                      <Link className="sf-node" data-tone={tone} href={`/career/staff/recruitment?role=${r.role}`} title={title}><small>{label}</small><b>Vakant</b><em>Visa kandidater →</em></Link>
                    ) : r.holderId ? (
                      <button type="button" className="sf-node" data-tone={tone} onClick={() => onPeek(r.holderId!)} title={title}><small>{label}</small><b>{name}</b>{r.fit !== null && <em className="sf-num">{r.fit}/20</em>}</button>
                    ) : (
                      <span className="sf-node" data-tone={tone} title={title}><small>{label}</small><b>{name}</b></span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
