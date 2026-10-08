type ClubCrestProps = {
  shortName: string;
  primaryColor: string;
  size?: number;
};

export default function ClubCrest({ shortName, size = 30 }: ClubCrestProps) {
  const initials = shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <svg className="game-club-crest" width={size} height={size} viewBox="0 0 100 116" role="img" aria-label={shortName}>
      <path d="M10 8h80v65L50 108 10 73Z" fill="currentColor"/>
      <path d="M17 15h66v55L50 99 17 70Z" fill="none" stroke="var(--game-crest-line)" strokeWidth="1.5"/>
      <path d="M27 23h46M34 84h32" stroke="var(--game-crest-line)" strokeWidth="2"/>
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fill="var(--game-crest-text)" fontSize={initials.length>2?26:34} fontFamily="var(--game-font-display)" fontWeight="700">{initials}</text>
      <circle cx="50" cy="76" r="4" fill="var(--game-crest-line)"/>
    </svg>
  );
}
