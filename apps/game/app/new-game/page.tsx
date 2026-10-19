"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from 'react-dom';
import CareerInitialization from '@/components/game/CareerInitialization';
import { afterNextPaint } from '@/lib/ui/afterNextPaint';
import { NATIONS, COMPETITIONS, CLUBS, TUMBA_CLUB_ID, GAME_CURRENT_DATE, type NationCode } from "@/lib/game-data";
import { setActiveSaveId } from "@/lib/save/saveRepository";
import { createNewCareerSave } from '@/lib/career/careerInitialization';
import ClubCrest from "@/components/ClubCrest";
import CareerEntryFrame from "@/components/game/CareerEntryFrame";
import { formatGameDate } from "@/lib/career/dateUtils";
import { PRESEASON_START_OPTIONS, computeCareerStartDate, resolveLeagueKickoffDate, type PreseasonStartOption } from "@/lib/career/preseason";
import "@/components/game/career-entry.css";

const PRESEASON_OPTION_LABEL: Record<PreseasonStartOption, string> = {
  "8_WEEKS": "8 veckor före seriestart",
  "6_WEEKS": "6 veckor före seriestart",
  "4_WEEKS": "4 veckor före seriestart",
  "2_WEEKS": "2 veckor före seriestart",
  FIRST_MATCH: "Vid första tävlingsmatchen",
};
const STEPS = ["Nationer", "Ligor", "Databas", "Klubb", "Manager", "Starta"] as const;
const STEP_NOTES = ["Välj handbollsnationer", "Utforska ligorna", "Överblicka dina val", "Hitta din hemmaplan", "Vem leder laget?", "Börja din första säsong"] as const;
// Division 1 remains a recruitment pool, never a selectable career competition.
const NON_SELECTABLE_COMPETITION_IDS = new Set(["se_division1_norra", "se_division1_sodra"]);

