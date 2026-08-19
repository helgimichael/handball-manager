"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { getActiveSave, saveCareerState, type CareerSave } from "../save/saveRepository";
import { createNewCareerState } from "./newCareer";
import { advanceToNextEvent } from "./calendar";
import type { CareerState } from "./types";

type CareerContextValue = {
  save: CareerSave;
  career: CareerState;
  /** CONTINUE: advances to the next relevant calendar event and persists. Returns what was simulated, for the caller to react to (e.g. navigate to a match report). */
  continueCareer: () => { simulatedResults: FastMatchResult[]; playerMatchdayReached: boolean };
};

const CareerContext = createContext<CareerContextValue | null>(null);

/**
 * Migration for HM-GAME-0.1 (schemaVersion 1) saves: they have no
 * `careerState` at all. Rather than crash or silently drop the save, a
 * fresh CareerState is created for it here (seeded from the save's own
 * id, so it is still deterministic) and persisted immediately, folding
 * the old save forward to the current schema on next load.
 */
function getOrCreateCareerState(save: CareerSave): CareerState {
  if (save.careerState) {
    return save.careerState;
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
    const { state: nextCareer, simulatedResults, playerMatchdayReached } = advanceToNextEvent(value!.career);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { simulatedResults, playerMatchdayReached };
  }

  return (
    <CareerContext.Provider value={{ save: value.save, career: value.career, continueCareer }}>
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
