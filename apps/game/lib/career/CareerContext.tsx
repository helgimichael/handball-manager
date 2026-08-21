"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { getClub, type PlayerMock } from "../game-data";
import { getActiveSave, saveCareerState, type CareerSave } from "../save/saveRepository";
import { createNewCareerState } from "./newCareer";
import { continueCareerRhythm, type ContinueStopReason } from "./continueController";
import { archiveMessage, markMessageRead, unarchiveMessage } from "./inboxActions";
import { playManagerFixture } from "./matchdayAction";
import { migrateCareerState } from "./saveMigration";
import { updateTacticalProfile } from "./tacticalProfileActions";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerEvent } from "./careerEvents";
import type { CareerState } from "./types";

type CareerContextValue = {
  save: CareerSave;
  career: CareerState;
  /**
   * CONTINUE (HM-GAME-0.3): advances the Career Rhythm world through
   * unprocessed days until a stop condition is reached, and persists.
   * Returns every CareerEvent generated this press, and why it stopped,
   * so the caller can navigate appropriately (e.g. to Match Preview on
   * MATCHDAY_READY, or to the Inbox on an IMPORTANT stop).
   */
  continueCareer: () => { events: CareerEvent[]; stopReason: ContinueStopReason };
  /** Resolves the manager's own MATCHDAY_READY fixture for the current date and persists. */
  playManagerFixture: () => { result: FastMatchResult | null };
  /** Marks one Inbox message (and its linked CareerEvent, if any) as read, and persists. */
  markInboxMessageRead: (messageId: string) => void;
  /** Archives one Inbox message. No-ops (and the caller should not assume success) for an unresolved ACTION_REQUIRED message (Spec §25). */
  archiveInboxMessage: (messageId: string) => void;
  /** Restores one archived Inbox message to the active Inbox. */
  unarchiveInboxMessage: (messageId: string) => void;
  /** Updates only the manager's TeamTacticalProfile (HM-TACTICS-0.6A), and persists. Not consumed by Fast Match yet. */
  updateTacticalProfile: (changes: Partial<TeamTacticalProfile>) => void;
};

const CareerContext = createContext<CareerContextValue | null>(null);

/**
 * Migration for HM-GAME-0.1 (schemaVersion 1) saves: they have no
 * `careerState` at all. Rather than crash or silently drop the save, a
 * fresh CareerState is created for it here (seeded from the save's own
 * id, so it is still deterministic) and persisted immediately, folding
 * the old save forward to the current schema on next load. HM-GAME-0.2A
 * (v2) saves are additionally passed through migrateCareerState to
 * backfill HM-GAME-0.3's Career Rhythm fields (Spec S25).
 */
/**
 * Fetches the real-world squad snapshot (HM-DATA-0.2) for a new career's
 * competition from the one server route allowed to touch
 * data/real-world/*. Only needed for a club whose data comes from that
 * database -- Allsvenskan/IFK Tumba careers skip the request entirely
 * and keep using their existing mock squad, unchanged from before this
 * milestone. Never throws: a fetch failure just means an empty
 * snapshot, which the career gracefully treats as "no real-world data
 * for this club" (see career/careerWorld.ts's fallback).
 */
async function fetchWorldSquads(competitionId: string): Promise<Record<string, PlayerMock[]>> {
  try {
    const res = await fetch(`/api/game-world/squad-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.worldSquads ?? {};
  } catch {
    return {};
  }
}

async function getOrCreateCareerState(save: CareerSave): Promise<CareerState> {
  if (save.careerState) {
    const migrated = migrateCareerState(save.careerState);
    if (migrated !== save.careerState) {
      saveCareerState(save.saveId, migrated);
    }
    return migrated;
  }
  const club = getClub(save.clubId);
  const worldSquads = club?.dataSource === "REAL_WORLD" ? await fetchWorldSquads(club.competitionId) : {};
  const fresh = createNewCareerState(save.saveId, save.clubId, worldSquads);
  saveCareerState(save.saveId, fresh);
  return fresh;
}

export function CareerProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{ save: CareerSave; career: CareerState } | null>(null);

  useEffect(() => {
    const save = getActiveSave();
    if (!save) {
      return;
    }
    let cancelled = false;
    getOrCreateCareerState(save).then((career) => {
      if (cancelled) return;
      setValue({ save, career });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!value) {
    return null;
  }

  function continueCareer() {
    const { state: nextCareer, events, stopReason } = continueCareerRhythm(value!.career);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { events, stopReason };
  }

  function playManagerFixtureAction() {
    const { state: nextCareer, result } = playManagerFixture(value!.career);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { result };
  }

  function markInboxMessageRead(messageId: string) {
    const nextCareer = markMessageRead(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function archiveInboxMessage(messageId: string) {
    const nextCareer = archiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function unarchiveInboxMessage(messageId: string) {
    const nextCareer = unarchiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function updateTacticalProfileAction(changes: Partial<TeamTacticalProfile>) {
    const nextCareer = updateTacticalProfile(value!.career, changes);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  return (
    <CareerContext.Provider
      value={{
        save: value.save,
        career: value.career,
        continueCareer,
        playManagerFixture: playManagerFixtureAction,
        markInboxMessageRead,
        archiveInboxMessage,
        unarchiveInboxMessage,
        updateTacticalProfile: updateTacticalProfileAction,
      }}
    >
      {children}
    </CareerContext.Provider>
  );
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) {
    throw new Error("useCareer() must be used within a CareerProvider");
  }
  return ctx;
}
