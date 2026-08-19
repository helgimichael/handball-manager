export const SIMULATION_DT_SECONDS = 0.05;
export const MAX_ACCUMULATED_SECONDS = 0.25;

export type FixedStepPlan = {
  steps: number;
  accumulatorSeconds: number;
  consumedSeconds: number;
};

const STEP_EPSILON_SECONDS = 1e-9;

export function planFixedSteps(
  elapsedSeconds: number,
  accumulatorSeconds: number,
  fixedDtSeconds = SIMULATION_DT_SECONDS,
  maxAccumulatedSeconds = MAX_ACCUMULATED_SECONDS
): FixedStepPlan {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error("elapsedSeconds must be a finite non-negative number.");
  }
  if (!Number.isFinite(accumulatorSeconds) || accumulatorSeconds < 0) {
    throw new Error("accumulatorSeconds must be a finite non-negative number.");
  }
  if (!Number.isFinite(fixedDtSeconds) || fixedDtSeconds <= 0) {
    throw new Error("fixedDtSeconds must be a finite positive number.");
  }
  if (!Number.isFinite(maxAccumulatedSeconds) || maxAccumulatedSeconds < fixedDtSeconds) {
    throw new Error("maxAccumulatedSeconds must be at least one fixed timestep.");
  }

  const availableSeconds = Math.min(maxAccumulatedSeconds, accumulatorSeconds + elapsedSeconds);
  const steps = Math.floor((availableSeconds + STEP_EPSILON_SECONDS) / fixedDtSeconds);
  const consumedSeconds = steps * fixedDtSeconds;

  return Object.freeze({
    steps,
    accumulatorSeconds: Math.max(0, availableSeconds - consumedSeconds),
    consumedSeconds
  });
}
