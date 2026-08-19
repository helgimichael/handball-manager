"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSave, listSaves, setActiveSaveId, touchSave, type CareerSave } from "@/lib/save/saveRepository";
import { getClub } from "@/lib/game-data";

export default function LoadGamePage() {
  const router = useRouter();
  const [saves, setSaves] = useState<readonly CareerSave[]>([]);

  useEffect(() => {
    // One-shot client-only localStorage read on mount -- see
    // career/layout.tsx for why useSyncExternalStore isn't used here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaves(listSaves());
  }, []);

  function handleLoad(save: CareerSave) {
    setActiveSaveId(save.saveId);
    touchSave(save.saveId);
    router.push("/career");
  }

  function handleDelete(saveId: string) {
    deleteSave(saveId);
    setSaves(listSaves());
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--hm-bg-app)", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
      <div style={{ width: 560 }}>
        <div className="hm-eyebrow" style={{ marginBottom: 6 }}>Handball Manager</div>
        <h1 style={{ fontSize: "var(--hm-text-xl)", fontWeight: 800, marginBottom: 20 }}>Ladda spel</h1>

        {saves.length === 0 ? (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Inga sparade karriärer hittades.</div>
          </div>
        ) : (
          <div className="hm-panel">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Klubb</th>
                  <th>Speldatum</th>
                  <th>Senast spelad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {saves.map((save) => {
                  const club = getClub(save.clubId);
                  return (
                    <tr key={save.saveId}>
                      <td className="hm-td-strong">{save.manager.name}</td>
                      <td>{club?.name ?? "—"}</td>
                      <td>{save.gameDate}</td>
                      <td className="hm-text-muted">{new Date(save.lastPlayedAt).toLocaleString("sv-SE")}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => handleLoad(save)}>
                          Ladda
                        </button>
                        <button type="button" className="hm-btn hm-btn-sm" onClick={() => handleDelete(save.saveId)}>
                          Ta bort
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button type="button" className="hm-btn hm-btn-ghost" style={{ marginTop: 16 }} onClick={() => router.push("/")}>
          ← Tillbaka till huvudmenyn
        </button>
      </div>
    </div>
  );
}
