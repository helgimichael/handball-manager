import type { MeterPoint } from "../geometry/coordinates";

export type BallStatus = "POSSESSED" | "IN_FLIGHT" | "LOOSE";

export type BallFlight = {
  passerId: string;
  receiverId: string;
  from: MeterPoint;
  to: MeterPoint;
  elapsedSeconds: number;
  durationSeconds: number;
  speedMetersPerSecond: number;
};

export type Ball = {
  position: MeterPoint;
  possessorId: string | null;
  status: BallStatus;
  flight: BallFlight | null;
};
