"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { getActiveSave, saveCareerState, type CareerSave } from "../save/saveRepository";
import { createNewCareerState } from "./newCareer";
import { continueCareerRhythm, type ContinueStopReason } from "./continueController";
import { markMessageRead } from "./inboxActions";
import { playManagerFixture } from "./matchdayAction";
import { migrateCareerState } from "./saveMigration";
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
function getOrCreateCareerState(save: CareerSave): CareerState {
  if (save.careerState) {
    const migrated = migrateCareerState(save.careerState);
    if (migrated !== save.careerState) {
      saveCareerState(save.saveId, migrated);
    }
    return migrated;
  }
  const fresh = createNewCareerState(save.saveId, save.clubId);
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
    const career = getOrCreateCareerState(save);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only load, see apps/game's other saveRepository reads for the same rationale.
    setValue({ save, career });
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

  return (
    <CareerContext.Provider
      value={{
        save: value.save,
        career: value.career,
        continueCareer,
        playManagerFixture: playManagerFixtureAction,
        markInboxMessageRead,
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
