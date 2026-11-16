"use client";
// Arena Nights 231 -- STF-04 B: the contextual "Vem gör det?" toggle. Drop it into a domain page's control panel
// to set that area's delegation mode where its consequences are felt. It calls the existing setDelegation with
// the same delegate the Ansvarsfördelning page uses -- no second delegation flow, no second proposals queue
// (pending proposals for the area link to the one queue on /career/staff/responsibilities).
import Link from "next/link";
import { useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { delegateFor, modeOf, pendingProposals, setDelegation } from "@/lib/delegation/delegation";
import { DELEGABLE_AREAS, DELEGATION_MODE_LABEL, type DelegationMode } from "@/lib/delegation/types";
import { RESPONSIBILITY_LABEL, RESPONSIBILITY_OWNER_ROLE, type ResponsibilityArea } from "@/lib/staff/organisation";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";

const MODES: DelegationMode[] = ["MANAGER", "ADVISE", "DELEGATE"];

export function DelegationToggle({ area, compact = false }: { area: ResponsibilityArea; compact?: boolean }) {
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const who = delegateFor(career, area);
  const mode = modeOf(career, area);
  const delegable = DELEGABLE_AREAS.includes(area);
  const pending = pendingProposals(career).filter((p) => p.area === area).length;
  const reason = !delegable ? "Inte delegerbart i den här versionen -- du gör det själv." : !who ? `Ingen ${STAFF_ROLE_LABEL[RESPONSIBILITY_OWNER_ROLE[area]].toLowerCase()} i klubben -- du gör det själv.` : null;
  return (
    <div className="dt-toggle" data-compact={compact || undefined}>
      <span className="dt-q">Vem gör det? <small>{RESPONSIBILITY_LABEL[area]}{who ? ` · ${who.name}` : ""}</small></span>
      {reason ? <span className="dt-reason">{reason}</span> : (
        <span className="dt-modes" role="radiogroup" aria-label={`Läge för ${RESPONSIBILITY_LABEL[area]}`}>
          {MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { try { updateCareer((s) => setDelegation(s, area, m, who!.staffId)); setMessage(`${DELEGATION_MODE_LABEL[m]}.`); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } }}>{DELEGATION_MODE_LABEL[m]}</button>
          ))}
        </span>
      )}
      {pending > 0 && <Link className="dt-pending" href="/career/staff/responsibilities">{pending} förslag väntar →</Link>}
      {message && <span className="dt-msg" role="status">{message}</span>}
    </div>
  );
}
