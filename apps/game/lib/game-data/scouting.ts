import type { ScoutedPlayer } from "./types";

// Fictional scouted players, not tied to any specific club roster.
export const SCOUTED_PLAYERS: readonly ScoutedPlayer[] = [
  { id: "sc-01", name: "Kasper Lindegaard", clubName: "Grindsted GIF", nationality: "DEN", age: 22, position: "H6", estimatedAbilityStars: 3, potentialStars: 4, knowledgePct: 68, contractEndSeason: "2027/28", estimatedValueSek: 1_400_000, notes: "Kraftfullt skott från nia-linjen, viss osäkerhet i försvarsspelet." },
  { id: "sc-02", name: "Erlend Haugen", clubName: "Fjellhammer IL", nationality: "NOR", age: 19, position: "M6", estimatedAbilityStars: 2, potentialStars: 5, knowledgePct: 41, contractEndSeason: "2026/27", estimatedValueSek: 900_000, notes: "Ovanligt mogen spelläsning för åldern. Bevakas aktivt." },
  { id: "sc-03", name: "Máté Kovács", clubName: "Ceglédi KKSE", nationality: "HUN", age: 24, position: "PV", estimatedAbilityStars: 3, potentialStars: 3, knowledgePct: 77, contractEndSeason: "2026/27", estimatedValueSek: 1_100_000, notes: "Fysiskt stark pivot, bra i genombrott." },
  { id: "sc-04", name: "Anže Kralj", clubName: "RD Škofja Loka", nationality: "SVN", age: 20, position: "V9", estimatedAbilityStars: 2, potentialStars: 4, knowledgePct: 34, contractEndSeason: "2027/28", estimatedValueSek: 650_000, notes: "Explosiv men fortfarande rå tekniskt." },
  { id: "sc-05", name: "Bjarki Ólafsson", clubName: "Þróttur Reykjavík", nationality: "ISL", age: 21, position: "H9", estimatedAbilityStars: 3, potentialStars: 4, knowledgePct: 58, contractEndSeason: "2026/27", estimatedValueSek: 800_000, notes: "Snabb och effektiv i kontring." },
  { id: "sc-06", name: "Adrián Vidal", clubName: "BM Huesca", nationality: "ESP", age: 23, position: "V6", estimatedAbilityStars: 3, potentialStars: 3, knowledgePct: 71, contractEndSeason: "2027/28", estimatedValueSek: 1_250_000, notes: "Jämn prestationsnivå, stabilt försvarsspel." },
  { id: "sc-07", name: "Noah Kristiansen", clubName: "Sandnes HK", nationality: "NOR", age: 18, position: "MV", estimatedAbilityStars: 2, potentialStars: 4, knowledgePct: 29, contractEndSeason: "2028/29", estimatedValueSek: 400_000, notes: "Lovande reflexer, behöver mer matchrutin." },
];

export function getScoutedPlayers(): readonly ScoutedPlayer[] {
  return SCOUTED_PLAYERS;
}
