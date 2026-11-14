# Arena Nights — Responsive QA

**Status: PASS.** One pre-existing defect was found and fixed (`0debe0a`).

## Setup

| | |
|---|---|
| App | Local dev server `hm-club-identity-arena` on port 3763 (worktree `club-identity-arena`) |
| Career | QA career "Arena Testare", IFK Tumba (Allsvenskan), created through New Game. It lives in the local browser profile only and is not connected to any tester or production save. |
| Widths | Phone 375×812 (emulates a mobile device), tablet 768×1024, desktop 1440×900. Spot checks at 1280×800. |
| Routes | 26 career routes per width: `/career` plus the inbox, calendar, schedule, squad, tactics, training, medical, contracts, klubbhuset, club, board, finance, staff, recruitment, players, scouting, transfers, season, competitions, statistics, analysis, manager, history, media and settings pages. |

Also visited on desktop:

- match preview;
- live match (`/career/match-day/2026-cup-R32-15-l1`);
- match report, after a full match played through the UI;
- New Game, all six steps.

## Checks per route

The checker script was stored in `localStorage.__m` during the session. For each route it checked:

1. Page-level horizontal overflow (`scrollWidth` greater than the viewport).
2. Elements in `main` that extend past the viewport. The script walks up each element's ancestors and ignores elements inside intended scroll containers (`overflow-x: auto/scroll`). Elements clipped by an `overflow: hidden` ancestor are reported.
3. The Next.js error overlay.
4. Presence of the shell.

## Results

| Width | Routes | Page overflow | Clipped content | Error overlay |
|---|---|---|---|---|
| Phone 375 | 26 | 0 | 1 (tactics court-mode tabs). **Fixed.** | 0 |
| Tablet 768 | 26 | 0 | 0 real (1 false positive: depth-chart dots inside their own scroll container) | 0 |
| Desktop 1440 | 26 | 0 | 0 | 0 |

**Console:** no errors during the sweep or the match.

### The fixed defect

The `/career/tactics` court-mode bar (ANFALL 6v6 / FÖRSVAR 6v6) clipped the FÖRSVAR tab outside `.coach-lineup` (`overflow: hidden`) at 375 px.

- **Cause:** a pre-existing `1fr 1fr` grid with long content.
- **Fix:** at 760 px and below, the two tabs now share the width (`minmax(0, 1fr)` columns, wrapping labels).
- **Verified:** the tab now sits at 186–340 px inside the 375 px viewport.

### Intended horizontal scrolling (not defects)

Each of these scrolls inside its own container:

- hub tab row;
- season strip;
- Spine day strip on phones;
- squad-matrix view switcher and position segments;
- calendar week grid on phones;
- transfer tabs (`.tc-tabs`);
- media tabs (`.bd-tabs`);
- squad depth chart.

## Component behaviour per width

| Component | Phone | Tablet | Desktop |
|---|---|---|---|
| Navigation | Bottom tabs Idag · Laget · Tävling · Marknad · Mer. Mer opens the full hub map (26 page links) and the save controls. | Collapsed 64 px rail; hover/focus expands it as an overlay | 220 px pinned rail from 1360 px (collapsed at 1280); pin toggle remembered |
| Continue | Docked full-width bar above the tabs | Header | Header |
| Week Spine | Swipeable five-day strip. Up-next appears on Idag only; day detail moves to the calendar. | Seven days; up-next and pin labels hidden below 1200 px | Seven days + up-next |
| Command palette | Full-screen sheet | Modal, 640 px | Modal, 640 px |
| Front page | Masthead stacks; ears without reasons; lead → decisions → match → ladder | Lead and decisions stack | Lead 8/12 + decisions 4/12 |
| Squad Matrix | Ranked cards with the view's top 3 metrics; tray above the dock | Table | Table (8 columns, no horizontal scroll at 1280) |
| Peek | Bottom sheet | Right drawer | Right drawer (420 px) |

### Measured examples

| Check | Result |
|---|---|
| Squad at 1280 px | table width = container width (1146 / 1146): no horizontal scroll |
| Squad at 375 px | 19 cards, page `scrollWidth` 375 |
| Palette at 375 px | 338 px modal before the full-screen rule; full-screen sheet after |
| Collapsed rail at 1280 px | 64 px wide |
| Key "2" | goes to `/career/squad` |

## Accessibility notes

- **Focus:** every new control has a visible neon focus ring (`:focus-visible`).
- **Palette:** a modal dialog. It moves focus to its input and returns focus to the trigger when it closes. Results use `combobox` / `listbox` / `option` roles with `aria-activedescendant`.
- **Peek:** a modal dialog. Escape and the scrim close it, and focus returns to the opener.
- **Collapsed rail:** links keep explicit `aria-label`s even when their labels are hidden.
- **Squad Matrix:** sort buttons sit in `<th aria-sort>`. Row selection uses checkboxes labelled "Välj <name>".
- **Reduced motion:** the palette and Peek entrances and the rail transition are disabled under `prefers-reduced-motion`.

**Not covered:**

- a screen-reader pass;
- real-device testing (all phone checks used device emulation in the browser pane).
