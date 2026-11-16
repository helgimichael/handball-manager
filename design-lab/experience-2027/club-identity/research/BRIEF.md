# Club kit colour audit: research brief

Goal: for each club in your batch, establish the **dominant colour of its current first-choice HOME shirt** (men's first team) for a handball management game's "Club Identity System". Each club's neon UI accent will be derived from this colour, so accuracy matters more than coverage.

## Rules (strict)
- **Home shirt, not crest.** Crest/logo colours often differ from the shirt (example: a club with a red crest that plays in white). Record the shirt.
- **Never invent.** If you cannot find evidence, set status `UNKNOWN` and leave the colours null. Leaving a club unknown is a correct answer when evidence is missing.
- **Current or most recent season** (2025/26 or 2026/27). Note the season you found. If only older evidence exists, say so and lower the status.
- **Men's senior team** of that club entity. For B/U teams (e.g. "HK S-hof", "LUGI HF U", "HF Karlskrona U", "Ystads IF HF U"), record the shirt colour only if evidence shows the team plays in the parent club's kit, and say so in notes. Otherwise mark UNCERTAIN.
- **Striped or multi-colour shirts:** record the principal or dominant visual colour as `primary`, the other as `secondary`, and set `pattern`.
- **Predominantly white or black shirts:** still record the primary (white/black). Also record a documented secondary or trim colour, because the neon will come from it. If there is no documented accent colour, say so; don't guess.
- Sources, in priority order:
  1. Official club shop / webshop product listing for the home shirt ("hemmatröja", "matchtröja hemma", "Heimtrikot", "hjemmebanetrøje", "kamptrøye hjemme", etc.).
  2. Official club website or social media text/captions describing the home kit.
  3. Kit manufacturer pages (hummel, Kempa, Select, Puma, adidas, Erima, Craft, Uhlsport, etc.).
  4. Reliable match reports or photo captions.
  5. Wikipedia infobox kit data (`body1=`, `shorts1=` hex codes in the kit template; fetch the raw wiki page with action=raw if useful) or club colour statements.
  6. Profixio / handbollboll.se / regional federation pages only for club identity confirmation, not colour.
  Search in the club's language (Swedish/Danish/German/Norwegian etc.).
- You cannot see images, so rely on textual evidence: product names, alt texts, captions, kit templates, explicit statements. Do not claim you "looked at a photo". You may cite an image URL only if its filename or alt text states the colour.
- Do **not** download files, sign up, or use paid tools. Use WebSearch/WebFetch (load via ToolSearch "select:WebSearch,WebFetch").
- Be efficient: about 2–4 searches per club; stop when you have strong evidence or are clearly stuck.

## Colour vocabulary (use these keys so all researchers are consistent)
`white, black, grey, silver, red, dark-red, wine, maroon, orange, yellow, gold, green, dark-green, light-green, blue, royal-blue, light-blue, sky-blue, navy, turquoise, teal, purple, pink`
If a documented exact hex exists (brand guide, kit template body1=, official colour statement), also give `primaryHex`/`secondaryHex`/`trimHex` with the source.

## Status
- `VERIFIED`: an official club/shop/manufacturer source explicitly states the current home-shirt colour.
- `PROBABLE`: consistent evidence from reliable non-official sources (Wikipedia kit, match reports, multiple secondary sources), or official evidence from an older season.
- `UNCERTAIN`: conflicting or weak evidence; needs owner review.
- `UNKNOWN`: no usable evidence found.

## Output
Write a JSON array to `results-<batch>.json` in this folder (same order as your batch file). One object per club:
```json
{
  "id": "se_club_hammarby_if_hf",
  "name": "Hammarby IF HF",
  "primary": "green", "primaryHex": null,
  "secondary": "white", "secondaryHex": null,
  "trim": null, "trimHex": null,
  "pattern": "solid|stripes|hoops|halves|sleeves|gradient|other|unknown",
  "description": "Short factual description of the home shirt, e.g. 'green shirt with white details, white shorts'.",
  "season": "2025/26",
  "crestDiffers": false,
  "status": "VERIFIED",
  "confidence": 0.9,
  "sources": [{ "url": "https://...", "type": "official-shop|official-club|official-social|manufacturer|match-report|wikipedia|other", "evidence": "quote or paraphrase of the text that states the colour (≤25 words)" }],
  "notes": "parent-club kit, conflicts, uncertainty reasons",
  "reviewReason": null
}
```
Set `reviewReason` (a short string) for every club that is UNCERTAIN or UNKNOWN, or where white/black primary has no documented accent. Validate the JSON with node before finishing.

Final reply (≤120 words): counts per status, and the clubs most in need of review.
