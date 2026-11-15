'use client';
// Arena Nights Phase 3 -- REC-02 C unified pipeline board. Rows open the Recruitment Centre's existing dossier;
// every action stays in that dossier (scouting assignment, shortlist, priority, negotiation entry).
import type { Lane } from '@/lib/recruitment/pipeline';
import type { StarRange } from '@/lib/knowledge/playerVisibility';
import { RECRUITMENT_PRIORITY_LABEL_SV } from '@/lib/career/recruitment';
import { POSITION_NAME } from '@/lib/club/clubJournal';

/** A star RANGE drawn as uncertainty: solid up to the lowest estimate, hatched up to the highest. Never a single true value. */
export function StarBand({ range, label }: { range: StarRange | null; label: string }) {
  if (!range) return <span className="rp-stars" data-unknown="true" aria-label={`${label}: okänd`}>?</span>;
  const text = range.min === range.max ? `${range.min} av 5` : `${range.min}–${range.max} av 5`;
  return (
    <span className="rp-stars" role="img" aria-label={`${label}: ${text}`} title={`${label}: ${text}`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} data-fill={i <= range.min ? 'solid' : i <= range.max ? 'range' : 'empty'} />)}
    </span>
  );
}

export function PipelineBoard({ lanes, selectedId, onSelect, budget }: { lanes: Lane[]; selectedId: string | null; onSelect: (playerId: string) => void; budget?: { transfer: string; wageRoom: string; wageRoomNegative: boolean } | null }) {
  return (
    <section className="rp-board" aria-label="Rekryteringskedjan">
      <header className="rp-board-head">
        <p>Från upptäckt till underskrift. Stjärnorna är scouternas uppskattning – ju bättre kännedom, desto smalare spann.</p>
        {budget && (
          <dl className="rp-budget">
            <div><dt>Transferbudget</dt><dd>{budget.transfer}</dd></div>
            <div data-negative={budget.wageRoomNegative || undefined}><dt>Lönerum / år</dt><dd>{budget.wageRoom}</dd></div>
          </dl>
        )}
      </header>
      <div className="rp-lanes">
        {lanes.map((lane) => (
          <section key={lane.id} className="rp-lane" data-lane={lane.id} aria-labelledby={`rp-${lane.id}`}>
            <header title={lane.hint}>
              <h3 id={`rp-${lane.id}`}>{lane.label} <span>{lane.items.length}</span></h3>
              <small>{lane.insight}</small>
            </header>
            {lane.items.length === 0 ? (
              <p className="rp-empty">{lane.hint}</p>
            ) : (
              <ol>
                {lane.items.map(({ candidate: c, fillsNeed }) => (
                  <li key={c.playerId}>
                    <button type="button" aria-pressed={selectedId === c.playerId} onClick={() => onSelect(c.playerId)}>
                      <span className="rp-name"><b>{c.firstName.charAt(0)}. {c.lastName}</b><small>{c.position} · {c.ageYears ?? '–'} år · {c.clubName}</small></span>
                      <span className="rp-meta">
                        <StarBand range={c.visibility?.abilityRange ?? null} label="Förmåga" />
                        <span className="rp-knowledge" title={`Kännedom ${c.knowledgePct} %`}><i style={{ width: `${c.knowledgePct}%` }} /></span>
                      </span>
                      <span className="rp-tags">
                        {fillsNeed && <em data-need={fillsNeed}>{fillsNeed === 'GAP' ? 'Fyller lucka' : 'Ger bredd'} · {POSITION_NAME[c.position].toLowerCase()}</em>}
                        {lane.id === 'SHORTLIST' && c.priority !== 'NORMAL' && <em data-priority={c.priority}>{RECRUITMENT_PRIORITY_LABEL_SV[c.priority]}</em>}
                        {lane.id === 'NEGOTIATING' && <em data-deal="true">{c.transferStatusLabel}</em>}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
