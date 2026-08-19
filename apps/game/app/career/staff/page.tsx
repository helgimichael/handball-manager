import { TUMBA_STAFF } from "@/lib/game-data";

export default function StaffPage() {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Personal — IFK Tumba</span>
      </div>
      <table className="hm-table">
        <thead>
          <tr>
            <th>Namn</th>
            <th>Roll</th>
            <th>Nationalitet</th>
            <th className="hm-table-num">År i klubben</th>
          </tr>
        </thead>
        <tbody>
          {TUMBA_STAFF.map((s) => (
            <tr key={s.id}>
              <td className="hm-td-strong">{s.name}</td>
              <td>{s.role}</td>
              <td>{s.nationality}</td>
              <td className="hm-table-num">{s.yearsAtClub}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
