# Club Identity Phase 2: visual verification brief

You verify the **men's first team's first-choice home shirt** for each club in your batch file, using **images you actually look at** in the built-in browser. The result drives the club's neon UI accent in a handball manager game, so accuracy matters more than coverage. **Never guess.** UNKNOWN is a correct answer when evidence is missing.

Folder: `C:\DEV\WORKTREES\handball-manager\experience-2027\design-lab\experience-2027\club-identity\research\phase2\`

## Tools
- **Browser (required).** The built-in browser tools (`mcp__Claude_Browser__*`).
  - Create **your own tab** first with `tabs_create` and pass that `tabId` to every call. Other researchers share the browser, so never touch other tabs and never call `tabs_select`.
  - Use `navigate`, `computer` (screenshot / zoom / scroll), `find`, `get_page_text`.
  - If the browser tools are not available to you, stop at once and say so in your final reply.
- **Cookie banners:** click only a "reject / only necessary" option ("Bara nödvändiga", "Endast nödvändiga", "Avvisa"). If the only option is accept, don't click it; scroll past it.
- **Never** log in, sign up, accept terms, download files, or submit forms. Skip pages that need a login (Instagram and Facebook usually do).
- **WebSearch / WebFetch** (load via ToolSearch "select:WebSearch,WebFetch") only to *find* candidate pages: club website, match reports, league pages. Judge colour only from images you see.

## Evidence priority
1. The club's official website: news and match reports with match photos of the **men's A-team**, plus team/squad photos.
2. Handbollsligan / Svenska Handbollförbundet / district federation pages with match photos (handbollsligan.se, svenskhandboll.se, profixio is text only).
3. The club's public social pages if viewable without login.
4. Reliable press match photography (local newspapers; note "press").
5. Club shop product images. These **alone** cannot prove the men's A-team wears the shirt.

Check that the photo shows **the men's team** (not women or youth), **at home or in the home kit**, and as **recent** as possible (note the date or season). The crest colour often differs from the shirt; record both.

## For each club
1. Find and open the best evidence. Take a screenshot (scale 1 unless the page is huge). The tool result gives the saved image path (`.../tool-results/mcp-Claude_Browser-blob-*.jpg|png`).
2. Copy that file to `evidence/<club-id>-<n>.<ext>` in this folder (Bash `cp`).
3. Measure the dominant shirt colour from the copy. Pick a box on well-lit plain fabric, avoiding logos, numbers, skin and shadow:
   - `python -P "C:\DEV\WORKTREES\handball-manager\experience-2027\design-lab\experience-2027\club-identity\sample_colour.py" "<copy>" info` gives the image size.
   - `python -P "...sample_colour.py" "<copy>" x1 y1 x2 y2` gives `{hex, ...}`.

   Do the same for the secondary colour or accent if there is a clear area. Run python from a neutral working directory (e.g. the phase2 folder), never from a downloaded-files folder.
4. Name the colours with this vocabulary: `white, black, grey, silver, red, dark-red, wine, maroon, orange, yellow, gold, green, dark-green, light-green, blue, royal-blue, light-blue, sky-blue, navy, turquoise, teal, purple, pink`.

## Status (owner standard)
- **VERIFIED:** an official match photo or official source; the men's A-team home shirt is identifiable; the colour can be judged with high confidence. A shop product image alone is never enough.
- **PROBABLE:** clear visual evidence that isn't enough for full verification, e.g. older A-team photos, club channels without a confirmed current season, press photos, or a shop image plus consistent club imagery.
- **UNCERTAIN:** conflicting sources, several possible shirt colours, or unclear which team or kit the image shows.
- **UNKNOWN:** no reliable evidence (record what you tried).

## Output
Write a JSON array to `results-<batch>.json` in this folder (same order as your batch file):
```json
{
  "id": "se_club_hammarby_if_hf", "name": "Hammarby IF HF",
  "status": "VERIFIED", "confidence": 0.95,
  "primary": "green", "primaryMeasured": "#2E7D4F",
  "secondary": "white", "secondaryMeasured": "#E9EEEC",
  "accent": "white", "accentMeasured": null,
  "pattern": "solid|stripes|hoops|halves|sleeves|gradient|other|unknown",
  "crest": { "primary": "green", "secondary": "white", "note": "crest differs from shirt? describe" },
  "description": "Green shirt with thin white vertical stripes, green shorts.",
  "team": "men-A", "homeKit": true, "season": "2026/27", "photoDate": "2026-11-11",
  "evidence": [
    { "url": "https://...", "type": "official-match-photo|official-team-photo|league-photo|press-photo|official-social|shop-product|text", "date": "2026-11-11",
      "screenshot": "evidence/se_club_hammarby_if_hf-1.jpg", "observation": "what the image shows (men's A-team? home? colours)" }
  ],
  "womenDiffer": null,
  "notes": "conflicts, alternative kits, older images",
  "reviewReason": null
}
```
- `team`: `men-A`, `men-B`, `women`, `youth` or `unknown` (the team in the best evidence).
- `womenDiffer`: true or false if you saw the women's kit, otherwise null.
- Every club gets at least the sources you tried. Set `reviewReason` for anything not VERIFIED.
- B/U teams (e.g. "HK S-hof", "LUGI HF U", "… U"): do **not** inherit the parent's colour without an image of that team.
- Validate JSON with node before finishing.

Final reply (≤150 words): counts per status, notable changes from the prior evidence (the `prior` field in your batch), and the clubs needing review.
