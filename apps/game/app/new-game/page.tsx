"use client";

// Arena 231 -- ENT-03 C "Club first, contract last": three beats (Klubb · Manager · Kontrakt) instead of six.
// Nations/leagues/Databas (ENT-03a/b/c) live in the 'Världen' drawer; the club wall (ENT-03d), the accreditation
// pass (ENT-03e) and the contract (ENT-03f) are the three steps. Every choice, validation and the B-team rule are
// unchanged, and createNewCareerSave receives exactly the same inputs as before for the same choices.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NationFlag } from "@/components/game/NationFlag";
import { fetchClubPreseasonContexts, type ClubPreseasonContext } from "@/lib/newGame/clubSelectionContext";
import { flushSync } from 'react-dom';
import CareerInitialization from '@/components/game/CareerInitialization';
import { afterNextPaint } from '@/lib/ui/afterNextPaint';
import { NATIONS, COMPETITIONS, CLUBS, TUMBA_CLUB_ID, GAME_CURRENT_DATE, isHumanManageable, clubVisualIdentity, type NationCode } from "@/lib/game-data";
import { setActiveSaveId } from "@/lib/save/saveRepository";
import { createNewCareerSave } from '@/lib/career/careerInitialization';
import ClubCrest, { CrestPlaceholderNote } from "@/components/ClubCrest";
import { resolveClubIdentity } from "@/components/crests/clubIdentity";
import CareerEntryFrame from "@/components/game/CareerEntryFrame";
import { formatGameDate } from "@/lib/career/dateUtils";
import { PRESEASON_START_OPTIONS, computeCareerStartDate, resolveLeagueKickoffDate, type PreseasonStartOption } from "@/lib/career/preseason";
import { clubIdentityStyle } from "@/lib/career/activeClubIdentity";
import { DEAL_SIGNED_BACKDROP } from "@/components/transfers/transferVisuals";
import ClubWall from "@/components/entry/ClubWall";
import WorldDrawer, { DEFAULT_COMPETITIONS, DEFAULT_NATIONS, worldSummaryText, type LeagueClubs, type WorldSummary } from "@/components/entry/WorldDrawer";
import { DEFAULT_PASS, PASS_PHILOSOPHIES, PASS_PORTRAITS, initialsOf, writeManagerPass, type ManagerPassFlavour } from "@/components/entry/managerPass";
import "@/components/game/career-entry.css";
import "@/components/entry/entry.css";

const PRESEASON_OPTION_LABEL: Record<PreseasonStartOption, string> = {
  "8_WEEKS": "8 veckor före seriestart",
  "6_WEEKS": "6 veckor före seriestart",
  "4_WEEKS": "4 veckor före seriestart",
  "2_WEEKS": "2 veckor före seriestart",
  FIRST_MATCH: "Vid första tävlingsmatchen",
};
const STEPS = ["Klubb", "Manager", "Kontrakt"] as const;
const STEP_NOTES = ["Välj din hemmaplan", "Vem är du?", "Signera och börja"] as const;
const SEASON = `${Number(GAME_CURRENT_DATE.slice(0, 4))}/${String(Number(GAME_CURRENT_DATE.slice(0, 4)) + 1).slice(-2)}`;
// Static catalogue reads for the setup screens live here (reviewed in the clubWorldMembership grep gate).
const LEAGUE_CLUBS: LeagueClubs = Object.fromEntries(COMPETITIONS.map(comp => { const clubs = CLUBS.filter(c => c.competitionId === comp.id); return [comp.id, { clubs, playable: clubs.filter(c => c.playable && isHumanManageable(c.id)).length }]; }));
const CLUB_LEAGUE = new Map(CLUBS.map(c => [c.id, c.competitionId]));
const leagueOf = (clubId: string) => CLUB_LEAGUE.get(clubId) ?? "";
const identityStyle = (clubId: string) => clubIdentityStyle(clubVisualIdentity(clubId)).style as CSSProperties;

