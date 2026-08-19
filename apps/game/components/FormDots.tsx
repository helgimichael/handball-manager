type Result = "W" | "D" | "L";

export default function FormDots({ results }: { results: readonly Result[] }) {
  return (
    <span style={{ display: "inline-flex", gap: "3px" }}>
      {results.map((r, i) => (
        <span key={i} className={`hm-form-dot hm-form-${r.toLowerCase()}`}>
          {r}
        </span>
      ))}
    </span>
  );
}
