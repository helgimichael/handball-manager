type Session = { day: string; time: string; focus: string; load: "Låg" | "Medel" | "Hög"; attendance: string };

const SESSIONS: Session[] = [
  { day: "Mån", time: "09:00", focus: "Fysisk grundträning", load: "Medel", attendance: "20/22" },
  { day: "Mån", time: "16:00", focus: "Skottträning", load: "Låg", attendance: "22/22" },
  { day: "Tis", time: "09:00", focus: "Försvarsspel — 6:0", load: "Hög", attendance: "21/22" },
  { day: "Ons", time: "09:00", focus: "Återhämtning", load: "Låg", attendance: "22/22" },
  { day: "Tors", time: "09:00", focus: "Anfallsspel — kontring", load: "Hög", attendance: "19/22" },
  { day: "Fre", time: "10:00", focus: "Matchförberedelse", load: "Medel", attendance: "22/22" },
  { day: "Lör", time: "—", focus: "Match", load: "Hög", attendance: "—" },
  { day: "Sön", time: "—", focus: "Vila", load: "Låg", attendance: "—" },
];

export default function TrainingPage() {
  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Veckoschema — träning</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Dag</th>
                <th>Tid</th>
                <th>Fokus</th>
                <th>Belastning</th>
                <th>Närvaro</th>
              </tr>
            </thead>
            <tbody>
              {SESSIONS.map((s, i) => (
                <tr key={i} data-highlight={s.day === "Tors"}>
                  <td className="hm-td-strong">{s.day}</td>
                  <td>{s.time}</td>
                  <td>{s.focus}</td>
                  <td>
                    <span className={`hm-badge ${s.load === "Hög" ? "hm-badge-negative" : s.load === "Medel" ? "hm-badge-warning" : "hm-badge-positive"}`}>
                      {s.load}
                    </span>
                  </td>
                  <td className="hm-text-muted">{s.attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Nästa pass</span>
          </div>
          <div className="hm-panel-body">
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>Anfallsspel — kontring</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 2 }}>Torsdag 09:00 · Hög belastning</div>
            <div className="hm-divider" />
            <p className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)", margin: 0 }}>
              Fokus på snabba omställningar efter återerövrad boll, med särskild vikt vid kantspelarnas löpvägar.
            </p>
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Belastningsöversikt</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <LoadRow label="Sam Darj" pct={82} />
            <LoadRow label="Viktor Almqvist" pct={79} />
            <LoadRow label="Melvin Ask" pct={38} />
            <LoadRow label="Elis Wide" pct={31} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadRow({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 75 ? "var(--hm-negative)" : pct >= 50 ? "var(--hm-warning)" : "var(--hm-positive)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)", marginBottom: 3 }}>
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--hm-surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}
