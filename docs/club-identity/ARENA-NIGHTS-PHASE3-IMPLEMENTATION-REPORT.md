# Arena Nights Phase 3 — Implementation Report

Branch `feat/club-identity-arena`. Baseline `ba61fd4` (stabilization). All work is local; nothing is pushed or deployed.

## Milestones (local commits)

| Commit | Milestone | Recommendations |
|---|---|---|
| `cbf2279` | Club Journal and squad depth court | CLB-02 C, CLB-02b A, SQD-01f B |
| `bec4f84` | Recruitment pipeline board | REC-02 C |
| `f280ca9` | Annotated standings | CMP-01a A |
| `fed9331` | Inbox "Att göra" tray; traceability | WLD-01 C (partial) |
| `e491402` | Negotiation range-band slider | REC-04b A |
| *(final)* | Phase 3 journey e2e, reports, screenshots | — |

## A. Club World — `/career/club` (Klubben hub → Klubb)

**Before:**
- the club hero;
- a four-number facts strip;
- the club context table;
- a seven-counter "Truppens positioner" row;
- a top-players list;
- a rail with a 20-row economy spreadsheet and a partnerships panel.

**After (Club Journal):**
- **Kicker:** founded, city and venue (real club data; omitted when unknown).
- **History strip:** league position per season from `seasonHistory`, with the live season highlighted. Before any league match the live season shows "–", never an invented position. A first-season career gets a compact strip that explains it grows.
- **"Läget i klubben":** six department briefs ranked bad → warn → neutral → good:
  - squad cover (gaps and thin positions from the depth model, unavailable players);
  - contracts expiring this season (from `playerContracts`);
  - board confidence and objectives at risk;
  - the economy's pressure label or wages over budget;
  - staff;
  - partnerships.

  Each brief has one explicit link (inform vs navigate).
- **Rail:**
  - board confidence meter, predicted position and objectives with their status colours;
  - KPI trio (kassa, lönerum, transferbudget);
  - revenue-mix bar.

  The full economy table remains under "Hela ekonomin".
- **Depth court** in the main column.

Source: `lib/club/clubJournal.ts` reads existing data only. It introduces no reputation or supporter calculation.

## B. Player management — squad depth court

`DepthCourt` shows the seven positions on a half court with available/total per spot, coloured by available cover (two or more = green, one = amber, none = red), plus a "+n" count of players who can cover from another position. Tapping a spot shows the names, with unavailable players struck through. On `/career/squad` it replaces the old balance panel and **is the position filter**: tapping sets the matrix filter, and tapping again clears it. The Player Dossier is untouched.

## C. Scouting and recruitment — pipeline board

`/career/recruitment` opens on the board; "Lista & filter" restores the previous table, and `?view=` deep links still open the list.

- **Lanes:** Upptäckt → Scoutas → Rapport → Kortlista (Kortlistad and Prioriterad, ranked by priority) → Förhandling → Klar.
- **Lane headers:** counts and an insight ("1 uppdrag pågår", "2 rapporter klara", "1 fyller en lucka").
- **Rows:**
  - name, position, age and club;
  - the ability star range drawn as uncertainty (solid to the minimum, hatched to the maximum);
  - a knowledge bar;
  - a need tag when the position is a gap or thin in the squad;
  - priority;
  - the negotiation's own status label.
- **Budget mini-meter:** transfer budget and wage room.
- **Rows open the existing dossier**, which keeps every action: scouting assignment, shortlist, priority, note, negotiation entry.
- **CA/PA:** never read. A unit test greps the model and component for `currentAbility` / `potentialAbility`.

## D. Transfers — negotiation range band

In the club stage of a permanent deal, the existing fee field gains a band. It shows the scouts' knowledge-gated value range (`resolveMarketValueRange`), the club's latest counter, the transfer budget and our bid. A slider drives the same fee field, and a bid over budget is flagged. The negotiation rules and economics are unchanged, and the submitted action is the same `FEE` action.

## F. Competition — annotated standings

Zones are read only from `lib/competition/rules.ts` (verified THB rules):

| League | Positions | Zone |
|---|---|---|
| Handbollsligan | 1–8 | SM-slutspel |
| Handbollsligan | 11–13 | kval |
| Handbollsligan | 14 | nedflyttning |
| Allsvenskan | 1 | uppflyttning |
| Allsvenskan | 2–4 | kval upp |
| Allsvenskan | 11–12 | kval för att stanna |
| Allsvenskan | 13–14 | nedflyttning |

Other leagues show no zones.

- Each zone gets a coloured stripe, with a label where it starts.
- ▲▼ show places moved since the previous round: the same table recomputed without the latest round's results.
- The points gap to the club above is shown, with a legend under the table.

## G. News — "Att göra" tray

Above the inbox feed: every unresolved action-required inbox message, oldest first, opened in the existing reader. When there are none, it says so. The inbox remains the source of truth, and nothing is generated.

## E. Staff — deferred

The staff surfaces (STF-01 org and responsibility matrix) are P1. They are deferred so that the M6 delegation and approval queues are not duplicated or re-wired without a dedicated staff regression pass. Staff appear in the Club Journal briefs.

## Integration

- **Six hubs and Week Spine:** unchanged. The new surfaces live on existing routes: Klubben → Klubb, Laget → Trupp, Rekrytering → Rekryteringscentrum and the negotiation room, Tävling → competition, Idag → Inkorg.
- **The workflow connects end to end:**
  1. Club Journal: what needs attention (for example "Tunt på H9").
  2. Depth court in the squad: who covers the position.
  3. Recruitment board: H9 candidates tagged "Ger bredd · högernia".
  4. Dossier → negotiation: the range band.
  5. Competition: what the position means.
  6. Inbox tray.
  7. Front page.

## Tests added

| Test | Covers |
|---|---|
| `lib/club/clubJournal.test.ts` (2) | depth per position from the real squad; tone rule; an injured position becomes a gap; history ends with the live season; briefs ranked; pure |
| `lib/recruitment/pipeline.test.ts` (2) | one lane per candidate; shortlist priority order; need tags from depth; lane insights; no CA/PA in source |
| `lib/competition/standingsZones.test.ts` (2) | every zone exactly per the verified rules; no zones for unverified leagues |
| `e2e/phase3-club-world.spec.ts` | the full Phase 3 journey on a fresh career, desktop and 375 px, no overflow, no page errors |

## Screenshots

`docs/club-identity/phase3-screenshots/`:

- `p3-01-club-journal-desktop.png`
- `p3-02-squad-depth-desktop.png`
- `p3-03-recruitment-pipeline-desktop.png`
- `p3-04-standings-desktop.png`
- `p3-05-{club,squad,recruitment,standings,inbox}-phone.png`

The before state for each surface is described above. No before screenshots were captured for these routes in earlier phases, and rebuilding the baseline only to photograph it was not worth the cost.
