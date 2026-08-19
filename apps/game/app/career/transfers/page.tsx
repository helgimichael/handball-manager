import { getTransferItems } from "@/lib/game-data";

export default function TransfersPage() {
  const items = getTransferItems();
  const incoming = items.filter((t) => t.direction === "in");
  const outgoing = items.filter((t) => t.direction === "out");

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <TransferPanel title="Inkommande" items={incoming} />
      <TransferPanel title="Utgående" items={outgoing} />
    </div>
  );
}

function TransferPanel({ title, items }: { title: string; items: ReturnType<typeof getTransferItems> }) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">{title}</span>
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{items.length} ärenden</span>
      </div>
      {items.length === 0 ? (
        <div className="hm-panel-body hm-text-muted">Inga aktuella ärenden.</div>
      ) : (
        <table className="hm-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Klubb</th>
              <th className="hm-table-num">Summa</th>
              <th>Status</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="hm-td-strong">{t.playerName}</td>
                <td>{t.clubName}</td>
                <td className="hm-table-num">{t.feeSek ? `${t.feeSek.toLocaleString("sv-SE")} kr` : "—"}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td className="hm-text-muted">{new Date(t.deadline).toLocaleDateString("sv-SE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Accepterat" ? "positive" : status === "Avvisat" ? "negative" : status === "Förhandling" ? "warning" : "neutral";
  return <span className={`hm-badge hm-badge-${tone}`}>{status}</span>;
}
