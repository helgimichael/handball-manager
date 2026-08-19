type StarRatingProps = {
  stars: number;
  max?: number;
  title?: string;
};

export default function StarRating({ stars, max = 5, title }: StarRatingProps) {
  return (
    <span title={title} style={{ letterSpacing: "1px", color: "var(--hm-gold)", fontSize: "12px" }}>
      {"★".repeat(stars)}
      <span style={{ color: "var(--hm-border-strong)" }}>{"★".repeat(Math.max(0, max - stars))}</span>
    </span>
  );
}
