"use client";
// HM-TRAINING-1.0 Part 24/25 -> Arena Nights TRN-01 (C: Assistant Proposal).
// The page opens on the assistant's weekly proposal drawn as a diff over
// the week grid with projected matchday readiness before -> after; the
// block planner (TRN-01b) stays fully editable underneath ("Mitt schema").
// Then individual advice, the shared readiness strip (TRN-01c) and the
// development leaderboard (TRN-01d). Executed days carry their outcome
// in the grid (TRN-01e); the Suspense fallback is a skeleton grid (TRN-01f).
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clubColorVars } from "@/components/game/Identity";
import { EnvironmentBanner } from "@/components/clubhq/EnvironmentBanner";
import AssistantTrainingPanel, { useAssistantTraining } from "@/components/manager/AssistantTrainingPanel";
import WeekBlockPlanner from "@/components/training/WeekBlockPlanner";
import ProposalDiffGrid, { proposalDiff } from "@/components/training/ProposalDiffGrid";
import ReadinessForecast, { targetLabel } from "@/components/training/ReadinessForecast";
import AssistantAdviceList from "@/components/training/AssistantAdviceList";
import PlayerReadinessStrip from "@/components/training/PlayerReadinessStrip";
import DevelopmentLeaderboard from "@/components/training/DevelopmentLeaderboard";
import TrainingWeekSkeleton from "@/components/training/TrainingWeekSkeleton";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { mondayOf, resolveTrainingWeek } from "@/lib/training/trainingSchedule";
import { projectWeekReadiness } from "@/lib/training/readinessProjection";
import { matchFitnessOf } from "@/lib/players/matchFitness";
import { ENERGY_START_DEFAULT } from "@/lib/matchPlan/physicalModel";
import type { PlayerTrainingLoadSetting } from "@/lib/training/types";

export default function TrainingPage() {
  return <Suspense fallback={<TrainingWeekSkeleton />}><Training /></Suspense>;
}

function Training() {
  const params = useSearchParams();
  const requestedWeek = params.get("week");
  const { career } = useCareer();
  const [weekStart, setWeekStart] = useState(() => mondayOf(requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) && !Number.isNaN(Date.parse(requestedWeek)) ? requestedWeek : career.gameDate));
  const [view, setView] = useState<"proposal" | "mine">("proposal");
  const [editing, setEditing] = useState(false);
  const ctx = useAssistantTraining(weekStart);
  const { plan } = ctx;

  const club = getClub(career.playerClubId);
  const liveWeek = useMemo(() => resolveTrainingWeek(career, weekStart), [career, weekStart]);
  const live = useMemo(() => projectWeekReadiness(career, liveWeek), [career, liveWeek]);
  const proposed = useMemo(() => {
    if (!plan) return null;
    const loadOverrides: Record<string, PlayerTrainingLoadSetting> = Object.fromEntries(plan.players.filter((p) => p.selected).map((p) => [p.playerId, p.loadSetting]));
    return projectWeekReadiness(career, plan.week, { loadOverrides });
  }, [career, plan]);
  const diff = plan ? proposalDiff(ctx, liveWeek) : null;
  const showDiff = !!plan && !!diff && view === "proposal";
  const target = targetLabel(career, live);

  const squad = getCareerSquad(career);
  const averageMatchFitness = squad.length ? Math.round(squad.reduce((n, p) => n + matchFitnessOf(career, p.id), 0) / squad.length) : null;
  const averageReadiness = squad.length ? Math.round(squad.reduce((n, p) => n + (career.playerPhysicalState[p.id]?.currentEnergy ?? ENERGY_START_DEFAULT), 0) / squad.length) : null;
  const sessionCount = liveWeek.days.reduce((n, d) => n + d.sessions.length, 0);
  const recoveryDays = liveWeek.days.filter((d) => d.dayType === "REST" || d.dayType === "RECOVERY").length;

  return (
    <div className="hm-training-screen trn-screen" style={clubColorVars(club)}>
      <EnvironmentBanner
        environment="training-hall"
        eyebrow={`${club?.name ?? career.playerClubId} · Träningshallen & Gymmet`}
        title="Träning & Återhämtning"
        subtitle="Planera veckan mellan matcherna, se hur den påverkar matchberedskapen och styr individuell belastning."
        badge={`Vecka ${weekStart}`}
        actions={
          <>
            <Link className="hm-btn hm-btn-sm" href="/career/staff">Ledarstab →</Link>
            <Link className="hm-btn hm-btn-sm" href="/career/calendar">Säsongskalender →</Link>
          </>
        }
        metrics={[
          { label: "Planerade pass", value: `${sessionCount} st`, sub: `${recoveryDays} vilo- / återhämtningsdagar`, tone: "signal" },
          { label: "Beredskap", value: averageReadiness === null ? "—" : `${averageReadiness}%`, sub: "Truppens snitt idag", tone: (averageReadiness ?? 100) >= 80 ? "positive" : "warning" },
          { label: "Matchform", value: `${averageMatchFitness ?? "—"}%`, sub: "Skärpa inför match", tone: (averageMatchFitness ?? 100) >= 75 ? "positive" : "warning" },
        ]}
      />

      <AssistantTrainingPanel
        ctx={ctx}
        weekStart={weekStart}
        editing={editing}
        onToggleEdit={() => { setEditing((e) => !e); setView("proposal"); }}
        effect={plan && proposed ? { targetLabel: target, before: live.averageProjected, after: proposed.averageProjected, changedDays: diff?.filter((d) => d.changed).length ?? 0 } : undefined}
      />

      {plan && (
        <div className="trn-viewswitch" role="group" aria-label="Visa veckoschema">
          <button type="button" aria-pressed={view === "proposal"} onClick={() => setView("proposal")}>Förslaget</button>
          <button type="button" aria-pressed={view === "mine"} onClick={() => { setView("mine"); setEditing(false); }}>Mitt schema (redigera)</button>
        </div>
      )}

      <div className="trn-main">
        {showDiff ? (
          <ProposalDiffGrid ctx={ctx} liveWeek={liveWeek} diff={diff!} editing={editing} />
        ) : (
          <WeekBlockPlanner
            weekStart={weekStart}
            week={liveWeek}
            onWeekChange={setWeekStart}
            warning={plan && !plan.teamApplied ? "Ett förslag väntar. Ändrar du ditt schema nu kan förslaget inte godkännas – be då assistenten om ett nytt." : undefined}
          />
        )}
        <ReadinessForecast career={career} live={live} proposed={proposed} />
      </div>

      <AssistantAdviceList ctx={ctx} live={live} proposed={proposed} />
      <PlayerReadinessStrip projection={live} targetLabel={target} />
      <DevelopmentLeaderboard />
    </div>
  );
}
