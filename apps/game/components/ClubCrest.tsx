// HM-ALPHA3-M01: a club's crest. An authentic crest renders when one has
// been cleared for reuse and registered in components/crests/clubCrests.ts;
// otherwise the generated shield is drawn in the club's colours. Without
// a club id or usable colours it falls back to the neutral navy shield the
// game used before. (The club colours in lib/game-data/clubs.ts are
// placeholders, not verified branding -- see that file's header.)
import { getClub } from "@/lib/game-data";
import { crestAssetUrl, getClubCrestAsset } from "./crests/clubCrests";
import { crestPalette } from "./crests/crestPalette";

type ClubCrestProps = {
  shortName: string;
  primaryColor: string;
  /** Stable club id: enables the authentic crest and the club's secondary colour. */
  clubId?: string;
  size?: number;
};

/** HM-PLAYTEST-01: a visible caption under large crest displays when the official crest is not integrated. */
export function CrestPlaceholderNote({ clubId }: { clubId?: string }) {
  if (getClubCrestAsset(clubId)) return null;
  return <small className="hm-crest-note">Platshållare · klubbens officiella märke saknas</small>;
}

export default function ClubCrest({ shortName, primaryColor, clubId, size = 30 }: ClubCrestProps) {
  const asset = getClubCrestAsset(clubId);
  if (asset) {
    return (
      // A plain <img>: crests are tiny static files and must render inside SVG-heavy, non-Next-image layouts at any size.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="game-club-crest game-club-crest-image" src={crestAssetUrl(asset)} alt={shortName} width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size, objectFit: "contain" }} />
    );
  }

  const initials = shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const club = clubId ? getClub(clubId) : undefined;
  const palette = crestPalette(club?.primaryColor ?? primaryColor, club?.secondaryColor);
  // Without a usable colour, keep the original theme-driven navy shield (CSS custom properties per surface).
  const fill = palette?.fill ?? "currentColor";
  const line = palette?.line ?? "var(--game-crest-line)";
  const text = palette?.text ?? "var(--game-crest-text)";

  return (
    // HM-PLAYTEST-01 5.3: never passed off as the official crest -- the label says what it is.
    <svg className="game-club-crest" width={size} height={size} viewBox="0 0 100 116" role="img" aria-label={`${shortName} (spelets märke i klubbfärger, inte klubbens officiella)`} data-crest={palette ? "club" : "neutral"} data-official="false">
      <title>{shortName} – spelets märke i klubbfärger. Klubbens officiella märke används först när klubben gett tillstånd.</title>
      <path d="M10 8h80v65L50 108 10 73Z" fill={fill} stroke={palette?.edge} strokeWidth={palette ? 3 : undefined} strokeLinejoin="round"/>
      <path d="M17 15h66v55L50 99 17 70Z" fill="none" stroke={line} strokeWidth="1.5"/>
      <path d="M27 23h46M34 84h32" stroke={line} strokeWidth="2"/>
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fill={text} fontSize={initials.length>2?26:34} fontFamily="var(--game-font-display)" fontWeight="700">{initials}</text>
      <circle cx="50" cy="76" r="4" fill={line}/>
      {/* HM-PLAYTEST-01: at display sizes the placeholder says so on its face, not only to screen readers. */}
      {size >= 72 && <text x="50" y="93" textAnchor="middle" fill={text} opacity={0.85} fontSize="7.5" fontFamily="var(--game-font-display)" fontWeight="700" letterSpacing="0.6">PLATSHÅLLARE</text>}
    </svg>
  );
}
