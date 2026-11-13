# HM Experience 2027 — Design Decision Amendment: Arena Nights + Club Identity System

> **Owner decision, 2026-11-13.** Recorded as G1 = B and new decision G9 = dynamic club accent in `HM-EXPERIENCE-2027-OWNER-DECISIONS.md`.
> Scope remains an isolated design exercise: no production, gameplay or Alpha changes; no push, merge or deploy.
> All earlier research, documents, proposals and owner notes are kept. This amendment adds to them; it does not replace them.

## 1. The decision

1. **Overall visual identity: B — Arena Nights**, with a **dynamic Club Identity System**. The orange accent of the original Arena Nights concept becomes a neon accent derived from the active club:
   - IFK Tumba → neon blue
   - Hammarby → neon green
   - clubless manager → neon orange (default)
2. **Every per-surface recommendation is retained.** That covers the recommended alternative, concept and rationale, layout, hierarchy, interactions, navigation relationships, desktop and mobile treatment, complexity and performance, dependencies, works-with links, priority and implementation advice. Arena Nights is the **visual language, not a layout template**.
3. **Genuine conflicts are not silently resolved.** The original is kept, the conflict is explained, and an Arena-compatible adaptation is proposed and shown in the Design Lab next to the original.

Claude's earlier identity recommendation (C) is kept in DESIGN-DIRECTIONS and RESULTS as history, and it is clearly marked as superseded by the owner decision.

## 2. How the two decisions work together

| Layer | Source of truth after the amendment |
|---|---|
| Tokens, type, colour, depth, motion temperament | **Arena Nights** (B) + Club Identity System |
| Accent colour | Active club's neon (`--club-neon`) |
| Surface structure, hierarchy, interactions, priorities | **Each surface's retained recommendation** (A, B or C) |
| Navigation model | Retained recommendations ENT-07/ENT-08: **6-hub rail + Week Spine + Peek + Ctrl-K**, restyled in Arena. Arena's original top hub bar is still in the lab (*Nav: identity*) for comparison. |
| Presentation of conflicting recommendations | Arena adaptation (21 surfaces); the original stays available |

How the 231 recommendations sit in Arena Nights:

| Status | Count | Meaning |
|---|---|---|
| native | 49 | The recommended alternative was designed for or with Arena Nights |
| token | 144 | No conflict: same structure, restyled only by Arena tokens and the club accent. This includes the A-style "workbench" recommendations (squad matrix, tactics board, market table, term sheet, league centre); dense tables get solid dark surfaces without blur for long-session legibility |
| adapt | 21 | Genuine conflict with presentation specific to Paper & Floodlight; adapted, original kept |
| internal | 17 | Developer and internal tools |

The full per-surface list, with conflict, adaptation and what is preserved, is in **`HM-EXPERIENCE-2027-ARENA-ADAPTATION-REGISTER.md`** (generated from `proposals/arena-adaptations.json`).

### The 21 adaptations

The conflicts fall into three kinds:
- **Structural:** paper, journal or desk metaphors such as Today's Paper, the Journal Cover, the Club Journal and the Correspondence Desk.
- **Metaphor:** books, almanac pages and paper handovers.
- **Typographic:** serif editorial typesetting.

Two matchday recommendations (MDY-01, MDY-02) depend on the **paper→Floodlight mode switch**. In an all-dark identity that switch loses its contrast, so it is replaced by an **intensity escalation**: calm, desaturated preparation → club neon floods the stage → glowing live cards.