export default function NewGamePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nations, setNations] = useState<NationCode[]>(DEFAULT_NATIONS);
  const [competitionIds, setCompetitionIds] = useState<string[]>(DEFAULT_COMPETITIONS);
  const [clubId, setClubId] = useState<string>(TUMBA_CLUB_ID);
  const [hoverClubId, setHoverClubId] = useState<string | null>(null);
  const [managerName, setManagerName] = useState("");
  const [managerNationality, setManagerNationality] = useState<NationCode | "">("");
  const [managerDob, setManagerDob] = useState("");
  const [pass, setPass] = useState<ManagerPassFlavour>(DEFAULT_PASS);
  const [clubContexts, setClubContexts] = useState<Record<string, ClubPreseasonContext>>({});
  const [preseasonStart, setPreseasonStart] = useState<PreseasonStartOption>("4_WEEKS");
  const [worldOpen, setWorldOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const startSubmitted = useRef(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pointerTransition, setPointerTransition] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const availableCompetitions = useMemo(() => COMPETITIONS.filter(c => nations.includes(c.nation) && !c.outsideCareerWorld), [nations]);
  const availableClubs = useMemo(() => CLUBS.filter(c => competitionIds.includes(c.competitionId)), [competitionIds]);
  // Owner decision: a human manager can never select a B-team (CPU-only).
  const playableClubs = useMemo(() => availableClubs.filter(c => c.playable && isHumanManageable(c.id)).sort((a, b) => Number(b.id === TUMBA_CLUB_ID) - Number(a.id === TUMBA_CLUB_ID)), [availableClubs]);
  const worldClubs = availableClubs.filter(c => !c.playable || !isHumanManageable(c.id));
  const selectedClub = availableClubs.find(c => c.id === clubId && c.playable && isHumanManageable(c.id));
  const selectedCompetition = COMPETITIONS.find(c => c.id === selectedClub?.competitionId);
  const leagueKickoffDate = resolveLeagueKickoffDate(selectedClub?.competitionId ?? "", GAME_CURRENT_DATE);
  const computedStartDate = computeCareerStartDate(leagueKickoffDate, preseasonStart);
  const careerStartLabel = computedStartDate ? formatGameDate(computedStartDate) : "Första tävlingsmatchen · datum bestäms när matcherna skapas";
  const world: WorldSummary = { nations: nations.length, leagues: competitionIds.length, clubs: availableClubs.length, playable: playableClubs.length };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goToStep(next: number, pointerInitiated = false) {
    if (starting) return;
    setPointerTransition(pointerInitiated);
    setStep(next);
    setStartError(null);
  }
  function toggleNation(code: NationCode) {
    const next = nations.includes(code) ? nations.filter(n => n !== code) : [...nations, code];
    setNations(next);
    setCompetitionIds(prev => prev.filter(id => next.includes(COMPETITIONS.find(c => c.id === id)!.nation)));
  }
  function toggleCompetition(id: string) {
    setCompetitionIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }
  function resetWorld() { setNations(DEFAULT_NATIONS); setCompetitionIds(DEFAULT_COMPETITIONS); }
  const managerAge = managerDob ? Math.floor((Date.parse(`${GAME_CURRENT_DATE}T00:00:00Z`) - Date.parse(`${managerDob}T00:00:00Z`)) / (365.25 * 86400000)) : null;
  const managerIssue = managerName.trim().length < 2 ? "Skriv ett namn med minst två tecken." : !managerNationality ? "Välj managerns nationalitet." : managerAge === null || Number.isNaN(managerAge) ? "Ange födelsedatum." : managerAge < 18 || managerAge > 85 ? "Managern måste vara mellan 18 och 85 år." : null;
  const validSetup = nations.length > 0 && competitionIds.length > 0 && !!selectedClub && !managerIssue;

  useEffect(() => {
    let cancelled = false;
    for (const id of competitionIds.filter((c) => c === "se_handbollsligan_herr" || c === "swe-2")) {
      void fetchClubPreseasonContexts(id).then((list) => { if (!cancelled && list) setClubContexts((prev) => ({ ...prev, ...Object.fromEntries(list.map((c) => [c.clubId, c])) })); });
    }
    return () => { cancelled = true; };
  }, [competitionIds]);

  const selectedContext = selectedClub ? clubContexts[selectedClub.id] : undefined;
  const selectedIdentity = selectedClub ? resolveClubIdentity(selectedClub.id, selectedClub.shortName, selectedClub.primaryColor) : null;
  const previewClub = (hoverClubId ? playableClubs.find(c => c.id === hoverClubId) : undefined) ?? selectedClub;
  const previewing = !!previewClub && previewClub.id !== selectedClub?.id;

  function canProceed(): boolean {
    if (step === 0) return nations.length > 0 && competitionIds.length > 0 && !!selectedClub;
    if (step === 1) return !managerIssue;
    if (step === 2) return validSetup;
    return true;
  }
  const nextHint = !canProceed()
    ? step === 0 ? nations.length === 0 ? "Välj minst en nation i Världen." : competitionIds.length === 0 ? "Välj minst en liga i Världen." : "Välj en spelbar klubb från dina ligaval." : step === 1 ? managerIssue ?? "" : "Kontrollera klubb och manager innan du börjar."
    : step === 2 ? "Signera kontraktet – din första säsong väntar." : `Nästa: ${STEPS[step + 1]}`;

  async function handleStartCareer() {
    if (startSubmitted.current || !validSetup) return;
    startSubmitted.current = true;
    flushSync(() => setStarting(true));
    setStartError(null);
    try {
      await afterNextPaint();
      const save = await createNewCareerSave({
        selectedNations: nations,
        selectedCompetitionIds: competitionIds,
        clubId,
        manager: { name: managerName.trim(), nationality: managerNationality as NationCode, dateOfBirth: managerDob },
        gameDate: GAME_CURRENT_DATE,
        preseasonStart
      });
      // ENT-03e: the pass flavour is device-only presentation, never part of the save.
      writeManagerPass(save.saveId, pass);
      setActiveSaveId(save.saveId);
      router.push("/career");
    } catch (cause: unknown) {
      console.error('[new-game] Career initialization failed', cause);
      setStartError(cause instanceof Error ? cause.message : 'Karriären kunde inte skapas. Försök igen.');
    }
  }

  if (starting) return <CareerInitialization club={selectedClub} competition={selectedCompetition?.name} season={SEASON} signed failed={!!startError} errorMessage={startError ?? undefined} onBack={() => { startSubmitted.current = false; setStarting(false); setStartError(null); }} />;

  const managerTag = managerName.trim();
  const nationName = NATIONS.find(n => n.code === managerNationality)?.name;
  const rail = <>
    <span className="career-entry-overline">Nytt spel · {SEASON}</span><h2>Ditt nästa<br />uppdrag.</h2>
    <nav aria-label="Karriärens steg"><ol className="career-entry-steps ce-steps">{STEPS.map((label, index) => <li key={label} data-active={index === step} data-complete={index < step}><button type="button" disabled={index >= step || starting} aria-current={index === step ? "step" : undefined} onClick={event => goToStep(index, event.detail > 0)}><span className="career-step-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{label}</strong><small>{STEP_NOTES[index]}</small></span>{index < step && <b aria-label="Klart">✓</b>}</button></li>)}</ol></nav>
    <p className="career-entry-rail-note">Klubben först. Kontraktet sist.</p>
    <Link className="hm-btn hm-btn-sm" href="/settings">Inställningar</Link>
  </>;
  const context = <div className="ce-journal" style={previewClub ? identityStyle(previewClub.id) : undefined} data-previewing={previewing}>
    <div className="ce-journal-head">
      <span className="career-entry-overline">{previewing ? 'Förhandstitt' : selectedClub ? 'Din klubb' : 'Välj din klubb'}</span>
      {previewClub && <>
        <div className="career-entry-club-mark">
          <ClubCrest shortName={previewClub.shortName} primaryColor={previewClub.primaryColor} clubId={previewClub.id} size={126} />
          <CrestPlaceholderNote clubId={previewClub.id} />
        </div>
        <h2 className="career-entry-club-name">{previewClub.name}</h2>
        <p className="career-entry-club-league">{COMPETITIONS.find(c => c.id === previewClub.competitionId)?.name}</p>
      </>}
    </div>
    {selectedClub && !previewing ? <>
      {selectedIdentity?.heritageTag && <p className="ce-journal-heritage">{selectedIdentity.heritageTag}</p>}
      <dl className="career-entry-facts">
        {selectedClub.city && <Fact label="Hemort" value={selectedClub.city} />}
        {selectedClub.venue ? <Fact label="Arena" value={`${selectedClub.venue}${selectedClub.venueCity && selectedClub.venueCity !== selectedClub.city ? `, ${selectedClub.venueCity}` : ""}${selectedClub.venueCapacity ? ` · ${selectedClub.venueCapacity.toLocaleString("sv-SE")} platser` : ""}`} /> : <Fact label="Arena" value="Inte verifierad" />}
        {selectedContext && (
          <>
            <Fact label="Förhandstips" value={`${selectedContext.predicted}:a av ${selectedContext.clubsInLeague}`} />
            <Fact label="Truppstyrka mot serien" value={`${selectedContext.strengthVsLeague > 0 ? "+" : ""}${selectedContext.strengthVsLeague.toFixed(1)}`} />
            <Fact label="Ekonomi" value={selectedContext.economyLabel} />
          </>
        )}
        {selectedClub.founded && <Fact label="Grundad" value={String(selectedClub.founded)} />}
        <Fact label="Seriestart" value={formatGameDate(leagueKickoffDate)} />
      </dl>
      {selectedContext && <blockquote className="ce-mandate"><span className="career-entry-overline">Styrelsens förväntan</span><p>”{selectedContext.expectation}”</p></blockquote>}
    </> : !previewClub ? (
      <div className="career-entry-context-empty">
        <strong>En klubb att kalla hemma.</strong>
        <p>Dina ligaval avgör vilka klubbar du kan välja här.</p>
        <button className="hm-btn" onClick={() => setWorldOpen(true)}>Öppna Världen →</button>
      </div>
    ) : null}
    <section className="career-entry-manager-summary ce-byline" data-filled={!!managerTag}>
      <span className="career-entry-overline">Manager</span>
      <strong>{managerTag || 'Din manager'}</strong>
      <span className="hm-with-flag">
        {managerNationality && <NationFlag code={managerNationality} />}
        {nationName ?? 'Nationalitet ej vald'}{pass.philosophy ? ` · ${pass.philosophy}` : ''}
      </span>
    </section>
    <p className="ce-journal-world ce-num">{worldSummaryText(world)}</p>
  </div>;
  const footer = <><button type="button" className="hm-btn career-entry-back" disabled={starting} onClick={event => step === 0 ? router.push('/') : goToStep(step - 1, event.detail > 0)}>← Tillbaka</button><p aria-live="polite">{nextHint}</p>{step < STEPS.length - 1 ? <button type="button" className="hm-btn hm-btn-primary career-entry-next" disabled={!canProceed()} onClick={event => goToStep(step + 1, event.detail > 0)}>Nästa →</button> : <button type="button" className="hm-btn hm-btn-primary career-entry-start" disabled={!canProceed() || starting} onClick={handleStartCareer}>{starting ? 'STARTAR…' : 'STARTA KARRIÄR'}</button>}</>;

  return <CareerEntryFrame label="Börja din handbollskarriär" rail={rail} context={context} footer={footer} clubId={selectedClub?.id}>
    <div className="career-entry-content" ref={contentRef}>
      <div className="career-entry-step" key={step} data-motion={pointerTransition}>
        <header className="career-entry-step-heading"><span className="career-entry-overline">Steg {step + 1} av {STEPS.length} · {STEPS[step]}</span><h1 id="career-entry-heading" ref={headingRef} tabIndex={-1}>{['Välj din hemmaplan.', 'Vem är du?', 'Kontraktet.'][step]}</h1><p>{['Ett lag att forma. En klubb att tillhöra. Välj utmaningen som passar dig.', 'Fyll i ditt tränarpass inför första dagen i klubben.', 'Välj när ditt uppdrag börjar och signera.'][step]}</p></header>
        {selectedClub && <MobileJournal club={selectedClub} league={selectedCompetition?.name} expectation={selectedContext?.expectation} />}
        {step === 0 && <>
          <div className="ce-club-toolbar">
            <button type="button" className="ce-world-chip" onClick={() => setWorldOpen(true)} aria-haspopup="dialog" title={worldSummaryText(world)}>
              <span className="ce-kicker">Världen</span><span className="ce-num">{world.nations} {world.nations === 1 ? 'nation' : 'nationer'} · {world.leagues} {world.leagues === 1 ? 'liga' : 'ligor'}</span><span aria-hidden="true">›</span>
            </button>
            <span className="ce-num"><strong>{playableClubs.length}</strong> {playableClubs.length === 1 ? 'spelbar klubb' : 'spelbara klubbar'}</span>
          </div>
          <ClubWall clubs={playableClubs} worldClubs={worldClubs} competitions={availableCompetitions} leagueOf={leagueOf} contexts={clubContexts} selectedId={clubId} onSelect={setClubId} onHover={setHoverClubId} />
        </>}
        {step === 1 && <ManagerAccreditation clubName={selectedClub?.name} clubId={selectedClub?.id} name={managerName} nationality={managerNationality} dob={managerDob} issue={managerIssue} pass={pass}
          onName={setManagerName} onNationality={setManagerNationality} onDob={setManagerDob} onPass={setPass} />}
        {step === 2 && <section className="ce-contract" style={DEAL_SIGNED_BACKDROP}>
          <article className="ce-contract-doc">
            <header className="career-start-mandate ce-contract-head">
              <div><span className="career-entry-overline">Anställningsavtal · {SEASON}</span><h2>{managerName.trim()}</h2><p>Huvudtränare för <strong>{selectedClub?.name ?? 'Välj din klubb'}</strong></p></div>
              {selectedClub && <span className="ce-stamp"><ClubCrest shortName={selectedClub.shortName} primaryColor={selectedClub.primaryColor} clubId={selectedClub.id} size={84} /></span>}
            </header>
            {selectedContext && <blockquote className="ce-mandate ce-contract-quote"><span className="career-entry-overline">§ 1 · Styrelsens förväntan</span><p>”{selectedContext.expectation}”</p></blockquote>}
            <fieldset className="career-preseason-fieldset ce-clause"><legend>§ 2 · Tillträde – när börjar ditt uppdrag?</legend><div className="ce-clause-chips">{PRESEASON_START_OPTIONS.map(option => <label className="ce-chip" key={option} data-selected={preseasonStart === option}><input className="career-choice-input" type="radio" name="preseasonStart" aria-label={PRESEASON_OPTION_LABEL[option]} checked={preseasonStart === option} onChange={() => setPreseasonStart(option)} /><strong>{option === 'FIRST_MATCH' ? 'Avkast' : `${option.split('_')[0]} v`}</strong><span>{option === 'FIRST_MATCH' ? 'Första matchen' : formatGameDate(computeCareerStartDate(leagueKickoffDate, option)!)}</span></label>)}</div><p className="ce-clause-note">{PRESEASON_OPTION_LABEL[preseasonStart]}.{preseasonStart === 'FIRST_MATCH' ? ' Börja vid den första tävlingsmatchen, även om det är cup.' : ''}</p></fieldset>
            <dl className="career-start-summary"><Fact label="Klubb" value={selectedClub?.name ?? 'Välj en spelbar klubb'} /><Fact label="Liga" value={selectedCompetition?.name ?? '—'} /><Fact label="Din första dag" value={selectedClub ? careerStartLabel : 'Välj klubb först'} /><Fact label="Seriestart" value={selectedClub ? formatGameDate(leagueKickoffDate) : '—'} /><Fact label="Manager" value={managerName.trim() || '—'} /><Fact label="Nationalitet" value={nationName ?? '—'} /></dl>
            <footer className="ce-signature"><span className="ce-signature-line" aria-hidden="true">{managerName.trim()}</span><small>Du signerar med Starta karriär. Klubb, manager och försäsong kan inte ändras efteråt.</small></footer>
          </article>
        </section>}
      </div>
    </div>
    <WorldDrawer open={worldOpen} nations={nations} competitionIds={competitionIds} summary={world} leagueClubs={LEAGUE_CLUBS} onToggleNation={toggleNation} onToggleCompetition={toggleCompetition} onReset={resetWorld} onClose={() => setWorldOpen(false)} />
  </CareerEntryFrame>;
}

/** Phone/tablet: the context column is hidden there, so the chosen club rides along as a compact header card. */
function MobileJournal({ club, league, expectation }: { club: { id: string; name: string; shortName: string; primaryColor: string }; league?: string; expectation?: string }) {
  return <details className="ce-mobile-journal" style={identityStyle(club.id)}>
    <summary><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={36} /><span><strong>{club.name}</strong><small>{league}</small></span></summary>
    <p>{expectation ? `Styrelsens förväntan: ”${expectation}”` : 'Förhandstipset läses in.'}</p>
  </details>;
}

/** ENT-03e B: the manager fills in an accreditation pass; the inputs sit on the pass itself. */
function ManagerAccreditation({ clubName, clubId, name, nationality, dob, issue, pass, onName, onNationality, onDob, onPass }: {
  clubName?: string; clubId?: string; name: string; nationality: NationCode | ""; dob: string; issue: string | null; pass: ManagerPassFlavour;
  onName: (v: string) => void; onNationality: (v: NationCode | "") => void; onDob: (v: string) => void; onPass: (v: ManagerPassFlavour) => void;
}) {
  return <div className="ce-pass-stage">
    <section className="ce-pass" style={clubId ? identityStyle(clubId) : undefined} aria-label="Tränarpass">
      <span className="ce-lanyard" aria-hidden="true" />
      <header className="ce-pass-head"><span className="ce-kicker">Ackreditering · {SEASON}</span><strong>{clubName ?? 'Din nästa klubb'}</strong></header>
      <div className="ce-pass-body">
        <div className="ce-pass-photo" data-portrait={pass.portrait} aria-hidden="true">{pass.portrait === 'MONOGRAM' ? initialsOf(name) : <PassFigure kind={pass.portrait} />}</div>
        <div className="ce-pass-fields">
          <Field label="Namn"><input className="hm-input ce-pass-input ce-pass-name" autoComplete="name" value={name} onChange={event => onName(event.target.value)} placeholder="För- och efternamn" /></Field>
          <Field label="Nationalitet"><span className="hm-with-flag"><NationFlag code={nationality} /><select className="hm-select ce-pass-input" required value={nationality} onChange={event => onNationality(event.target.value as NationCode | "")}><option value="" disabled>Välj nationalitet</option>{NATIONS.map(nation => <option value={nation.code} key={nation.code}>{nation.name}</option>)}</select></span></Field>
          <Field label="Födelsedatum"><input className="hm-input ce-pass-input" type="date" required value={dob} max={`${Number(GAME_CURRENT_DATE.slice(0, 4)) - 18}-12-31`} onChange={event => onDob(event.target.value)} /></Field>
        </div>
      </div>
      <footer className="ce-pass-foot"><span className="ce-kicker">Roll</span><strong>Huvudtränare</strong>{pass.philosophy && <em>”{pass.philosophy}”</em>}</footer>
    </section>
    <div className="ce-pass-options">
      {issue && <p className="ce-pass-issue" role="status">{issue}</p>}
      <fieldset><legend className="ce-kicker">Passfoto</legend><div className="ce-seg">{PASS_PORTRAITS.map(p => <label key={p.value} data-selected={pass.portrait === p.value}><input type="radio" name="passPortrait" checked={pass.portrait === p.value} onChange={() => onPass({ ...pass, portrait: p.value })} />{p.label}</label>)}</div></fieldset>
      <label className="ce-pass-philosophy"><span className="ce-kicker">Tränarfilosofi · valfri</span><select className="hm-select" value={pass.philosophy ?? ""} onChange={event => onPass({ ...pass, philosophy: event.target.value || null })}><option value="">Ingen – hoppa över</option>{PASS_PHILOSOPHIES.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <p className="ce-pass-help">Ditt namn följer klubben genom karriären. Passfoto och filosofi syns bara på ditt tränarpass på den här enheten och påverkar inte spelet.</p>
    </div>
  </div>;
}

function PassFigure({ kind }: { kind: ManagerPassFlavour["portrait"] }) {
  return kind === 'WHISTLE'
    ? <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="38" cy="38" r="14" /><path d="M24 34H8v8h16M38 24v-8M31 38h14" /></svg>
    : <svg viewBox="0 0 64 64" width="64" height="64" fill="currentColor"><circle cx="32" cy="22" r="12" /><path d="M10 60c2-14 11-22 22-22s20 8 22 22z" /></svg>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="career-manager-field"><span>{label}</span>{children}</label>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
