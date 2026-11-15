# Arena Nights Phase 2 — Tactical Board (Phase C)

**Status: PARTIAL.**

- The board gained a coherent workspace header and a phase × manpower switcher. The court, overlays, set pieces, leadership and roster were already a professional workspace and are kept.
- Pairing lines on the court (TRN-02d), ordered 7 m takers with stats (TRN-02g) and the bench pull-up drawer (TRN-02i) are still open.

| | |
|---|---|
| Commit | `b09b6db` |
| Recommendations implemented | TRN-02 (A) Tactics Board readiness header, TRN-02b (A) phase × manpower switcher, TRN-02c (A) situations as matrix cells with completion |
| Screenshot | `phase2-screenshots/04-tactics-defence-desktop.png`, `09-tactics-phone.png` |

## What changed

### Readiness header

`lib/matchPlan/boardReadiness.ts` reads the saved plan. It is read-only and changes no plan semantics or tactical calculation. The header shows nine chips:

| Chip | Done when |
|---|---|
| Trupp n/16 | The match squad is selected |
| MV | A goalkeeper is in the squad |
| Startsju | All seven attack slots are filled with available players |
| Försvar | Six defence slots and a goalkeeper |
| 7 m | Takers are chosen |
| Kapten | A captain is chosen |
| 6v5 | A saved lineup exists (otherwise "standard") |
| 5v6 | A saved lineup exists (otherwise "standard") |
| 7v6 | A seventh court player is chosen (otherwise "standard") |

Each chip either switches to its existing court mode or jumps to its existing section (set pieces, match squad).

### Phase × manpower switcher

The 2×4 grid (Anfall/Försvar × 6v6, 6v5, 5v6, 7v6) replaces the separate dual tabs and the special-situation row.

- **Interactive cells:** only the five court modes the tactical domain supports — Anfall 6v6, 6v5, 7v6 and Försvar 6v6, 5v6. They drive the existing `setCourtMode`.
- **Static cells:** the three manpower states with no lineup in the match plan (attack 5v6, defence 6v5, defence against 7v6) are dashed, plain text that says "följer 6 mot 6". There are no inert buttons.
- **Kept information:** the badges from the old dual tabs ("6 båda vägar", "n vilar i försvar", defence system and specialists) appear in their cells.
- **Completion dots:** green for done, red for incomplete, grey for standard.
- **Group label:** the grid is labelled "Specialsituationer", so scouting's existing advice ("Matchplan → Specialsituationer") still points to the right place.

### Visual distinction between phases

- **Attack:** club neon on the bar, the active cell and the court outline.
- **Defence:** info blue.
- **Exchanges:** keep their existing banner.

### Responsive behaviour

On a phone the grid becomes two columns per phase with the phase name as a heading. The earlier fix to the clipped phase tabs is superseded, because those tabs are now the grid. The journey checks `/career/tactics` at 375 px for horizontal overflow.

## Preserved

All existing interactions are unchanged:

- drag and swap;
- overlay modes (Energi, Lämplighet, Senaste match, Form);
- the defence system buttons (6–0 / 5–1);
- the "Så spelar vi" rail;
- exchanges and diff;
- set pieces and leadership;
- the match squad;
- the assistant proposal ("Assistentens förslag").

No match engine, tactical calculation or saved-plan format was touched.

## Tests

- **E2E journey (steps 8–9):**
  - opens the board;
  - checks the grid;
  - switches to "Försvar 6 mot 6" (heading and `data-phase="DEFENCE"`) and back to attack.
- **TypeScript:** clean.
- **ESLint on the tactics page:** the same 10 pre-existing warnings as before; none new.

## Remaining (traceability)

| Recommendation | Status |
|---|---|
| TRN-02a (inline warning + auto-fix preview) | Deferred |
| TRN-02d (pairing lines on court) | Deferred |
| TRN-02e (overlay legend) | Deferred |
| TRN-02f (trade-off sentence under choices) | Deferred |
| TRN-02g (ordered 7 m takers with stats) | Deferred |
| TRN-02h (single roles editor) | Deferred |
| TRN-02i (bench strip + pull-up drawer) | Deferred |

These remain on their existing layouts.