| Hi-fi (interactive in the lab, original vs adapted) | Concept-board adaptations |
|---|---|
| ENT-02/04 Journal Cover → **Season Cover** | ENT-03 living club card (wizard switches to the chosen club's neon) |
| DSH-01 Today's Paper → **Matchweek Front Page** | ENT-12 First-day handover (Arena) |
| CLB-02 Club Journal → **Club Channel** | DSH-01a Broadcast Masthead · DSH-01b Match Box |
| MGR-01 Biography → **Career Chapters** | CLB-01c Club Archive · CLB-04 Peek-first Scout Card |
| WLD-01 Correspondence Desk → **Message Desk** | MGR-02 Season Shelf (cards) |
| SQD-02 Feature Profile → **Athlete Feature** | WLD-01b Thread Reader · WLD-02a Image Lead · WLD-03 Live Transcript |
| REC-01 Shortlist & Reports → **Scout Desk** | MDY-01 Three-step ritual (intensity escalation) |
| MDY-02 Floodlight Sequence → **Matchday Sequence** | |
| ANL-01 Editorial Report → **Match Feature** | |

Every adaptation keeps the original's information hierarchy, interactions, navigation links and mobile order; the register lists what is preserved for each.

## 3. Club Identity System (prototype design system)

> **Update (club kit audit, 2026-11-13):** the derivation below is superseded by the **Club Identity Registry**. Every club's neon now comes from its researched home-shirt colour through `club-identity/neon.js` (OKLCH); the hard-coded Tumba/Hammarby overrides were removed. Tumba is now `#4694ff` (blue shirt) and Hammarby `#41e77c` (green shirt, verified). See `HM-EXPERIENCE-2027-CLUB-IDENTITY-REGISTRY.md`. The token contract in this section is unchanged.

**Principle:** the club changes only CSS custom properties. Components, layouts and the token contract are identical for every club.

| Token | Definition (Arena Nights, `proto/themes.css`) |
|---|---|
| `--club-neon` | Set per active club by `K.applyClub()`; default `#ff7a1a` |
| `--accent` | `var(--club-neon)`: primary actions, active nav, focus, selection, own-club rows, data series 1 |
| `--accent-ink` | `#061018`: dark ink on neon fills |
| `--accent-soft` | neon 16% (selected backgrounds, today cell) |
| `--accent-line` | neon 55% (hairlines on highlighted cards) |
| `--glow` | `0 0 22px` neon 42% (primary button, Continue, highlighted cards only) |
| `--club-2` | neon mixed 62% with white (kickers on dark hero images) |
| `--club` / `--club-primary` | the club's real primary colour: match-day cells, score bug, crest context |
| `--attr-2…5`, `--data-1` | the attribute ramp and first data series derive from the neon |
| unchanged | night background, surfaces, ink, muted, positive/negative/warning, **gold for achievements**, court colours |

**Derivation:**
- Owner-specified overrides: Tumba `#2e9bff`, Hammarby `#1ff28a`, clubless `#ff7a1a`.
- Every other club takes the hue of its primary colour when that colour is saturated, otherwise the hue of its secondary colour, otherwise the default orange.
- Saturation is set to 100% and lightness to 60% (52% for yellows), so every club is equally loud and readable. For example, Sävehof (black/yellow) gets neon yellow and Kristianstad neon blue.

**"Prominent but controlled":**
- Neon is used for action, focus, selection, today and your own club.
- Glow is limited to the primary action, Continue and the highlighted card.
- Everything else stays on the consistent dark Arena foundation.

**Contrast (measured):**
- Dark ink on neon is 5.09:1 to 14.47:1 across all 15 sample identities.
- Neon text on the night background is 4.62:1 to 14.87:1.
- So all pass WCAG AA for normal text. This also fixes the earlier failure of white labels on the Arena orange (3.31:1).

**Club changes:**
- `applyClub('ham')` switches the career club; `applyClub('none')` gives a clubless manager. The shell then shows "Fri agent", with its own Week Spine of interviews and deadlines, plus a dedicated clubless job-market screen (MGR-01c).
- In production this maps to `career.clubId` → identity tokens at the root. No component needs club-specific code.

## 4. What changed in the Design Lab

- **Defaults:** identity B, club IFK Tumba, recommended navigation, "Arena" presentation, and the *Owner direction* journey. Existing viewers are moved to these once; their notes and choices are kept.
- **Top bar:** a **Club** selector (IFK Tumba / Hammarby / Utan klubb) and a **Nav** switch (recommended Week Spine vs the identity's original shell).
- **Start:** an amendment banner with the counts and shortcuts.
- **Surfaces:**
  - Every surface still shows all A/B/C alternatives and the **RECOMMENDED** label, now marked "retained under Arena Nights".
  - New **Arena Nights** section: status, conflict, adaptation and what is preserved.
  - Presentation switch: **Arena (adapted where needed) · Arena tokens only · Original identity**.
  - New filter: *Arena-adapted*.
- **Compare:** new default mode **Original vs Arena-adapted**, showing three columns: the original in its native identity, the same structure in Arena tokens, and the Arena adaptation. The A/B/C and three-identity modes are kept.
- **Club identity** (new view): the same screen side by side for three clubs. It covers 12 hi-fi surfaces plus the clubless screen and the component gallery, at any device size.
- **Journeys:** new **★ Owner direction** journey, with the retained recommendations in Arena and the club accent. The original concepts A, B and C and "My selection" are kept.
- **Decisions:** G1 is shown as owner decision B and G9 is new. The consistency check reports Arena coverage, and the surface table and Markdown export include the Arena status.

## 5. Verification (all 231 surfaces)

Script: `design-lab/experience-2027/verify-amendment.cjs`. Report: **`HM-EXPERIENCE-2027-AMENDMENT-VERIFICATION.md`**. Result: **0 issues**.

- All 231 recommendations, rationales, priorities and dependencies are byte-identical to the original proposal JSON.
- All 551 alternatives are present, and 13 fields per alternative are identical (concept, layout, hierarchy, interactions, navigation, desktop, mobile, pros, cons, complexity, perf, works-with, directions).
- Every works-with link resolves to an existing surface.
- Every surface has an Arena status, and every adaptation record is complete.
- In the lab UI, all 231 surfaces show the RECOMMENDED label on the right alternative, all alternative buttons, the rationale and the Arena section. The preview loads the recommendation in Arena, with `adapt=1` exactly where adapted.
- All 231 recommended alternatives render in Arena without errors. Concept boards show the recommended alternative, plus the adaptation note where one applies.
- The club accent resolves to the expected neon in **162 renders**: 18 prototypes × 3 clubs × desktop, tablet and mobile. The theme stays Arena and nothing overflows horizontally.

Visual evidence: `boards-arena/README.md` (64 images: each hi-fi surface's retained recommendation for Tumba, Hammarby and clubless, plus mobile). The original A/B/C boards in `boards/` are kept as they were captured before the amendment. Since then two small fixes in shared files mean the live lab can differ slightly from the old pictures: Tumba's crest trim and Arena Nights' primary-button colour.

## 6. Limitations

- The Hammarby demo re-labels the Tumba sample career: names swap in the prototype copy, and Tumba becomes an opponent. The sample data is otherwise identical, so this is not a real Hammarby squad.
- Clubless previews of club-specific screens still show sample-career content. The coherent clubless state is the dedicated MGR-01c job-market screen.
- 12 of the 21 adaptations are concept boards with written adaptations, not hi-fi screens; this matches the original hi-fi/concept split.
- To match Tumba's neon blue, the sample crest trim for IFK Tumba changed from orange to light blue (`#cfe3ff`). This shows in all identities, including the preserved A/C originals. Only the crest trim changed.
- Arena Nights' original fixed orange (`#ff4d2e`) is gone, by design. Pure-B concepts now render in the club neon, so "Concept B · Arena Nights (pure B)" in the lab differs from the B boards captured before the amendment.
- Club neon derivation is a prototype rule. Real club colour data, and any licensing of club marks, should be checked before production.
