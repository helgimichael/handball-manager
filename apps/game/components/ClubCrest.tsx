type ClubCrestProps = {
  shortName: string;
  primaryColor: string;
  size?: number;
};

export default function ClubCrest({ shortName, primaryColor, size = 30 }: ClubCrestProps) {
  const initials = shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--hm-surface-2)",
        border: `1.5px solid ${primaryColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.34,
        color: primaryColor,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
