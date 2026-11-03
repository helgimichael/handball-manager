import { useId } from "react";
import { getClub } from "@/lib/game-data";
import { crestAssetUrl, getClubCrestAsset } from "./crests/clubCrests";
import { crestPalette } from "./crests/crestPalette";
import {
  resolveClubIdentity,
  type CrestMotif,
  type CrestPattern,
  type CrestShape,
} from "./crests/clubIdentity";

interface ClubCrestProps {
  shortName: string;
  primaryColor?: string;
  secondaryColor?: string;
  clubId?: string;
  size?: number;
}

const SHAPE_OUTER_PATH: Record<CrestShape, string> = {
  IFK_STAR_SHIELD: "M12 8 H88 V62 C88 86 68 103 50 112 C32 103 12 86 12 62 Z",
  ROUNDEL_BADGE: "M50 6 A52 52 0 1 1 49.99 6 Z",
  HERALDIC_CREST:
    "M12 14 L24 14 L24 8 L38 8 L38 14 L62 14 L62 8 L76 8 L76 14 L88 14 V64 C88 88 70 104 50 112 C30 104 12 88 12 64 Z",
  LAUREL_TRADITION:
    "M50 6 L86 18 V62 C86 87 69 103 50 112 C31 103 14 87 14 62 V18 Z",
  STRIPED_SHIELD:
    "M10 10 Q50 4 90 10 V66 C90 90 71 105 50 113 C29 105 10 90 10 66 Z",
  DIAMOND_PENNANT: "M50 5 L92 34 L92 78 L50 113 L8 78 L8 34 Z",
  VIKING_CHEVRON: "M10 8 L50 16 L90 8 L86 70 L50 113 L14 70 Z",
};

const SHAPE_INNER_PATH: Record<CrestShape, string> = {
  IFK_STAR_SHIELD: "M17 13 H83 V61 C83 82 65 97 50 105 C35 97 17 82 17 61 Z",
  ROUNDEL_BADGE: "M50 13 A45 45 0 1 1 49.99 13 Z",
  HERALDIC_CREST: "M17 19 H83 V63 C83 84 67 98 50 105 C33 98 17 84 17 63 Z",
  LAUREL_TRADITION:
    "M50 12 L81 22 V61 C81 83 66 97 50 105 C34 97 19 83 19 61 V22 Z",
  STRIPED_SHIELD:
    "M16 15 Q50 10 84 15 V65 C84 86 67 99 50 106 C33 99 16 86 16 65 Z",
  DIAMOND_PENNANT: "M50 12 L86 37 L86 75 L50 105 L14 75 L14 37 Z",
  VIKING_CHEVRON: "M16 14 L50 21 L84 14 L80 68 L50 105 L20 68 Z",
};

function renderPattern(
  pattern: CrestPattern,
  fill: string,
  secondary: string,
  accent: string,
) {
  const patColor = secondary === fill ? accent : secondary;
  switch (pattern) {
    case "VERTICAL_STRIPES":
      return (
        <g opacity="0.28">
          <rect x="20" y="0" width="12" height="120" fill={patColor} />
          <rect x="44" y="0" width="12" height="120" fill={patColor} />
          <rect x="68" y="0" width="12" height="120" fill={patColor} />
        </g>
      );
    case "DIAGONAL_SASH":
      return (
        <polygon
          points="-10,95 85,-10 110,12 15,118"
          fill={patColor}
          opacity="0.32"
        />
      );
    case "HALF_SPLIT":
      return <rect x="50" y="0" width="55" height="120" fill={patColor} opacity="0.22" />;
    case "CHEVRON_SPLIT":
      return (
        <g opacity="0.28">
          <polygon points="0,25 50,55 100,25 100,42 50,72 0,42" fill={patColor} />
          <polygon points="0,72 50,102 100,72 100,120 0,120" fill={patColor} />
        </g>
      );
    case "RINGED":
      return (
        <circle
          cx="50"
          cy="58"
          r="37"
          fill="none"
          stroke={patColor}
          strokeWidth="5"
          opacity="0.32"
        />
      );
    case "QUARTERED":
      return (
        <g opacity="0.22">
          <rect x="50" y="0" width="50" height="58" fill={patColor} />
          <rect x="0" y="58" width="50" height="62" fill={patColor} />
        </g>
      );
    case "SOLID":
    default:
      return null;
  }
}

