# Brief for surface-proposal authors (Experience 2027)

You write 2–3 genuinely different design alternatives for each inventoried surface of Handball Manager
(a Swedish-language handball management web game). Output is **JSON** consumed by the Design Lab and by a
generator that builds `HM-EXPERIENCE-2027-SURFACE-PROPOSALS.md` and `HM-EXPERIENCE-2027-OWNER-DECISIONS.md`.

## Read first
- `docs/experience-2027/HM-EXPERIENCE-2027-DESIGN-DIRECTIONS.md` — the three identities (a = Tactical Clarity,
  b = Arena Nights, c = Paper & Floodlight) and the shared IA: **6 hubs: Idag (Today) · Laget (Team) · Klubben (Club) ·
  Rekrytering (Recruitment) · Tävling (Competition) · Karriär (Career)**, Continue as heartbeat, ⌘K palette,
  Peek drawer for entities, Week Spine timeline (C).
- `docs/experience-2027/HM-EXPERIENCE-2027-COMPETITOR-RESEARCH.md` §5 pattern library + §7 lessons — cite patterns by name.
- The inventory JSON for your surfaces (`docs/experience-2027/inventory/part-a.json` or `part-b.json`): use its
  `structure`, `weaknesses`, `opportunities`. You may open source files for detail. READ-ONLY on `apps/` and `packages/`.

## Rules
- **Pages** (`kind: page`) and anything with importance `core`: exactly **3** alternatives A/B/C.
- Tabs/panels/states/modals/overlays/nav: **2 or 3** alternatives (2 is fine if a third would be filler).
- `internal` surfaces (editors, labs, debug): 2 short alternatives; focus on "hide from players / dev-only styling".
- Alternatives must differ in **presentation concept and interaction model**, not colour/font/radius.
  Good: "ranked table" vs "card wall by position" vs "court depth chart". Bad: "dark version".
- Alternative A should usually be the most efficient/data-forward concept (fits identity a), B the most immersive
  (fits b), C the hybrid/editorial/contextual one (fits c) — but break this when a better idea exists; declare fit in `directions`.
- Be specific to handball and to this game's real data (positions MV/VS/VN/MN/HN/HS/M, 1–20 attributes, 7 m,
  2-minute suspensions, timeouts, 6-0 / 5-1 / 3-2-1 defence, Handbollsligan, Allsvenskan, Svenska Cupen, SM-slutspel, kval).
- Don't invent gameplay. Presentation of existing systems only. If an idea needs new data, mark it in `cons` as "needs new data: …".
- Recommendation is **advice**; the owner decides.

## Hi-fi prototype mapping (use these names for these IDs; the lab already renders them)
| protoKey | Surface IDs | A | B | C |
|---|---|---|---|---|
| entry | ENT-02 (+ENT-04 load game) | Career Library | Arena Title | Journal Cover |
| dashboard | DSH-01 | Decision Briefing | Matchweek Show | Today's Paper |
| club | CLB-02 (CLB-01 clubhouse: see note) | Executive Office | Clubhouse Rooms | Club Journal |
| inbox | WLD-01 | Task Inbox | Messenger Feed | Correspondence Desk |
| calendar | WLD-05 | Planner Grid | Season Road | Week Spine Calendar |
| manager | MGR-01 | Career Ledger | Legacy Wall | Manager Biography |
| player | SQD player profile page | Dossier | Athlete Spotlight | Feature Profile + Peek |
| squad | SQD squad page | Squad Matrix | Locker Room | Depth Chart |
| staff | STF staff page | Org & Responsibility Matrix | Staff Room | Department Journal |
| training | TRN training page | Weekly Planner Grid | Training Hall | Assistant Proposal |
| scouting | REC scouting page | Search Workbench | Scouting Board | Shortlist & Reports |
| transfers | REC transfers page | Market Table + Deal Panel | Deal Room | Transfer Desk Pipeline |
| competition | CMP competition page | League Centre | Broadcast League Hub | Competition Almanac |
| matchday | MDY live match / match day | Bench Tablet | Broadcast | Floodlight Sequence |
| analysis | ANL match report | Stats Sheet | Highlight Show | Editorial Match Report |
For those IDs set `"protoKey"` and keep those A/B/C names (write the full descriptions yourself). All other surfaces: `"protoKey": null`.
For CLB-01 (Klubbhuset) write its own three alternatives (e.g. interactive illustrated map / room photo grid / merged into Club Journal).

## JSON schema (one array, one object per inventory surface, same order as inventory)
```json
{
  "id": "DSH-01",
  "protoKey": "dashboard",
  "current": "1–2 sentences on the current implementation (from inventory/source).",
  "recommendation": "C",
  "reason": "Why this alternative (1–3 sentences).",
  "dependencies": ["G2 navigation model", "DSH-01i", "Week Spine component"],
  "priority": "P0",            // P0 redesign first, P1 next, P2 later, P3 low/internal
  "alternatives": [
    {
      "key": "A",
      "name": "Decision Briefing",
      "concept": "Visual concept in 1–3 sentences.",
      "layout": "Layout structure.",
      "hierarchy": "What is seen first, second, third.",
      "interactions": "Main interactions.",
      "navigation": "How it connects to other surfaces / behaves in nav.",
      "desktop": "Desktop treatment.",
      "mobile": "Mobile treatment (not just shrunk).",
      "pros": ["…"], "cons": ["…"],
      "complexity": "S|M|L|XL",
      "perf": "Low|Medium|High",            // runtime/asset cost
      "worksWith": ["SQD-02", "WLD-01"],     // other surface IDs (either inventory part)
      "directions": ["a"],                   // identities it suits: a/b/c
      "patterns": ["Inbox as task queue"],   // competitor pattern names used (optional)
      "wire": {
        "d": [["Hero: next match|12|hero"], ["Decision queue|8|list", "League table|4|table"]],
        "m": ["Hero: next match|hero", "Decision queue|list", "Table|table"]
      }
    }
  ]
}
```
`wire.d` = desktop rows; each block `"Label|span(1–12)|kind"`; kind ∈ hero, list, table, chart, panel, media, nav, cta, court, form, timeline, cards.
`wire.m` = mobile stack (order matters, may omit/merge blocks, may add mobile-only blocks like "Bottom sheet: …|panel").
Wireframes are rendered automatically as lo-fi concept boards — make them reflect the real layout idea.

Validate: `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` and check every inventory id is present once.
Language: English text; Swedish only for in-game labels.
