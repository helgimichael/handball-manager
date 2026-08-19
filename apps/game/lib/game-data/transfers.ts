import type { TransferItem } from "./types";

// Fictional transfer centre items.
export const TRANSFER_ITEMS: readonly TransferItem[] = [
  { id: "t-01", direction: "in", playerName: "Kasper Lindegaard", clubName: "Grindsted GIF", feeSek: 1_200_000, status: "Förhandling", deadline: "2026-08-31" },
  { id: "t-02", direction: "in", playerName: "Erlend Haugen", clubName: "Fjellhammer IL", feeSek: null, status: "Öppen", deadline: "2026-09-30" },
  { id: "t-03", direction: "out", playerName: "William Carlén", clubName: "HK Aranäs", feeSek: 450_000, status: "Accepterat", deadline: "2026-08-25" },
  { id: "t-04", direction: "out", playerName: "Adam Holmgren", clubName: "IK Lågan", feeSek: null, status: "Avvisat", deadline: "2026-08-20" },
];

export function getTransferItems(): readonly TransferItem[] {
  return TRANSFER_ITEMS;
}