function renderMotif(motif: CrestMotif, color: string, accent: string) {
  switch (motif) {
    case "STAR_4":
      return (
        <polygon
          points="50,15 54.5,25.5 65,30 54.5,34.5 50,45 45.5,34.5 35,30 45.5,25.5"
          fill={color}
          stroke={accent}
          strokeWidth="1"
        />
      );
    case "STAR_6":
      return (
        <g fill={color}>
          <polygon points="50,16 58,32 42,32" />
          <polygon points="50,36 58,20 42,20" />
        </g>
      );
    case "CROWN":
      return (
        <path
          d="M34 33 L37 20 L45 27 L50 17 L55 27 L63 20 L66 33 Z"
          fill={accent}
          stroke={color}
          strokeWidth="1.2"
        />
      );
    case "TOWER":
      return (
        <path
          d="M38 35 V20 H42 V24 H46 V20 H54 V24 H58 V20 H62 V35 Z"
          fill={color}
        />
      );
    case "ANCHOR":
      return (
        <g stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round">
          <circle cx="50" cy="20" r="3" />
          <path d="M50 23 V35 M43 26 H57 M40 31 Q50 38 60 31" />
        </g>
      );
    case "LAUREL":
      return (
        <g stroke={accent} strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M26 42 C22 28 32 19 45 18" />
          <path d="M74 42 C78 28 68 19 55 18" />
          <circle cx="50" cy="25" r="4" fill={color} stroke="none" />
        </g>
      );
    case "WINGS":
      return (
        <path
          d="M26 25 Q38 18 50 28 Q62 18 74 25 Q63 34 50 33 Q37 34 26 25 Z"
          fill={color}
        />
      );
    case "WAVE":
      return (
        <path
          d="M30 27 Q37 21 44 27 T58 27 T70 27"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      );
    case "FLAME":
    case "TORCH":
      return (
        <path
          d="M50 15 C56 22 59 27 54 34 C52 36 48 36 46 34 C41 27 44 22 50 15 Z"
          fill={accent}
        />
      );
    case "PINE":
      return (
        <polygon
          points="50,15 60,26 55,26 62,34 38,34 45,26 40,26"
          fill={color}
        />
      );
    case "HEARTS":
      return (
        <g fill={accent}>
          <circle cx="41" cy="25" r="3.5" />
          <circle cx="50" cy="22" r="3.8" />
          <circle cx="59" cy="25" r="3.5" />
        </g>
      );
    case "FORGE":
      return (
        <g fill={color}>
          <rect x="40" y="22" width="20" height="6" rx="1.5" />
          <path d="M36 28 H64 L59 34 H41 Z" />
        </g>
      );
    case "CHEVRON":
    case "SASH":
    case "STRIPES":
    default:
      return (
        <path
          d="M35 29 L50 19 L65 29"
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}

export default function ClubCrest({
  shortName,
  primaryColor,
  secondaryColor,
  clubId,
  size = 24,
}: ClubCrestProps) {
  const clipId = useId().replace(/:/g, "");
  const club = clubId ? getClub(clubId) : undefined;
  const asset = getClubCrestAsset(clubId);
  const displayName = club?.name ?? shortName;
  const height = Math.round(size * 1.16);

  if (asset) {
    return (
      <span
        className="hm-crest hm-crest-authentic"
        style={{ width: size, height }}
        role="img"
        aria-label={displayName}
        title={displayName}
        data-official="true"
      >
        <img
          src={crestAssetUrl(asset)}
          alt=""
          width={size}
          height={height}
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  const spec = resolveClubIdentity(
    clubId,
    shortName || club?.shortName || "HK",
    primaryColor ?? club?.primaryColor,
    secondaryColor ?? club?.secondaryColor,
  );
  const palette = crestPalette(spec.primaryColor, spec.secondaryColor);
  const fill = palette?.fill ?? "var(--hm-surface-3)";
  const text = palette?.text ?? "var(--hm-text-secondary)";
  const line = palette?.line ?? "var(--hm-border)";
  const edge = palette?.edge ?? "var(--hm-border)";
  const outerPath = SHAPE_OUTER_PATH[spec.shape];
  const innerPath = SHAPE_INNER_PATH[spec.shape];
  const monogram = spec.monogram;
  const fontSize =
    monogram.length >= 5
      ? 19
      : monogram.length === 4
        ? 23
        : monogram.length === 3
          ? 28
          : 33;
  const label = `${displayName} (klubbvapen i klubbens färger, ej officiellt klubbmärke)`;

  return (
    <span
      className="hm-crest"
      style={{ width: size, height }}
      role="img"
      aria-label={label}
      title={label}
      data-official="false"
      data-crest-shape={spec.shape}
    >
      <svg viewBox="0 0 100 118" aria-hidden="true">
        <defs>
          <clipPath id={`crest-clip-${clipId}`}>
            <path d={outerPath} />
          </clipPath>
          <linearGradient id={`crest-sheen-${clipId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#crest-clip-${clipId})`}>
          <path d={outerPath} fill={fill} />
          {renderPattern(spec.pattern, fill, spec.secondaryColor, spec.accentColor)}
          <rect
            x="0"
            y="0"
            width="100"
            height="118"
            fill={`url(#crest-sheen-${clipId})`}
          />
          {/* Central heraldic band so monogram always has crisp contrast */}
          <rect
            x="6"
            y="41"
            width="88"
            height="33"
            fill={fill}
            fillOpacity="0.88"
          />
          <line x1="12" y1="41" x2="88" y2="41" stroke={line} strokeWidth="1.6" />
          <line x1="14" y1="74" x2="86" y2="74" stroke={line} strokeWidth="1.6" />
        </g>

        <path
          d={outerPath}
          fill="none"
          stroke={edge}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d={innerPath}
          fill="none"
          stroke={line}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {renderMotif(spec.motif, text, spec.accentColor)}

        <text
          x="50"
          y="66"
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="800"
          letterSpacing="1.2"
          fill={text}
        >
          {monogram}
        </text>

        {size >= 36 && (
          <text
            x="50"
            y="88"
            textAnchor="middle"
            fontSize="8.2"
            fontWeight="700"
            letterSpacing="1.1"
            fill={text}
            opacity="0.88"
          >
            {spec.banner.slice(0, 11)}
          </text>
        )}
      </svg>
    </span>
  );
}

export function CrestPlaceholderNote({ clubId }: { clubId?: string }) {
  if (getClubCrestAsset(clubId)) return null;
  return (
    <p className="hm-crest-note">
      Klubbvapnet är spelets egna föreningsmärke i klubbens färger och lokal profil, inte ett licensierat officiellt varumärke.
    </p>
  );
}
