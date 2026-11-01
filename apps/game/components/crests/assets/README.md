# Club crest assets

Authentic club crests for `components/crests/clubCrests.ts`. The folder is empty on purpose: no crest has been cleared for reuse yet.

## Before adding a file

Only add a crest if it may be reused in the game. That means one of:

- the club or the rights holder has given written permission;
- the image is published under a licence that allows redistribution in a game.

A logo you can see on a club website, on Wikipedia or on social media does not count as permission. If in doubt, leave it out: the club-coloured fallback shield always renders.

## File format

- **Name:** `<clubId>.svg`, `<clubId>.webp` or `<clubId>.png`. Use the club id from `lib/game-data/clubs.ts`, for example `se_club_ifk_skovde_hk.webp`.
- **SVG:** sanitise it first. Remove scripts, external references and embedded fonts.
- **WebP/PNG:** square, transparent background, 256 × 256 px. Aim for under 15 KB.
- **Framing:** no padding beyond the crest's own shape. The component letterboxes the image inside the shield's box.

## Registering it

Import the file in `clubCrests.ts` and add an entry under the club id. Every entry records:

- `source`: who supplied the file;
- `usage`: the terms it is used under.
