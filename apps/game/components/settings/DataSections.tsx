"use client";
// Arena 231 -- ENT-05/SYS-01 'Data': the save-file actions moved into settings. Same repository calls as the
// career's ⋯ menu (export/import); nothing about how a save is written changes.
import { useRef, useState } from "react";
import Link from "next/link";
import { exportSaveAsJson, importSaveFromJson, saveCareerState } from "@/lib/save/saveRepository";
import { useCareer } from "@/lib/career/CareerContext";

function useImport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  async function run(file: File) {
    setBusy(true); setMessage(null);
    try {
      await importSaveFromJson(file);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full navigation mounts the imported career fresh.
      window.location.assign("/career");
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Importen misslyckades. Välj en komplett exporterad sparafil och försök igen." });
      setBusy(false);
    }
  }
  return { busy, setBusy, message, setMessage, run };
}

/** From the main menu: import a backup; exports are made per career in Ladda spel. */
export function EntryDataSection() {
  const input = useRef<HTMLInputElement>(null);
  const { busy, message, run } = useImport();
  return <div className="hm-us-data">
    <div className="hm-us-row">
      <div className="hm-us-label"><strong>Importera sparfil</strong><p>Öppna en säkerhetskopia (.json) som du har exporterat tidigare. Den läggs till bland dina karriärer och öppnas direkt.</p></div>
      <div className="hm-us-control"><button type="button" className="hm-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Importerar…" : "Välj sparfil…"}</button></div>
    </div>
    <div className="hm-us-row">
      <div className="hm-us-label"><strong>Exportera säkerhetskopia</strong><p>Varje karriär kan exporteras från Ladda spel, eller från ⋯-menyn när karriären är öppen. Karriärer sparas annars bara i den här webbläsaren.</p></div>
      <div className="hm-us-control"><Link className="hm-btn" href="/load-game">Till Ladda spel →</Link></div>
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Importera sparfil från inställningar" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && !busy) void run(f); }} />
    {message && <p className="hm-us-status" role={message.error ? "alert" : "status"} data-error={message.error}>{message.text}</p>}
  </div>;
}

/** Inside a career: export the running career; importing replaces it, so it is confirmed first. */
export function CareerDataSection() {
  const { career, save } = useCareer();
  const input = useRef<HTMLInputElement>(null);
  const { busy, setBusy, message, setMessage, run } = useImport();
  const [confirm, setConfirm] = useState(false);
  async function exportNow() {
    setBusy(true); setMessage(null);
    try {
      await saveCareerState(save.saveId, career);
      await exportSaveAsJson(save.saveId);
      setMessage({ error: false, text: "Säkerhetskopian har skickats till webbläsarens nedladdningar." });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Exporten misslyckades. Försök igen." });
    } finally { setBusy(false); }
  }
  return <div className="hm-us-data">
    <div className="hm-us-row">
      <div className="hm-us-label"><strong>Exportera säkerhetskopia</strong><p>Sparar karriären som den är just nu och laddar ner den som en .json-fil. Bra innan du byter dator eller rensar webbläsaren.</p></div>
      <div className="hm-us-control"><button type="button" className="hm-btn" disabled={busy} onClick={() => void exportNow()}>{busy ? "Arbetar…" : "Exportera"}</button></div>
    </div>
    <div className="hm-us-row">
      <div className="hm-us-label"><strong>Importera sparfil</strong><p>Öppnar en annan sparfil i stället för den här karriären.</p></div>
      <div className="hm-us-control">{confirm ? <div className="hm-us-confirm" role="group" aria-label="Bekräfta import">
        <p><strong>Den här karriären ersätts</strong> av sparfilen du väljer. Exportera först om du vill kunna gå tillbaka.</p>
        <div><button type="button" className="hm-btn hm-btn-sm" disabled={busy} onClick={() => void exportNow()}>Exportera först</button><button type="button" className="hm-btn hm-btn-sm" onClick={() => setConfirm(false)}>Avbryt</button><button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={busy} onClick={() => { setConfirm(false); input.current?.click(); }}>Välj fil…</button></div>
      </div> : <button type="button" className="hm-btn" disabled={busy} onClick={() => setConfirm(true)}>Importera…</button>}</div>
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Importera sparfil från inställningar" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && !busy) void run(f); }} />
    {message && <p className="hm-us-status" role={message.error ? "alert" : "status"} data-error={message.error}>{message.text}</p>}
  </div>;
}