export default function NewGamePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nations, setNations] = useState<NationCode[]>(["SWE"]);
  const [competitionIds, setCompetitionIds] = useState<string[]>(["se_handbollsligan_herr", "swe-2"]);
  const [clubId, setClubId] = useState<string>(TUMBA_CLUB_ID);
  const [managerName, setManagerName] = useState("");
  const [managerNationality, setManagerNationality] = useState<NationCode>("SWE");
  const [managerDob, setManagerDob] = useState("1988-01-01");
  const [preseasonStart, setPreseasonStart] = useState<PreseasonStartOption>("4_WEEKS");
  const [starting, setStarting] = useState(false);
  const startSubmitted = useRef(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pointerTransition, setPointerTransition] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const availableCompetitions = useMemo(() => COMPETITIONS.filter(c => nations.includes(c.nation) && !NON_SELECTABLE_COMPETITION_IDS.has(c.id)), [nations]);
  const availableClubs = useMemo(() => CLUBS.filter(c => competitionIds.includes(c.competitionId)), [competitionIds]);
  // Keep a stable radio order for arrow-key selection, with the default club visible first.
  const playableClubs = useMemo(() => availableClubs.filter(c => c.playable).sort((a, b) => Number(b.id === TUMBA_CLUB_ID) - Number(a.id === TUMBA_CLUB_ID)), [availableClubs]);
  const worldClubs = availableClubs.filter(c => !c.playable);
  // An earlier club choice cannot silently survive removing its league.
  const selectedClub = availableClubs.find(c => c.id === clubId && c.playable);
  const selectedCompetition = COMPETITIONS.find(c => c.id === selectedClub?.competitionId);
  const selectedNations = NATIONS.filter(n => nations.includes(n.code));
  const selectedCompetitions = availableCompetitions.filter(c => competitionIds.includes(c.id));
  const leagueKickoffDate = resolveLeagueKickoffDate(selectedClub?.competitionId ?? "", GAME_CURRENT_DATE);
  const computedStartDate = computeCareerStartDate(leagueKickoffDate, preseasonStart);
  const careerStartLabel = computedStartDate ? formatGameDate(computedStartDate) : "Första tävlingsmatchen · datum bestäms när matcherna skapas";

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
  const validSetup = nations.length > 0 && competitionIds.length > 0 && !!selectedClub && managerName.trim().length > 1;
  function canProceed(): boolean {
    if (step === 0) return nations.length > 0;
    if (step === 1) return competitionIds.length > 0;
    if (step === 3) return !!selectedClub;
    if (step === 4) return managerName.trim().length > 1;
    if (step === 5) return validSetup;
    return true;
  }
  const nextHint = !canProceed() ? step === 0 ? "Välj minst en nation." : step === 1 ? "Välj minst en liga." : step === 3 ? "Välj en spelbar klubb från dina ligaval." : step === 4 ? "Skriv ett namn med minst två tecken." : "Kontrollera klubb och manager innan du börjar." : step === 5 ? "Din första säsong väntar." : `Nästa: ${STEPS[step + 1]}`;

  async function handleStartCareer() {
    if (startSubmitted.current || !validSetup) return;
    startSubmitted.current = true;
    flushSync(() => setStarting(true));
    setStartError(null);
    try {
      await afterNextPaint();
      const save = await createNewCareerSave({ selectedNations: nations, selectedCompetitionIds: competitionIds, clubId,
        manager: { name: managerName.trim(), nationality: managerNationality, dateOfBirth: managerDob }, gameDate: GAME_CURRENT_DATE, preseasonStart });
      setActiveSaveId(save.saveId);
      router.push("/career");
    } catch (cause: unknown) {
      console.error('[new-game] Career initialization failed', cause);
      setStartError(cause instanceof Error ? cause.message : 'Karriären kunde inte skapas. Försök igen.');
    }
  }

  // Failed initialization has not published a save; preserve the setup for retry.
  if (starting) return <CareerInitialization club={selectedClub} competition={selectedCompetition?.name} season={`${Number(GAME_CURRENT_DATE.slice(0, 4))}/${String(Number(GAME_CURRENT_DATE.slice(0, 4)) + 1).slice(-2)}`} failed={!!startError} errorMessage={startError ?? undefined} onBack={() => { startSubmitted.current = false; setStarting(false); setStartError(null); }} />;

  const rail = <>
    <span className="career-entry-overline">Nytt spel · 2026/27</span><h2>Ditt nästa<br />uppdrag.</h2>
    <nav aria-label="Karriärens steg"><ol className="career-entry-steps">{STEPS.map((label, index) => <li key={label} data-active={index === step} data-complete={index < step}><button type="button" disabled={index >= step || starting} aria-current={index === step ? "step" : undefined} onClick={event => goToStep(index, event.detail > 0)}><span className="career-step-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{label}</strong><small>{STEP_NOTES[index]}</small></span>{index < step && <b aria-label="Klart">✓</b>}</button></li>)}</ol></nav>
    <p className="career-entry-rail-note">Från första lagbygget till sista slutsignalen.</p>
  </>;
  const context = <>
    <span className="career-entry-overline">{selectedClub ? step < 3 ? 'Förvald klubb' : 'Din klubb' : 'Välj din klubb'}</span>
    {selectedClub ? <><div className="career-entry-club-mark"><ClubCrest shortName={selectedClub.shortName} primaryColor={selectedClub.primaryColor} size={126} /></div><h2 className="career-entry-club-name">{selectedClub.name}</h2><p className="career-entry-club-league">{selectedCompetition?.name}</p><dl className="career-entry-facts">{selectedClub.city && <Fact label="Hemmaplan" value={selectedClub.city} />}{selectedClub.venue && <Fact label="Arena" value={selectedClub.venue} />}{selectedClub.founded && <Fact label="Grundad" value={String(selectedClub.founded)} />}<Fact label="Seriestart" value={formatGameDate(leagueKickoffDate)} /></dl></> : <div className="career-entry-context-empty"><strong>En klubb att kalla hemma.</strong><p>Dina ligaval avgör vilka klubbar du kan välja här.</p><button className="hm-btn" onClick={() => goToStep(1)}>Se över ligaval →</button></div>}
    <section className="career-entry-manager-summary"><span className="career-entry-overline">På bänken</span><strong>{managerName.trim() || 'Din manager'}</strong><span>{NATIONS.find(n => n.code === managerNationality)?.name}</span></section>
    <div className="career-entry-world-summary"><div><strong>{nations.length}</strong><small>{nations.length === 1 ? 'nation vald' : 'nationer valda'}</small></div><div><strong>{competitionIds.length}</strong><small>{competitionIds.length === 1 ? 'liga vald' : 'ligor valda'}</small></div><div><strong>{playableClubs.length}</strong><small>{playableClubs.length === 1 ? 'spelbar klubb' : 'spelbara klubbar'}</small></div></div>
  </>;
  const footer = <><button type="button" className="hm-btn career-entry-back" disabled={starting} onClick={event => step === 0 ? router.push('/') : goToStep(step - 1, event.detail > 0)}>← Tillbaka</button><p aria-live="polite">{nextHint}</p>{step < STEPS.length - 1 ? <button type="button" className="hm-btn hm-btn-primary career-entry-next" disabled={!canProceed()} onClick={event => goToStep(step + 1, event.detail > 0)}>Nästa →</button> : <button type="button" className="hm-btn hm-btn-primary career-entry-start" disabled={!canProceed() || starting} onClick={handleStartCareer}>{starting ? 'STARTAR…' : 'STARTA KARRIÄR'}</button>}</>;

  return <CareerEntryFrame label="Börja din handbollskarriär" rail={rail} context={context} footer={footer}>
    <div className="career-entry-content" ref={contentRef}>
      <div className="career-entry-step" key={step} data-motion={pointerTransition}>
        <header className="career-entry-step-heading"><span className="career-entry-overline">Steg {step + 1} av {STEPS.length} · {STEPS[step]}</span><h1 id="career-entry-heading" ref={headingRef} tabIndex={-1}>{['Din handbollsvärld.', 'Ligorna omkring dig.', 'Dina val. Ditt uppdrag.', 'Välj din hemmaplan.', 'Du leder laget.', 'En ny säsong börjar.'][step]}</h1><p>{['Välj de nationer du vill ha i din karriärs inställningar.', 'Välj ligorna du vill utforska och hitta en spelbar klubb.', 'Överblicka nationerna, ligorna och klubbarna du har valt.', 'Ett lag att forma. En klubb att tillhöra.', 'Skapa din managerprofil inför första dagen i klubben.', 'Välj din försäsong och ta plats på tränarbänken.'][step]}</p></header>
        {step === 0 && <><div className="career-nation-grid">{NATIONS.map(nation => { const leagues = COMPETITIONS.filter(c => c.nation === nation.code && !NON_SELECTABLE_COMPETITION_IDS.has(c.id)); return <label className="career-choice career-nation-choice" key={nation.code} data-selected={nations.includes(nation.code)}><input className="career-choice-input" type="checkbox" aria-label={nation.name} checked={nations.includes(nation.code)} onChange={() => toggleNation(nation.code)} /><span className="career-nation-code" aria-hidden="true">{nation.code}</span><span className="career-choice-name">{nation.name}</span><small>{leagues.length} {leagues.length === 1 ? 'liga' : 'ligor'} i urvalet</small><span className="career-choice-state" aria-hidden="true">{nations.includes(nation.code) ? '✓ Vald' : '+ Välj'}</span></label>; })}</div><div className="career-entry-note"><strong>Börja med klubben du vill leda.</strong><p>Spelbara karriärer finns i samtliga klubbar i Handbollsligan och Allsvenskan. Övriga nationer ger fler ligor att utforska i urvalet.</p></div></>}
        {step === 1 && <><div className="career-league-groups">{nations.map(nation => <section key={nation}><h2>{NATIONS.find(n => n.code === nation)?.name}</h2><div className="career-league-grid">{availableCompetitions.filter(c => c.nation === nation).map(competition => { const clubs = CLUBS.filter(c => c.competitionId === competition.id); const playable = clubs.filter(c => c.playable).length; return <label className="career-choice career-league-choice" key={competition.id} data-selected={competitionIds.includes(competition.id)}><input className="career-choice-input" type="checkbox" aria-label={competition.name} checked={competitionIds.includes(competition.id)} onChange={() => toggleCompetition(competition.id)} /><span className="career-league-tier" aria-hidden="true">{String(competition.tier).padStart(2, '0')}</span><span><strong className="career-choice-name">{competition.name}</strong><small>Herrarnas nivå {competition.tier} · {clubs.length} {clubs.length === 1 ? 'klubb' : 'klubbar'}</small><b>{playable ? `${playable} ${playable === 1 ? 'spelbar klubb' : 'spelbara klubbar'}` : 'Klubbar att utforska'}</b></span><span className="career-choice-state" aria-hidden="true">{competitionIds.includes(competition.id) ? '✓ Vald' : '+ Välj'}</span></label>; })}</div></section>)}</div>{playableClubs.length === 0 && <div className="career-entry-note" role="status"><strong>Ingen spelbar klubb i dina ligaval ännu.</strong><p>Välj Handbollsligan eller Allsvenskan i Sverige för att börja en karriär.</p></div>}</>}
        {step === 2 && <><div className="career-database-stats"><MiniStat label={nations.length === 1 ? 'Nation vald' : 'Nationer valda'} value={nations.length} /><MiniStat label={competitionIds.length === 1 ? 'Liga vald' : 'Ligor valda'} value={competitionIds.length} /><MiniStat label={availableClubs.length === 1 ? 'Klubb i ligavalet' : 'Klubbar i ligavalet'} value={availableClubs.length} /><MiniStat label={playableClubs.length === 1 ? 'Spelbar klubb' : 'Spelbara klubbar'} value={playableClubs.length} /></div><div className="career-database-world"><section><span className="career-entry-overline">Dina handbollsnationer</span><h2>{selectedNations.map(nation => nation.name).join(' · ')}</h2><ul>{selectedCompetitions.map(competition => <li key={competition.id}><strong>{competition.name}</strong><span>{CLUBS.filter(c => c.competitionId === competition.id).length} klubbar</span></li>)}</ul></section><section className="career-entry-note"><strong>En levande säsong.</strong><p>Spelar- och klubbidentiteter hämtas från den befintliga databasen där de finns. Matchresultat, utveckling och ekonomi följer spelets säsong.</p><p>Ligavalet styr vilka klubbar som visas i nästa steg. Spelvärlden innehåller även klubbar utanför dina ligaval.</p></section></div></>}
        {step === 3 && <><div className="career-club-toolbar"><span><strong>{playableClubs.length}</strong> {playableClubs.length === 1 ? 'spelbar klubb' : 'spelbara klubbar'} i dina ligaval</span><button className="hm-btn hm-btn-sm" onClick={() => goToStep(1)}>Ändra ligaval →</button></div>{playableClubs.length ? <fieldset className="career-club-fieldset"><legend className="career-entry-sr-only">Välj klubb</legend><div className="career-club-grid">{playableClubs.map(club => <label className="career-choice career-club-choice" key={club.id} data-selected={clubId === club.id}><input className="career-choice-input" type="radio" name="careerClub" aria-label={club.name} checked={clubId === club.id} onChange={() => setClubId(club.id)} /><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={45} /><span><strong className="career-choice-name">{club.name}</strong><small>{COMPETITIONS.find(c => c.id === club.competitionId)?.name}</small>{club.city && <small>{club.city}</small>}</span><span className="career-choice-state" aria-hidden="true">{clubId === club.id ? '✓ Din klubb' : 'Välj →'}</span></label>)}</div></fieldset> : <div className="career-entry-empty"><strong>Hitta en klubb att leda.</strong><p>Ingen av klubbarna i dina ligaval är spelbar. Välj en svensk liga för att fortsätta.</p><button className="hm-btn hm-btn-primary" onClick={() => goToStep(1)}>Välj spelbar liga →</button></div>}{worldClubs.length > 0 && <details className="career-world-clubs"><summary>{worldClubs.length} {worldClubs.length === 1 ? 'annan klubb' : 'andra klubbar'} i dina ligaval</summary><p>Dessa klubbar finns i urvalet, men kan inte väljas för din managerkarriär.</p><ul>{worldClubs.map(club => <li key={club.id}><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={23} /><strong>{club.name}</strong><span>{COMPETITIONS.find(c => c.id === club.competitionId)?.name}</span></li>)}</ul></details>}</>}
        {step === 4 && <div className="career-manager-layout"><div className="career-manager-fields"><Field label="Namn"><input className="hm-input" autoComplete="name" value={managerName} onChange={event => setManagerName(event.target.value)} placeholder="För- och efternamn" /></Field><Field label="Nationalitet"><select className="hm-select" value={managerNationality} onChange={event => setManagerNationality(event.target.value as NationCode)}>{NATIONS.map(nation => <option value={nation.code} key={nation.code}>{nation.name}</option>)}</select></Field><Field label="Födelsedatum"><input className="hm-input" type="date" value={managerDob} onChange={event => setManagerDob(event.target.value)} /></Field><p>Ditt namn följer klubben genom karriären.</p></div><section className="career-manager-pass"><span className="career-entry-overline">Tränarbänken · 2026/27</span><div className="career-manager-initials" aria-hidden="true">{managerName.trim().split(/\s+/).filter(Boolean).map(name => name[0]).slice(0, 2).join('').toUpperCase() || 'HM'}</div><h2>{managerName.trim() || 'Ditt namn'}</h2><p>Manager · {selectedClub?.name ?? 'Din nästa klubb'}</p><span>{NATIONS.find(nation => nation.code === managerNationality)?.name}</span></section></div>}
        {step === 5 && <><section className="career-start-mandate"><div><span className="career-entry-overline">Ditt uppdrag · 2026/27</span><h2>{managerName.trim()}</h2><p>tar plats hos <strong>{selectedClub?.name ?? 'Välj din klubb'}</strong></p></div>{selectedClub && <ClubCrest shortName={selectedClub.shortName} primaryColor={selectedClub.primaryColor} size={84} />}</section><fieldset className="career-preseason-fieldset"><legend>Försäsong · när börjar ditt uppdrag?</legend><div className="career-preseason-grid">{PRESEASON_START_OPTIONS.map(option => <label className="career-choice career-preseason-choice" key={option} data-selected={preseasonStart === option}><input className="career-choice-input" type="radio" name="preseasonStart" aria-label={PRESEASON_OPTION_LABEL[option]} checked={preseasonStart === option} onChange={() => setPreseasonStart(option)} /><strong>{option === 'FIRST_MATCH' ? 'Avkast' : option.split('_')[0]}</strong><span>{PRESEASON_OPTION_LABEL[option]}</span><small>{option === 'FIRST_MATCH' ? 'Börja vid den första tävlingsmatchen, även om det är cup.' : `${formatGameDate(computeCareerStartDate(leagueKickoffDate, option)!)}`}</small></label>)}</div></fieldset><dl className="career-start-summary"><Fact label="Klubb" value={selectedClub?.name ?? 'Välj en spelbar klubb'} /><Fact label="Liga" value={selectedCompetition?.name ?? '—'} /><Fact label="Din första dag" value={selectedClub ? careerStartLabel : 'Välj klubb först'} /><Fact label="Seriestart" value={selectedClub ? formatGameDate(leagueKickoffDate) : '—'} /><Fact label="Manager" value={managerName.trim() || '—'} /><Fact label="Nationalitet" value={NATIONS.find(n => n.code === managerNationality)?.name ?? '—'} /></dl></>}
      </div>
    </div>
  </CareerEntryFrame>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="career-manager-field"><span>{label}</span>{children}</label>; }
function MiniStat({ label, value }: { label: string; value: number }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
