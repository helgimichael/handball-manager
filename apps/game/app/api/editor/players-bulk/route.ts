// HM-PLAYER-DATA-EDITOR-1.0: the bulk calibration workspace's ONE read
// endpoint -- every player across every real-world club (Handbollsligan
// + Allsvenskan; every competition present under data/real-world/ today
// -- see catalog.ts's own note that no other nation currently has real
// player data), merged with identity/roster (playerRepository.ts) and
// resolved rating (ratingWorkbench.ts, the SAME resolver
// snapshotGameplayRatingsForClub itself is built from). Read-only; never
// mutates anything.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildCatalog } from "@/lib/editor/catalog";
import { listAllPlayersFull } from "@/lib/editor/playerRepository";
import { buildRatingWorkbenchForClub, type RatingWorkbenchRow } from "@/lib/editor/ratingWorkbench";
import { abilityStarsFromCA, potentialStarsFromPA } from "@/lib/development/types";
import { getCompetition } from "@/lib/game-data/competitions";
import { GAME_CURRENT_DATE } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { mapHandballPositionToMatchPlanPosition } from "@/lib/matchPlan/careerSquadBridge";
import { generateContractEndDate } from "@/lib/economy/contractGeneration";
import { computePlayerMarketValueEur } from "@/lib/economy/marketValue";
import type { HandballPosition } from "@/lib/game-data/types";

const PREVIEW_ROLE = "STARTER" as const; // a neutral, documented assumption for the audit-only market-value preview -- never a real career's own resolved MatchRole.
const PREVIEW_CONTRACT_YEARS = 2;

export async function GET() {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }

  const catalog = buildCatalog();
  const records = listAllPlayersFull(catalog);

  // Rating workbench is club-scoped (ratingWorkbench.ts re-derives the
  // full proposal->estimate->game-prior->generation chain per club) --
  // computed once per club, not once per player.
  const clubIds = [...new Set(records.map((r) => r.clubId))];
  const ratingByPlayerId = new Map<string, RatingWorkbenchRow>();
  for (const clubId of clubIds) {
    const workbench = buildRatingWorkbenchForClub(clubId);
    if (!workbench) continue;
    for (const row of workbench.rows) {
      ratingByPlayerId.set(row.profile.playerId, row);
    }
  }

  const rows = records.map((record) => {
    const club = catalog.clubs.find((c) => c.clubId === record.clubId);
    const rating = ratingByPlayerId.get(record.playerId);
    const ca = rating?.profile.ca.value ?? null;
    const pa = rating?.profile.pa.value ?? null;

    const ageYears = playerAgeAtDate(record.player.dateOfBirth, record.player.birthYear, GAME_CURRENT_DATE);

    let marketValueEurPreview: number | null = null;
    if (ca !== null && pa !== null && ageYears !== null && club) {
      const competitionTier = getCompetition(club.competitionId)?.tier;
      const contractEndDate = generateContractEndDate(record.playerId, "", Number(GAME_CURRENT_DATE.slice(0, 4)) + PREVIEW_CONTRACT_YEARS);
      try {
        marketValueEurPreview = computePlayerMarketValueEur(
          { ca, pa, age: ageYears, position: mapHandballPositionToMatchPlanPosition(record.roster.primaryPosition as HandballPosition), role: PREVIEW_ROLE, competitionTier },
          contractEndDate,
          GAME_CURRENT_DATE,
        );
      } catch {
        marketValueEurPreview = null; // never let a preview-only computation take down the whole listing
      }
    }

    return {
      playerId: record.playerId,
      clubId: record.clubId,
      clubName: record.clubName,
      competitionId: club?.competitionId ?? "",
      competitionSlug: club?.competitionSlug ?? "",
      player: record.player,
      roster: record.roster,
      readOnly: {
        ...record.readOnly,
        ageYears,
        contractEndDisplay: record.roster.contract.untilDate ?? record.roster.contract.untilSeason ?? "—",
        marketValueEurPreview,
      },
      rating: {
        ca,
        pa,
        abilityStars: ca !== null ? abilityStarsFromCA(ca) : 0,
        potentialStars: pa !== null ? potentialStarsFromPA(pa) : 0,
        caSource: rating?.caSource ?? "UNRESOLVED",
        paSource: rating?.paSource ?? "UNRESOLVED",
        locked: rating?.locked !== null && rating?.locked !== undefined,
        matchedCalibration: rating?.matchedCalibration ?? false,
      },
    };
  });

  return NextResponse.json({ players: rows });
}
