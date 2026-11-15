# Arena Nights Phase 3 — Design Directions

For each redesigned surface, the canonical Design Lab (`design-lab/experience-2027/data/surfaces.js`) already holds 2–3 meaningfully different alternatives: different layout and interaction, not colour variants. They are summarised here with Phase 3's evaluation. **All alternatives are preserved unchanged** in the lab data, and the traceability table still lists every one of the 231 surfaces and 551 alternatives.

Scoring: Usability (U), Immersion (I), Consistency with Arena Nights and the six hubs (C), Feasibility on existing data without new rules (F). Scale 1–5.

## Club World — CLB-02 "Klubb"

| | Alternative | Concept | U | I | C | F | Notes |
|---|---|---|---|---|---|---|---|
| A | Executive Office | 3×3 department tiles with sparklines | 4 | 2 | 4 | 4 | Fast but story-less; tiles drift into navigation |
| B | Clubhouse Rooms | The illustrated building *is* the page; rooms open panels | 2 | 5 | 2 | 1 | Asset-hungry; hides depth; duplicates navigation |
| **C** | **Club Journal** | Identity → trajectory over seasons → what needs attention now | 4 | 4 | 5 | 4 | **Chosen.** Built without the tiered clubhouse header art (needs an asset pipeline) |

Economy rail (CLB-02b): A KPI Trio + Revenue Mix (**chosen**; existing figures only) over B Headroom Gauge (requires a new "spendable" calculation — a rule change, so not taken).

## Squad — SQD-01f "Truppens balans"

| | Alternative | Concept | Decision |
|---|---|---|---|
| A | Clickable position counters | Seven segmented counters as the filter | Cheap, but not spatial |
| **B** | **Mini court depth** | Half court, seven spots coloured by cover, +n secondary cover, tap = filter | **Chosen**: instant gap detection; same court language as the tactics board; reused on the Club Journal |

## Scouting & Recruitment — REC-02 "Rekryteringscentrum"

| | Alternative | Concept | U | I | C | F |
|---|---|---|---|---|---|---|
| A | Pipeline table with stage tabs | Fix the table; stage tabs in the URL | 4 | 2 | 4 | 5 |
| B | Recruitment war room | Hero targets plus lanes of player busts | 3 | 5 | 3 | 2 |
| **C** | **Unified pipeline board** | Six dense lanes from discovery to signature, lane insights, budget meter | 4 | 4 | 5 | 4 |

**Chosen: C.** It is the only direction that shows the whole journey (needs → scouting → report → shortlist → negotiation → signed) at once, without A's tab-hopping or B's asset cost. The A table is kept as "Lista & filter". Lanes move only through real actions in the dossier (start an assignment, shortlist, open a negotiation), never by drag-to-fake a state.

## Transfers — REC-04b club-stage decision form

| | Alternative | Decision |
|---|---|---|
| **A** | **Range-band slider** | **Chosen**: the bid in context of the knowledge-gated range, the counter and the budget |
| B | Offer presets | Hides the reasoning |
| C | Counter-proposal helper | Overlaps the existing "Betala klubbens pris" action |

## Competition — CMP-01a "Tabell & form"

| | Alternative | Decision |
|---|---|---|
| **A** | **Annotated standings** | **Chosen**: zone meaning, movement and gaps in the table itself, from verified rules |
| B | Points ladder | Strong for gaps; candidate for a later toggle |
| C | Race chart | Needs per-round standings history; future work |

## Inbox — WLD-01

| | Alternative | Decision |
|---|---|---|
| A | Task Inbox | — |
| B | Messenger Feed | — |
| **C** | **Correspondence Desk** | Canonical pick; **partially built**: the pinned "Att göra" tray. Threads per entity and inline resolution remain |

## New concepts introduced in Phase 3 (beyond the lab)

- **Uncertainty band for star ranges**: solid to the lowest estimate, hatched to the highest. A visual grammar for fog of war, reused in the range-band slider for money.
- **Need tags** ("Fyller lucka", "Ger bredd"): the recruitment board reads the squad's depth model, joining steps 1 and 2 of the recruitment journey.
