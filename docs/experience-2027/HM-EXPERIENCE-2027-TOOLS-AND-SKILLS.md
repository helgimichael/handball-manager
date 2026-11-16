# HM Experience 2027: Tools and Skills Evaluation

Status: research deliverable, read-only on code. No packages installed, no accounts touched, no paid media generated.
Date: 2026-11-12
Scope: tooling for richer visuals (portraits, club environments, competition identities, arena/clubhouse scenes, editorial imagery, motion) in `apps/game` (Next.js App Router, React 19, plain CSS, deployed to Cloudflare Workers via OpenNext).

Legend used throughout:
- **[V]** verified in this session (command output, tool call, or a source fetched/searched on 2026-11-12)
- **[A]** assumption or prior knowledge not re-verified today; check before relying on it

---

## 1. Summary recommendation

| Area | Recommendation | Why | Cost | Confidence |
|---|---|---|---|---|
| Motion (default) | **CSS transitions + keyframes + View Transitions** (React `<ViewTransition>` in Next 16) | Zero JS, already the house pattern, reduced-motion handled in CSS | Free | High |
| Motion (complex, interactive) | **Motion (motion.dev)** via `LazyMotion` + `m`, only in client islands that need gestures/layout animation | Spring + layout animations + interruptibility; lazy-loadable | Free (MIT [A]) | High |
| Motion (scripted, timeline, SVG morph) | **GSAP**, only if a timeline-heavy scene (match intro, season reveal) justifies it | Now 100% free incl. SplitText/MorphSVG [V] | Free | Medium |
| Vector animation assets | **dotLottie** for designer-made loops (trophy, confetti, loading); **Rive** only if interactive state-machine mascots/crests are wanted | Lottie is open/portable; Rive runtime is WASM-heavy [A] | Lottie free; Rive editor paid tiers [V, 3rd-party] | Medium |
| Icons | **Lucide** (ISC) as base + **custom handball SVG set** on the same 24px/1.5-2px stroke grid | Tree-shakable, consistent stroke, permissive licence | Free | High |
| Charts | **Hand-rolled SVG** for sparklines, bars, meters, radar, shot maps; **visx** (MIT) primitives if complexity grows; avoid ECharts/Nivo in main bundle | Small bundle, full CSS-token control, a11y | Free | High |
| Fonts | **Barlow Condensed** (display) + **Inter** or **IBM Plex Sans** (UI) + **JetBrains Mono / Inter tabular-nums** (stats). Self-host via `next/font/local` or `next/font/google` | Current stack is Windows-only system fonts (Bahnschrift/Segoe) [V] -> inconsistent on macOS/iOS/Android | Free (OFL) | High |
| 3D | **Blender, pre-rendered** (isometric clubhouse/arena plates, rendered to AVIF/WebP layers). No real-time three.js/R3F in management UI | Installed locally [V]; pre-render = zero runtime cost | Free (GPL tool, outputs are yours) | High |
| Image generation | **Stylised, non-likeness** pipeline: procedural layered-SVG portraits for all players (incl. real names), AI generation only for environments, editorial illustration, staff "archetype" portraits of fictional people | Avoids real-player likeness/personality-rights risk; scales to thousands | Free (SVG); AI credits per batch | High |
| AI platform | **Higgsfield** usable (connected, 1 private workspace) [V] for environment plates and editorial art via Nano Banana Pro / FLUX / GPT Image / Recraft vector; Soul/Soul Cast only for fictional characters | Multi-model hub already wired as MCP | Credits; no balance checked | Medium |
| Design tool | **Figma** (with installed `figma:*` skills) if a Dev/Full seat exists; otherwise **Penpot** (open source) + code-first lab | Figma MCP needs paid Dev/Full seat [V, 3rd-party] | $12-16/seat/mo [V, 3rd-party, conflicting] | Medium |
| Component lab | **Ladle** (lighter) or **Storybook 9** if Chromatic visual review wanted; or a `/lab` route in the app | Storybook has the ecosystem; Ladle is fast/Vite | Free (Chromatic paid beyond free tier [A]) | Medium |
| Visual regression / a11y | **Playwright** (already in repo [V]) + `toHaveScreenshot` + **@axe-core/playwright**; Lighthouse CI on key routes | Reuses existing e2e harness | Free | High |
| Tokens | Keep `app/tokens.css` as source of truth; add **Style Dictionary** only if Figma/Penpot tokens must sync | Avoid premature pipeline | Free | Medium |
| Images delivery | Static, pre-sized **AVIF + WebP** with `<picture>`/`srcset`, imported as static assets; do **not** rely on `next/image` optimization on Workers without an IMAGES binding | OpenNext needs Cloudflare Images binding or custom loader; costs per unique transform [V] | Free (static) | High |

---

## 2. What is available in this environment right now

All checks below were run on 2026-11-12. Nothing was installed or modified.

