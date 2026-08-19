export default function StatValue({ value }: { value: number }) {
  const band = value >= 16 ? 4 : value >= 12 ? 3 : value >= 8 ? 2 : 1;
  return <span className={`hm-stat-value-box hm-stat-${band}`}>{value}</span>;
}
