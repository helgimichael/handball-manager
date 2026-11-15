# Arena Nights Phase 3 — Research Summary

## Scope and method

Phase 3 builds on the existing genre study, `docs/experience-2027/HM-EXPERIENCE-2027-COMPETITOR-RESEARCH.md` (722 lines; evidence-tagged). It covers:

- Football Manager 24 → FM26 → FM27;
- F1 Manager 2024;
- OOTP 25/26;
- Motorsport Manager;
- NBA 2K MyNBA/MyGM;
- Two Point Hospital and Two Point Campus;
- Basketball GM / ZenGM;
- shorter entries, including EA Sports FC career mode.

It also records 34 cross-game patterns and the observed anti-patterns. Repeating that research would cost the phase without adding evidence, so this summary distils it for the seven Phase 3 areas and records what was decided.

## What makes these games engaging, mapped to Phase 3

| Area | Pattern from the study | Applied in Phase 3 |
|---|---|---|
| Club world | FM's club vision and board page, Two Point's visible facility progression: the club is an organisation with a trajectory and moods, not a settings page | **Club Journal** (CLB-02 C): club identity, a season-by-season position strip, department briefs ranked by what needs attention, board confidence with its objectives, a three-figure economy summary |
| Player management | Inform vs navigate (lesson 2); a positional view where gaps are physical (FM squad depth, OOTP depth chart) | **Depth court** (SQD-01f B): the seven handball positions on a half court, coloured by available cover; it *is* the squad filter, and the same court language as the tactics board (lesson 20: handball-native) |
| Scouting & recruitment | Fog of war tied to scouting: show ranges and confidence, never the truth (lesson 11); one funnel from discovery to signature (FM recruitment focus, Motorsport Manager driver market) | **Pipeline board** (REC-02 C): one funnel, star ranges drawn as uncertainty bands, a knowledge bar, need tags from the squad's depth, a budget meter |
| Transfers & contracts | Predictive previews before commitments; "what would make this work?" (lesson 10) | **Range-band slider** (REC-04b A): the bid against the scouts' value range, the club's counter and the budget on one axis |
| Competition | Make positions mean something (zones, movement) — broadcast league tables in FM/F1 Manager | **Annotated standings** (CMP-01a A): verified zone rules, ▲▼ since last round, points gaps, legend |
| News & inbox | Inbox as a task queue with inline resolution (lesson 4) | **"Att göra" tray** (WLD-01 C, partial): every unresolved decision, oldest first, opened in the reader |
| Staff | Staff as faces of systems (lesson 9) | Deferred (see completion report): the M6 delegation and approval architecture must not be duplicated, and the org matrix (STF-01 A) needs its own pass |

**Anti-patterns avoided** (from the study's §6):
- FM26's summary tiles used as navigation: briefs inform and offer one explicit link.
- Card walls without hierarchy: briefs are ranked by need, and pipeline rows are dense.
- Fake precision on hidden ratings: ranges only, and a test asserts the board never reads CA/PA.

## Tools investigated

| Tool | Finding | Decision |
|---|---|---|
| Arena Nights design system (tokens, `--club-neon`, phase colours) | Sufficient for every Phase 3 surface; the club neon carries identity on the history strip, briefs, lanes and slider | Used throughout |
| Design Lab (Experience 2027) | Already holds 2–3 genuinely different alternatives per surface (551 in total), each with layout, interactions, desktop/mobile notes, pros/cons and complexity | Used as the design-direction source; alternatives preserved untouched |
| SVG / CSS data visualisation | History strip, half-court depth, uncertainty bands, revenue mix and range band are each a few kB of inline SVG/CSS with no dependency | Chosen for every new visual |
| Blender (MCP connector) | Would suit a clubhouse illustration at facility tiers (CLB-02 C header art, CLB-01 B) | Not used this phase: no Blender scene for the club exists, and a pre-rendered bitmap per tier and club adds weight for little decision value; recorded as a future asset task |
| Higgsfield (MCP connector) | Paid generative image/video service | Not used: purchasing or spending credits needs owner approval, and generated imagery of real clubs risks identity problems |
| Existing photographic backdrops (`ENVIRONMENTS`) | Already used by hero and negotiation surfaces | Reused (club hero, negotiation room) |

No dependency was added and no external service was called.