| Check | What I ran | Result |
|---|---|---|
| App deps | `cat apps/game/package.json` | Runtime deps: only `next ^16`, `react ^19`, `react-dom ^19` + workspace packages. **No motion, icon, chart, font, or image libraries.** Dev: `@playwright/test ^1.63`, eslint 9, tsx, TS 5 [V] |
| Playwright | `ls apps/game/e2e`, package scripts | 14 specs (e.g. `game-presentation.spec.ts`, `match-motion.spec.ts`, `worker-snapshots.spec.ts`) and `test:e2e:*` scripts [V]. `grep axe|toHaveScreenshot|lighthouse` -> no matches: **no axe or screenshot-diff assertions yet** [V] |
| Fonts | `grep --game-font-* app/` | `app/tokens.css`: display = `"Bahnschrift SemiCondensed", ..., "Arial Narrow"`; sans = `"Segoe UI Variable Text", ...`; mono = `"Cascadia Mono", "Consolas"`. **System fonts only, no `next/font`** [V] |
| Existing imagery | `find` for svg/png/webp/avif | `components/clubhq/assets/environments/env-*-{960,1920}.webp` (arena club, arena matchday, boardroom, dressing room, manager office, medical, press, scouting, tactical) = 1.3 MB total; `components/board/assets/boardroom-moment-*.webp` [V]. Already a 2-size WebP convention |
| Reduced motion | `grep prefers-reduced-motion` | Present in `app/game.css`, `app/manager.css`, `app/app-shell/*`, `components/experience/experience.css`, `components/finance/finance.css`; `components/experience/primitives.tsx` documents "always disabled under prefers-reduced-motion" [V] |
| View Transitions | `grep startViewTransition|ViewTransition` | Not used yet [V] |
| Crests | `components/crests/crestSources.ts` | Real club crests are **researched but not registered**; file states none has a redistribution licence (club sites, Wikipedia non-free) [V]. Good existing legal hygiene |
| Real players | `apps/game/profixio-hbl-squads-2026-11-05.json` (4,172 lines) | Real Swedish league squad data present [V] -> likeness risk for portraits |
| Deployment | `open-next.config.ts`, `wrangler.jsonc` | OpenNext on Cloudflare Workers; `assets.directory = .open-next/assets`; no `images` binding [V] |
| Blender (local) | `where blender`; `ls "C:/Program Files/Blender Foundation"` | Not on PATH; **Blender 5.2 installed** at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` [V] |
| Blender MCP | `mcp__Blender__get_objects_summary` | Failed: "Cannot connect to Blender at localhost:9876" -> Blender not running / MCP add-on not started [V]. Tools exist (render_viewport_to_path, render_thumbnail_to_path, execute_blender_code, docs search) |
| Higgsfield MCP (read-only) | `list_workspaces`, `models_list(image)`, `models_list(video)`, `models_explore(recommend/search)` | Connected; one private workspace (not selected) [V]. Image models incl. Soul 2.0, Soul Cinema, Soul Cast, Soul Location, GPT Image 2/2.5/2.6 (SVG/GIF output), Nano Banana / Pro / 2 / 2.1, Seedream 4.5, FLUX.2 / FLUX 3, MiniMax H3 Image, Recraft V4.1 (vector), Ideogram Vector, Z Image [V]. Video: Cinema Studio 3.0, Seedance 2.0/2.5, FLUX 3 Video, Grok Video 1.5, MiniMax H3, Hailuo, Wan 2.6 [V]. Free "unlim" allowance: `available: false` [V]. Balance not checked; nothing generated |
| Claude skills (user) | `ls ~/.claude/skills` | animate, animation-vocabulary, apple-design, emil-design-eng, find-animation-opportunities, improve-animations, review-animations, mobile-native, pick-ui-library, prototype, redesign-existing-projects, web-perf, + Cloudflare skills [V] |
| Claude plugins | `~/.claude/plugins/installed_plugins.json`, marketplaces | `impeccable@impeccable` (v4.4.0) installed [V] (+ agents impeccable-asset-producer / finish-reviewer / documenter). Session also lists figma:* (figma-use, design-to-code, generate-library, code-connect, implement-motion, use-motion, shaders...), design:* (accessibility-review, design-critique, design-system, design-handoff, ux-copy), canva:*, dataviz, data:*, artifact tools [V, from session skill list] |
| Connectors needing auth | session notice | Figma (brand-voice plugin), Canva require `/mcp` authorization; currently unavailable [V] |
| Browser automation | session tools | Claude Browser pane (preview_start, screenshots, resize to mobile, colour-scheme emulation) and Claude-in-Chrome available [V]; `web-perf` skill (Chrome DevTools CWV) present [V] |

---

## 3. Per-tool evaluations

### 3.1 Blender (3D environments, isometric scenes)

- **Availability:** Blender 5.2 installed [V]; MCP bridge present but not connected (Blender must run with the MCP add-on on port 9876) [V]. CLI can render headless (`blender.exe -b file.blend -a`) [A].
- **Licensing:** Blender is GPL; artwork/renders you produce are yours, GPL does not apply to output [A, long-standing Blender FAQ]. Third-party asset packs (Poly Haven = CC0 [A]; Sketchfab per-asset licences) must be tracked per file.
- **Where it adds value:**
  - Isometric **clubhouse / facility map** (training ground, gym, medical, youth academy) rendered as layered plates: base, per-upgrade-level overlays, hotspot masks. Upgrades swap layers, not scenes.
  - **Arena tiers** (school hall -> municipal hall -> modern arena) with fixed camera compositions; render day/matchday/night variants and crowd-density layers.
  - **Consistent camera language** across all environment art (same focal length, same isometric angle 30 deg / 2:1, same light rig). This is the main advantage over AI generation: deterministic re-renders when a club colour changes.
  - **Club colour variants**: drive seat/banner/floor-line materials from a palette driver, batch-render per club (Python via MCP `execute_blender_code` or CLI).
  - Generating **depth/normal passes** to feed AI img2img when a painterly style is wanted (render-then-stylise keeps geometry consistent).
- **Where it does not:** portraits (cost/realism), UI chrome, charts, anything that must change per frame from game data.
- **Pre-rendered vs real-time (three.js / R3F):** Recommend pre-rendered. R3F + three adds roughly 150-250 KB gz JS [A] plus GLB payloads, GPU cost on low-end laptops/phones, and a11y work (canvas has no semantics). Real-time only makes sense for an opt-in "arena flythrough" or the match renderer itself (separate package already). Reconsider if a 3D tactical board is ever wanted.
- **Perf impact:** pre-rendered AVIF plates ~60-180 KB each at 1920w [A]; zero JS.
- **Recommendation:** Adopt for environment plates and isometric facility map. Build one master `.blend` per environment family with locked cameras and a palette driver. Store sources under `C:\DEV\DATA\` (active) or `D:\08_Projekt\STARKVIS\` if > 500 MB per filesystem policy.

### 3.2 Higgsfield

- **Availability:** MCP connected; one private workspace; read-only catalog inspected [V]. Separate tool family exposes generate_*, execute_preset, character sheets, 3D scene builder, GPU rental — none called.
- **Relevant models [V]:**
  - *Environments / editorial stills:* Nano Banana Pro (up to 14 reference images), FLUX 3 Image (10 refs), MiniMax H3 Image (16 refs), Seedream 4.5, Cinema Studio Image 2.5, Soul Location.
  - *Vector / icons / identity:* Recraft V4.1 (`vector`, `utility_vector`, palette lock up to 10 hex), Recraft V4 Styles (saved custom style), Ideogram Vector (generate or vectorize), GPT Image 2.6 (`output_format: svg`).
  - *Characters:* Soul 2.0 (`soul_id` for a persistent identity, curated `style_id`s), Soul Cast ("consistent cinematic character identity"), character-sheet workflow. Suitable for **fictional** staff/mascot characters only.
  - *Video:* Seedance 2.0/2.5 (identity-consistent, start/end frames), Cinema Studio Video 3.0, FLUX 3 Video. Useful for marketing trailers, not in-game UI (bandwidth, autoplay, reduced-motion).
  - *3D:* scene_builder_3d (GLB/.blend export) exists [V, tool list] — potential bridge to Blender; not evaluated further.
- **Licensing:** Higgsfield help centre states it does not claim ownership of outputs and commercial use is allowed, citing ToS section 4.4; outputs may **not** be used to train/fine-tune models; some plans watermark; user is responsible for third-party likeness/IP; ToS updated effective 2026-08-27 [V, help centre via search; primary ToS not opened]. Underlying model providers (OpenAI, Google, BFL, Bytedance) may add their own terms [A].
- **Cost:** credit-based; `unlim.available: false` [V]. Prices not checked (would require balance/plans calls, deliberately avoided).
- **Fit:** Good for one-off hero imagery and environment exploration; weak for deterministic per-club variants (use Blender) and for hundreds of consistent player faces (use procedural SVG).
- **Recommendation:** Use selectively, Phase 2+, with a locked style reference set and a manifest per batch. Never feed real player photos or names.

### 3.3 Image-generation strategy for portraits and identities

**Legal frame (summary, not legal advice):** The game ships real Swedish league names (Profixio squad export [V]). Generating photoreal or recognisable faces tied to real names implicates personality/likeness rights and (in the EU/Sweden) GDPR personal-data processing for images of identifiable people, plus the Swedish Marketing Act if used in promotion [A]. Sports games normally license this via player unions / leagues. Until licensed, **portraits of real-named players must be non-likeness**.

**Recommended approach (tiers):**

1. **All players (real and generated): procedural layered SVG portraits** — "kit silhouette" style. Head-and-shoulders, deliberately non-photoreal, driven by a seeded hash of the *player id* (not name) + coarse non-identifying attributes (age band, hair length/colour from a small palette, skin tone from a fixed inclusive ramp) + club kit colours and shirt number. Same generator for real and fictional players, so real players are not singled out. Cost: free; ~2-4 KB SVG each, rendered inline or cached as sprites.
   - *Custom generator (recommended):* 8-12 layer groups (shoulders/kit, neck, face shape, ears, hair back, hair front, brows, eyes, nose, mouth, facial hair, accessories like headband/glasses), each 6-15 variants, drawn once by an illustrator on a shared grid. Fully owned IP, matches art direction.
   - *DiceBear as bootstrap:* MIT code, but **per-style design licences** [V]: e.g. Adventurer, Big Ears, Personas, Miniavs, Toon Head = CC BY 4.0 (attribution required); Lorelei (and Neutral), Pixel Art = CC0 [V, DiceBear release notes]; Notionists, Open Peeps, Thumbs, Identicon, Initials reportedly CC0 [A, secondary list]; Avataaars/Bottts "free for personal and commercial use" [V, release notes]. Check `github.com/dicebear/styles` LICENSE per style before shipping. Downsides: recognisable "DiceBear look", generic, not sporty.
2. **Staff (manager, coaches, board, physios, scouts, journalists): fictional archetype portraits** — a curated library of ~60-120 AI-generated or illustrated fictional faces in the same illustrated style, assigned to staff records. Real staff names (if any) map to the procedural generator instead. Soul ID / character sheets help keep recurring narrative characters (e.g. board chair, press officer) consistent [V, capability].
3. **Editorial illustrations (news, inbox, board moments):** scene templates without identifiable real people: crowd silhouettes, empty dressing room, trophy, press-conference podium, back-of-shirt shots with generic numbers. Generated in batches with a fixed style reference.
4. **Competition identities:** **hand-built vector** (Figma/Penpot or code) for invented competition marks; AI vector (Recraft `vector`, Ideogram Vector) only for exploration, then redraw clean. Do **not** imitate real league/federation marks (Handbollsligan, SHF, EHF) — trademark risk [A]. Use descriptive names ("Swedish top flight") with original marks.
5. **Club crests:** keep the existing policy in `components/crests/` [V] — generated monogram/shield crests from `clubIdentity.ts` palette until a club grants permission.

**Alternatives compared:**

| Option | Consistency at scale | Likeness risk | Cost | Notes |
|---|---|---|---|---|
| Custom layered SVG generator | Excellent (deterministic) | None | Illustrator time once | Recommended for players |
| DiceBear styles | Excellent | None | Free (attribution for CC BY) | Fast prototype |
| Midjourney | Good with `--sref`/`--cref` [A] | Medium-high if prompted on real names | Subscription [A] | No first-party API historically [A]; terms require paid plan for commercial use [A] |
| FLUX (BFL, also via Higgsfield) | Good with refs | Same | Credits / open weights for dev variant (non-commercial licence on some weights [A]) | |
| GPT Image (OpenAI, also via Higgsfield) | Good, strong text rendering, SVG output in 2.6 [V] | Same | Credits | |
| Higgsfield Soul / Soul Cast | Strong identity lock | High if used on real people | Credits | Fictional characters only |

### 3.4 Motion

| Tool | Licence | Size | Fit | Verdict |
|---|---|---|---|---|
| **CSS transitions/keyframes** | n/a | 0 KB JS | Hover/press, meters, list reveals, toasts | Default |
| **View Transitions API** | Web standard | 0 KB | Route changes, card -> detail morphs, tab swaps | Adopt. Next 16 docs: early 16.x behind `experimental.viewTransition`; 16.3+/16.4 docs say App Router works with no config using React `<ViewTransition>` from `react` [V]. Check installed Next minor before relying on it. Same-document only; cross-browser support good in Chromium/Safari, Firefox later [A] — progressive enhancement |
| **Motion (motion.dev)** | MIT [A — license not confirmed in search results] | Full `motion` ~34 KB; `LazyMotion`+`m` initial ~4.6-6 KB with `domAnimation` ~15-30 KB loaded on demand; `useAnimate` mini 2.3 KB [V, motion.dev docs; figures vary by source] | Springs, layout/shared-element, gestures (drag squad lineups), exit animations | Adopt for client islands only (lineup drag, match-center overlays, decision modals) |
| **GSAP** | Free incl. all former Club plugins (SplitText, MorphSVG, ScrollTrigger...) for commercial use, via public `gsap` npm; licence excludes building competing visual animation builders [V] | Core ~25 KB gz [A] | Timelines, SVG morphs, choreographed reveals | Optional; use for one or two cinematic sequences (season launch, trophy) if CSS + Motion fall short. Avoid running both GSAP and Motion broadly |
| **Lottie / dotLottie** | lottie-web MIT; dotLottie runtime MIT [A] | `@lottiefiles/dotlottie-web` uses WASM, ~100 KB+ [A]; lottie-web light ~60 KB gz [A] | Designer-made loops (trophy shine, celebrations, loaders) | Use sparingly, lazy-load, respect reduced motion (show static frame) |
| **Rive** | Runtimes MIT [A]; editor has Free / Cadet $9 / Pro $24 / Team $99 per user/mo (3rd-party snapshot Oct 2026, confirm on rive.app) [V, secondary] | `@rive-app/canvas` WASM ~150 KB+ [A] | Interactive state-machine assets (animated crest, mascot, coach reactions) | Defer; only if an interactive character becomes a feature |
| **React Spring** | MIT [A] | ~20 KB [A] | Physics springs | Redundant with Motion |
| **AutoAnimate** | MIT [A] | ~2-3 KB [A] | Zero-config list add/remove/reorder (inbox, standings re-sort) | Nice small win; or replicate with View Transitions |

**Recommended motion stack:** CSS + View Transitions (default) -> Motion via LazyMotion (interactive islands) -> dotLottie (a handful of decorative loops). GSAP held in reserve. Every motion respects `prefers-reduced-motion` (already a house rule [V]) and stays under ~300 ms for UI feedback.
Skills to use: `animate`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `emil-design-eng`, `apple-design`, `animation-vocabulary` [V installed].

### 3.5 Icons and illustration

| Set | Licence | Size/style | Notes |
|---|---|---|---|
| **Lucide** | ISC [A] | ~1,500+ icons, 24px, 2px stroke, tree-shakable `lucide-react` | Recommended base |
| Phosphor | MIT [A] | 6 weights (thin..fill, duotone) | Good if weight variants wanted; larger package |
| Tabler | MIT [A] | ~5,000+, 24px, 2px stroke | Largest free stroke set; has some sport glyphs |
| Remix Icon | Apache 2.0 (was "Remix Icon License" in v4+ — verify) [A] | line/fill pairs | Check current licence text |
| Iconify | Framework is MIT; each icon set keeps its own licence [A] | Aggregator, on-demand | Useful for exploration; pin to sets with permissive licences; prefer build-time inlining (no runtime API calls) |

**Custom handball set (recommended, ~30-40 glyphs):** ball, goal, 6 m/9 m arcs, 7 m penalty, 2-minute suspension, yellow/red/blue card, passive play hand, timeout card, pivot, wing, back-court, goalkeeper, fast break, empty-net/7th field player, substitution, injury, fatigue, morale, training load, scout, contract, transfer, youth, board, finance, press. Draw on Lucide's grid (24px, 2px stroke, round caps/joins) so they mix seamlessly. Ship as React components or one SVG sprite (`<symbol>` + `<use>`). Icons need `aria-hidden` when decorative and text labels otherwise.

### 3.6 Charts and data-viz

| Library | Approx gz size [A] | Fit |
|---|---|---|
| **Hand-rolled SVG** | 0 KB deps | Best for sparklines, form strips (W/D/L), bar/bullet meters, attribute radars, shot maps on a court diagram, xG-like timelines. Full token theming, SSR-friendly, accessible tables alongside |
| **visx** (Airbnb, MIT) | modular, ~10-30 KB for scales/shapes | Use if axes/scales/tooltip logic gets repetitive; low-level, matches hand-rolled style |
| Observable Plot (ISC) | ~70-100 KB with d3 deps | Great for internal analysis pages/QA, less for bespoke game UI |
| Recharts (MIT) | ~90-130 KB | Fast to build, generic look, SVG-heavy at many points |
| Nivo (MIT) | heavy per chart | Pretty defaults; bundle/SSR overhead |
| ECharts (Apache 2.0) | ~300 KB+ full, tree-shakable to ~100 KB+ | Canvas, powerful; overkill for game UI |
| uPlot (MIT) | ~15-20 KB | Fastest canvas time series; useful for long match-event timelines only |

**Recommendation:** hand-rolled SVG primitives in a `components/viz/` folder (the app already renders meters in CSS, e.g. `.xp-meter-track` [V]), `d3-scale`/`d3-shape` micro-deps if needed, visx as escalation. Use the installed `dataviz` skill for palette validation and colour-blind-safe categorical sets [V installed].

### 3.7 Fonts

Current state: Windows system fonts only [V] — on macOS/iOS/Android the display face falls back to Arial Narrow/Impact, which breaks the sporty identity and metrics.

Candidates (all SIL OFL 1.1 [A] unless noted):
- **Barlow / Barlow Condensed / Barlow Semi Condensed** — closest open match to Bahnschrift's DIN-like feel; many static weights (not variable) [A]. Ideal display/scoreboard face.
- **Saira / Saira Condensed** — variable width+weight; techy sport feel.
- **Oswald** — variable weight, condensed; very common, a bit generic.
- **Archivo** — variable width (62-125) + weight; one family can cover condensed display and UI.
- **Inter** — variable, excellent UI, `tnum`, `ss01`, `cv` features; tabular figures for tables.
- **Geist / Geist Mono** — OFL [A]; clean, slightly generic Vercel look.
- **IBM Plex Sans / Mono** — OFL; editorial, good for news/press pages.
- **Space Grotesk** — personality, weaker for dense tables.
- **JetBrains Mono** — OFL [A]; good for stat columns if a mono is wanted.

**Recommended pairings:**
1. *Primary:* **Barlow Condensed** (display: scores, headings, shirt numbers) + **Inter** (UI, tables with `font-variant-numeric: tabular-nums`) + **JetBrains Mono** (rare debug/numeric codes). Closest to current Bahnschrift intent.
2. *Single-family alternative:* **Archivo** variable (wdth 62-75 display, 100 UI) — one file, fewer requests.
3. *Editorial accent:* **IBM Plex Serif** or **Source Serif 4** for long-form news only.

Load via `next/font` (self-hosted, `display: swap`, subsets `latin` + `latin-ext` for å/ä/ö), map to existing `--game-font-*` tokens so no component changes are needed. Budget: <= 3 font files on first paint, ~25-45 KB each WOFF2 [A].

### 3.8 Design tools

- **Figma + Dev Mode + Figma MCP:** Installed `figma:*` skills (figma-use, design-to-code, generate-library, code-connect, implement-motion, use-motion, spec, shaders) [V]. MCP server requires a **Dev or Full seat** (Dev ~$12/mo, Full ~$15-16/mo on Professional; sources conflict on plan availability) [V, third-party]. Figma connector needs `/mcp` authorization [V]. Strong choice if a seat exists.
- **Penpot:** open source (MPL 2.0 [A]), self-hostable or free cloud, native design tokens, CSS-grid/flex layouts that map to code. Good no-cost fallback; no installed Claude skill.
- **Framer:** website/prototype builder; little value for an in-app game UI. Skip.
- **Canva:** plugin installed but needs auth [V]; useful for marketing/social assets only.
- **Storybook vs Ladle:** Storybook (MIT) has a11y/interactions addons and Chromatic integration; heavier, and Next 16 + webpack support should be checked [A]. Ladle (MIT, Vite) is lighter but needs the plain-CSS imports to work outside Next [A]. Cheapest option: a gated `/lab` route inside the app (fixtures + all states), covered by Playwright screenshots — the repo already has `app/scenario-lab/` [V], which is a natural home.
- **Chromatic:** hosted visual review; free tier limited snapshots, paid beyond [A]. Not needed if Playwright screenshots suffice.
- **Tokens pipeline:** `app/tokens.css` already exists [V]. Add Style Dictionary (Apache 2.0 [A]) only when tokens must round-trip to Figma/Penpot (Tokens Studio plugin has free + paid tiers [A]).

### 3.9 Claude skills, plugins, MCP and QA tooling

Useful now [V installed/available]:
- **Design direction & critique:** `impeccable:impeccable` (+ asset-producer, finish-reviewer, documenter agents), `redesign-existing-projects`, `design:design-critique`, `design:design-system`, `design:ux-copy`, `design:design-handoff`, `pick-ui-library`, `prototype`.
- **Motion:** `animate`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `emil-design-eng`, `apple-design`, `animation-vocabulary`, `figma:figma-implement-motion`.
- **Accessibility & perf:** `design:accessibility-review` (WCAG 2.1 AA), `web-perf` (Chrome DevTools CWV), `mobile-native`.
- **Data-viz:** `dataviz`, `data:create-viz`.
- **Figma:** full `figma:*` suite (blocked on seat + auth).
- **3D / media:** Blender MCP (needs Blender running with add-on), Higgsfield MCP (read-only connector + full generation connector).
- **Browser:** Claude Browser pane (viewport/colour-scheme emulation, screenshots), Claude-in-Chrome.
- **Discoverable but not installed:** `find-skills` can search for e.g. GSAP skills (greensock/gsap-skills appears on skills.sh [V, search result]); not installed.

QA additions (no installs done):
- `@axe-core/playwright` (MPL 2.0 [A]) inside existing e2e specs — fail on serious/critical.
- Playwright `toHaveScreenshot()` per key screen at 375/768/1440 and light/dark, `animations: "disabled"`.
- Lighthouse CI (Apache 2.0 [A]) on 3-5 routes with budgets (LCP < 2.5 s, CLS < 0.05, JS < 200 KB gz per route).

### 3.10 Asset pipeline

- **Formats:** AVIF primary, WebP fallback, PNG only for alpha cut-outs where AVIF alpha artefacts show. SVG for icons, crests, portraits, competition marks. Video (if ever) as AV1/H.264 MP4 with poster, never autoplay with sound, paused under reduced motion.
- **next/image on Cloudflare:** OpenNext requires an `IMAGES` binding (Cloudflare Images, billed per unique transformation per month) or a custom loader [V]. Recommendation: keep current approach (pre-sized static WebP at 960/1920 [V]) and extend it to AVIF+WebP at 640/960/1440/1920 generated at build/authoring time with `sharp` or `squoosh`-style CLI, served from Workers static assets (`.open-next/assets`) with immutable cache headers. Use `<picture>` + `srcset` + explicit `width/height` to avoid CLS. Static imports via `StaticImageData` already used for crests [V].
- **SVG strategy:** icons as React components (tree-shaken) or one `<symbol>` sprite; portrait layers as a single sprite per layer group; SVGO in the authoring step; no inline `<style>` with global selectors.
- **CDN:** Workers static assets are already on Cloudflare's edge [A]; R2 only if the asset library grows beyond the Workers asset limits (per-file 25 MiB, total file count limits [A]).
- **Budgets (proposed):** hero/environment plate <= 180 KB AVIF @1920 and <= 70 KB @960; editorial thumbnail <= 40 KB; portrait SVG <= 4 KB; icon <= 1 KB; per-route image weight above the fold <= 250 KB; motion libs lazy and <= 35 KB gz on any single route; fonts <= 120 KB first paint.

---

## 4. Recommended art direction and generation pipeline

### 4.1 Style rules ("Nordic matchday editorial")
1. **Illustrated, not photoreal.** Flat-to-soft shading, 2-3 tone shadows, subtle paper/grain overlay; no photographic faces anywhere.
2. **Palette:** neutral base from `app/tokens.css`; accents come from the *club's* palette (`crestPalette.ts` [V]) so every club feels owned. Max 1 accent + 1 secondary per image.
3. **Light:** cool Scandinavian daylight for training/office; warm sodium/LED arena light for matchday; one key light direction (upper-left) everywhere.
4. **Camera:** environments in fixed isometric (2:1) or fixed 35 mm eye-level; editorial in 50 mm medium shots. Same horizon line per family.
5. **People:** silhouettes, backs, hands, crowds, or the procedural portrait style. Never a recognisable real person.
6. **Typography in images:** none baked in (all text is live HTML for i18n and a11y), except invented competition marks drawn as vectors.
7. **Accessibility:** every image has a role — decorative (`alt=""`) or informative (descriptive alt from data). Minimum 4.5:1 contrast for any text overlaid on imagery via scrim tokens.

### 4.2 Pipeline
1. **Brief** -> 2. **Reference board** (5-8 locked style refs) -> 3. **Generate/render** (Blender for environments, AI for editorial/staff, code for portraits/icons) -> 4. **Select & retouch** -> 5. **Vectorise/redraw** (identities) -> 6. **Optimise** (AVIF/WebP sizes, SVGO) -> 7. **Manifest** entry -> 8. **Review gate** -> 9. **Commit** to `components/<area>/assets/`.

### 4.3 Prompt templates (for AI batches; fill `{}`)
- **Environment plate:** "Illustrated isometric {room/venue} of a Swedish handball club, {tier: community / mid / elite}, {time of day} light, accents in {primary hex} and {secondary hex}, soft flat shading with subtle grain, no people's faces, no text, no logos, clean empty foreground for UI overlay on the {left/right} third, 16:9."
- **Editorial illustration:** "Editorial sports illustration, {scene: post-match dressing room / press conference podium / transfer signing desk}, viewed {angle}, figures shown from behind or in silhouette, generic kit in {club colours} with no numbers or crests, muted Nordic palette, soft grain, no text, 3:2."
- **Staff archetype (fictional):** "Head-and-shoulders illustrated portrait of a fictional {role} at a handball club, {age band}, {neutral expression}, flat soft shading matching reference style, plain {token colour} background, no text, no logos, 1:1." (Use one reference set + `soul_id`/character sheet for recurring narrative characters.)
- **Competition mark exploration:** "Minimal vector emblem for an invented handball competition called {name}, {shape: shield / roundel / wordmark}, 2 colours {hex, hex}, geometric, no real league marks, scalable to 24 px."
- **Negative constraints (always):** no real people, no real club/league logos, no text, no watermarks, no brand marks on kit.

### 4.4 Naming and manifest
`{area}-{subject}-{variant}-{width}.{ext}` e.g. `env-arena-matchday-night-1920.avif`, `edit-presser-podium-01-960.webp`, `staff-arch-physio-f-40s-03.svg`, `comp-mark-division2-v2.svg`, `icon-hb-7m-penalty.svg`.
Each batch appends to `assets.manifest.json` (per area): file, source (blender/higgsfield:{model}/illustrator/procedural), prompt or .blend path + camera, seed/job id, date, licence/terms snapshot, reviewer, alt text.

### 4.5 Review gate checklist
Style match against reference board; no likeness of real people; no third-party marks; contrast with UI overlay; budgets met; alt text written; manifest complete; reduced-motion fallback for any animated asset; dark-mode check.

---

## 5. Costs and limitations

| Item | Cost | Limitation |
|---|---|---|
| Blender | Free | Artist time; MCP needs Blender running; renders are static |
| Higgsfield | Credits (balance not checked); no free unlim allowance active [V] | Terms forbid training on outputs [V]; watermark on some plans [V]; model drift between versions -> keep refs/seeds |
| Midjourney / others | Subscriptions [A] | Not connected here |
| Figma Dev/Full seat | ~$12-16/mo/seat [V, conflicting 3rd-party] | MCP gated by seat; auth pending |
| Rive editor | Free tier limited (3 files) / $9-$99 per user/mo [V, 3rd-party] | WASM runtime weight [A] |
| Cloudflare Images (if next/image optimisation) | Per unique transformation/month [V] | Avoidable with pre-sized statics |
| Chromatic | Free tier then paid [A] | Optional |
| Fonts, icons, charts, Motion, GSAP, Lottie | Free | Attribution only where licence requires (CC BY avatars) |

---

## 6. Legal and licensing notes

- **Real players:** no photoreal or recognisable portraits; procedural portraits keyed to id; no AI generation prompted with real names; no use of real player images as references. Consider an in-game disclaimer that portraits are stylised and not depictions.
- **Clubs/leagues:** crests only with permission (existing policy in `components/crests/crestSources.ts` [V]). Invented competition marks; do not mimic Handbollsligan/SHF/EHF marks [A].
- **AI outputs:** Higgsfield claims no ownership and allows commercial use (ToS 4.4 per help centre) [V]; copyright protection of purely AI outputs is uncertain in many jurisdictions [A] — significant human editing/redrawing strengthens ownership of identity assets. Record model + date per asset.
- **GSAP:** free for commercial use, but licence bars use in competing visual animation builders [V]; irrelevant for a game.
- **DiceBear:** code MIT; style designs vary (CC0 / CC BY 4.0 / custom) [V]; CC BY requires visible attribution (credits screen).
- **Fonts:** OFL allows bundling and self-hosting; do not sell fonts standalone; keep licence files [A].
- **Blender:** GPL applies to the program, not your renders [A]; track third-party asset licences.
- **Icons:** ISC/MIT require licence notice in distributed source/credits [A].

---

## 7. Phased adoption plan

**Phase 0 — Foundations (1-2 weeks, no new art)**
- Self-host fonts via `next/font` mapped to `--game-font-*` (Barlow Condensed + Inter).
- Add Lucide; start custom handball icon set (first 12 glyphs).
- Add `@axe-core/playwright` + `toHaveScreenshot` to 3 existing e2e specs; Lighthouse budget on 3 routes.
- Write the art-direction one-pager + reference board; create manifest schema.

**Phase 1 — Motion & data-viz (2-3 weeks)**
- View Transitions on route changes and card->detail (verify Next minor version support).
- Hand-rolled SVG viz kit (sparkline, form strip, bullet meter, radar, court shot map) with `dataviz` palette validation.
- Motion via LazyMotion for lineup drag and modal choreography only.
- Run `find-animation-opportunities` then `review-animations` over the result.

**Phase 2 — Portraits & identities (3-4 weeks)**
- Commission/draw layered SVG portrait parts; build seeded generator; replace placeholder avatars for all players.
- Staff archetype library (60-120) — fictional only.
- Invented competition marks (vector, hand-cleaned).

**Phase 3 — Environments & editorial (4-6 weeks, parallel)**
- Blender master scenes: isometric clubhouse with upgrade layers, 3 arena tiers, club-colour batch renders; replace/extend `env-*` plates.
- Higgsfield editorial batches (news/inbox/board) using templates, reviewed through the gate.

**Phase 4 — Delight (optional)**
- 3-5 dotLottie loops (trophy, promotion, signing); consider Rive or GSAP only for a single flagship sequence.
- Marketing video via Higgsfield Seedance/Cinema Studio outside the game bundle.

Exit criteria per phase: budgets in 3.10 met, axe serious/critical = 0, screenshot baselines approved, reduced-motion parity.

---

## 8. Top risks
1. **Real-player likeness** if anyone generates "realistic" portraits from names — mitigated by procedural non-likeness policy.
2. **Style drift** across AI batches/model versions — mitigated by reference boards, manifests, and Blender for deterministic plates.
3. **Bundle/perf creep** from stacking motion/chart libraries — one library per job, lazy islands, budgets in CI.
4. **Platform font inconsistency** today (Windows-only stack) — fix in Phase 0.
5. **next/image on Workers** silently unoptimised or costly — use pre-sized statics.
6. **Licensing gaps** (CC BY attribution, crest permissions, model terms changes) — manifest records licence snapshot per asset.

---

## 9. Sources (accessed 2026-11-12)

- GSAP free incl. plugins: https://webflow.com/blog/gsap-becomes-free ; https://gsap.com/community/standard-license/ ; https://gsap.com/blog/3-13/
- Higgsfield ownership/commercial use: https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially ; ToS update notice: https://higgsfield.ai/es/blog/terms-of-use-privacy-policy-update ; primary ToS (not opened): https://higgsfield.ai/terms-of-use-agreement
- Higgsfield model catalog: read-only MCP calls `list_workspaces`, `models_list`, `models_explore` (this session)
- Motion bundle size: https://motion.dev/docs/react-reduce-bundle-size ; https://motion.dev/motion/lazy-motion/
- Next.js View Transitions: https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition ; https://unpkg.com/next@16.4.3/dist/docs/01-app/02-guides/view-transitions.md
- OpenNext images on Cloudflare: https://opennext.js.org/cloudflare/howtos/image ; https://developers.cloudflare.com/changelog/post/2026-07-01-binding-unique-transformations/ ; https://developers.cloudflare.com/images/pricing/
- DiceBear licences: https://www.dicebear.com/styles/adventurer ; https://www.dicebear.com/styles/toon-head/ ; https://www.github.com/dicebear/dicebear/discussions/255 ; https://github.com/dicebear/styles ; secondary list https://allsvgicons.com/avatar-generators/dicebear/
- Rive pricing (secondary): https://toolradar.com/compare/ilo-animation-vs-rive ; https://gappsy.com/tools/rive/ ; confirm at https://rive.app/pricing
- Figma MCP seats (secondary, conflicting): https://www.everydev.ai/tools/figma-dev-mode-mcp ; https://toolradar.com/tools/figma-mcp/pricing ; confirm at https://www.figma.com/pricing/
- Items marked [A] (Lucide/Phosphor/Tabler/Remix/Iconify licences, chart lib sizes, font licences, Lottie/Rive runtime sizes, Penpot, Storybook/Ladle, Chromatic, Blender GPL-output FAQ) were not re-verified today; confirm on each project's site/npm page before adoption.
