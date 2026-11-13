# HM Experience 2027 — Design Lab

An isolated, static, dependency-free design lab for choosing the future presentation of Handball Manager.
**It is not part of the production app.** It is not a workspace package (root workspaces are `apps/*` and `packages/*`), imports nothing from
`apps/game` except the existing environment photographs, which it references by relative URL, and changes no game code.

## Run

Serve the **repository root** (so the lab can reach the existing photos under `apps/game/components/clubhq/assets`):

```bash
python -m http.server 3790 --bind 127.0.0.1 --directory C:/DEV/WORKTREES/handball-manager/experience-2027
```

Then open http://127.0.0.1:3790/design-lab/experience-2027/index.html. A `hm-experience-2027-lab` entry was also added to
`C:/DEV/PROJECTS/handball-manager/.claude/launch.json` for the Claude desktop preview. Fonts load from Google Fonts; with no network the
prototypes fall back to system fonts.

## Amendment 2026-11-13 — Arena Nights + Club Identity System

Owner decision: identity **B — Arena Nights** with a **dynamic club neon accent**; **all surface recommendations retained** (see `docs/experience-2027/HM-EXPERIENCE-2027-ARENA-NIGHTS-AMENDMENT.md`).

- Top bar: **Club** (IFK Tumba · Hammarby · Utan klubb) and **Nav** (recommended Week Spine + rail / identity's original shell).
- New view **Club identity**; new journey **★ Owner direction**; Compare mode **Original vs Arena-adapted**; Surfaces presentation switch **Arena / Arena tokens only / Original identity**; filter **Arena-adapted**.
- New `frame.html` params: `club` (`tum`|`ham`|`none`|any club id), `nav` (`a`|`b`|`c` shell structure, independent of `theme`), `adapt=1` (Arena adaptation of the recommended alternative where one exists).
- New files:
  - `proto/screens-arena.js`: adapted variants and the clubless screen.
  - `proto/arena.css`: the Arena adaptation layer, plus the Week Spine shell in Arena.
  - `docs/experience-2027/proposals/arena-adaptations.json`: conflict and adaptation records.
- Re-verify (repo root, server running):

```bash
node design-lab/experience-2027/verify-amendment.cjs
```

- Boards:

```bash
node design-lab/experience-2027/capture-arena-boards.cjs
```

- Assets are loaded with a `?v=` query for cache-busting. Bump it in `index.html` and `frame.html` after editing lab files.

## Views

| View | What it does |
|---|---|
| Start | Coverage numbers, how to review, global decisions, list of hi-fi prototypes |
| Surfaces | Browser for all 231 surfaces: search and filter (pages, hi-fi, P0, undecided). Shows A/B/C alternatives with full rationale. Records your decision and notes (what works, what doesn't, required changes, ideas). Keys `1` `2` `3` switch alternatives |
| Compare | A/B/C side by side, or one alternative across the three identities; "Choose" buttons |
| Identities | The three design identities with tokens, plus the same screen rendered natively in each |
| Journeys & flows | The 9-step journey as Concept A, B and C, plus *My selection*, which uses your choices and runs a consistency check. Also the 5 cross-surface flows. Keys `←` `→` |
| Design system | Component gallery in the active identity |
| Decisions | Global decisions G1–G8 and every surface, with recommendations and a consistency check. Exports Markdown or JSON and imports JSON |

Top bar: identity (A/B/C) · device (Desktop 1440, Tablet 1024, Mobile 390, rendered in real iframes, so media queries apply) · density (Comfort/Compact).

**Storage:** decisions and notes are kept in this browser's `localStorage` for convenience only. Use *Export* to keep a durable record, or
paste the Markdown export into `docs/experience-2027/HM-EXPERIENCE-2027-OWNER-DECISIONS.md`.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `lab.css`, `lab.js` | Lab application |
| `frame.html` | Renders one prototype. Hash params: `s` (protoKey, or `__wire` with `surface=<ID>`), `alt` (A/B/C), `theme` (a/b/c), `density`, `shell=0` |
| `proto/themes.css` | **Token contract** + three identities + Floodlight mode + density |
| `proto/kit.css`, `proto/kit.js` | Component kit: shells (navigation models), icons, procedural crests and busts, charts, court, Peek drawer, Ctrl-K palette, toasts |
| `proto/sample.js` | Realistic sample data (fictional players and staff; real Swedish club names as in the game) |
| `proto/screens-*.js`, `proto/screens*.css` | 15 hi-fi surfaces × 3 alternatives, plus the journey "returning" screen and the system gallery |
| `proto/wireframe.js` | Concept-board renderer for all other surfaces (from proposal `wire` specs) |
| `data/surfaces.js` | **Generated.** Inventory merged with proposals |
| `build-data.mjs` | Regenerates `data/surfaces.js` and the INVENTORY, PROPOSALS and OWNER-DECISIONS markdown from the JSON sources |
| `capture-boards.cjs` | Regenerates `docs/experience-2027/boards/*.jpg`, using the main checkout's existing Playwright install |

```bash
node design-lab/experience-2027/build-data.mjs
```

```bash
node design-lab/experience-2027/capture-boards.cjs
```

Run both from the repo root; the capture script needs the server running.

## Interaction honesty

Every control in the prototypes does something visible:
- Tabs and segmented controls switch state.
- Peek opens, and the palette searches and opens results.
- Checklists toggle.
- Range sliders update their value.

Actions that would change game state (for example "Godkänn plan" or "Skicka bud") show a toast describing what would happen, because the prototypes have no game backend.
