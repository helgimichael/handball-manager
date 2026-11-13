# Verification pass: official evidence only (top two Swedish tiers)

The first pass (results-1.json) relied mostly on Wikipedia kit templates. Your job is to **upgrade or correct** each club using **official, current** evidence only:
1. The club's webshop (often teamsportia.se, hummel/kempa/select team shops, clubmate.se, unisport, stadium team shops, "klubbshop"): the home match shirt product ("matchtröja hemma", "hemmatröja", "matchställ"), its colour name, and its image filename or alt text.
2. The club's official website or Instagram/Facebook post presenting the 2025/26 or 2026/27 kit ("nya matchställ", "ny tröja").
3. The manufacturer's team page for the club.

Read `BRIEF.md` for the colour vocabulary, the rules and the JSON schema. Rules: home shirt (not crest), never invent, and cite what the text says. You cannot see images, so only cite what text, filenames or alt text state.

For each club in results-1.json, output an object in the **same schema** to `results-1v.json` (same folder), with these differences:
- If you found official current evidence: set status `VERIFIED`, update colours if they differ (say what changed in `notes`), and list the official source(s) **first** in `sources`. Keep useful earlier sources after them.
- If not: copy the earlier record unchanged, and add `"verifyAttempt": "<what you searched/opened>"`.
- Always add `"imageUrls": [...]`: direct URLs of official home-shirt product or kit-launch images you came across (for later visual checking), or `[]`.

Validate JSON with node. Final reply (≤120 words): which clubs were upgraded or corrected, and which still lack official evidence.
