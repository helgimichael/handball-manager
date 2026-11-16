"use client";

// Arena Nights SYS-02 (A) "Dev console home": one gated home for every internal tool.
// Tool list (8) + real data counts from the editor catalog (4). Number keys open a tool.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DevPageHead } from "@/components/dev/DevShell";
import { useEditorMode } from "@/components/dev/useEditorMode";
import { DEV_TOOL_GROUP_LABEL, DEV_TOOLS, devDataCounts, devToolForShortcut, type DevCatalogClub, type DevToolGroup } from "@/lib/editor/devTools";

const GROUPS: readonly DevToolGroup[] = ["data", "labs", "debug"];
/** Tools that read/write the real database are hidden behind the client Editor Mode toggle (EditorModeGate). */
const NEEDS_EDITOR_MODE = new Set(["players", "ratings", "court-grid", "cpu-recruitment"]);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function EditorHomePage() {
  const router = useRouter();
  const { hydrated, enabled } = useEditorMode();
  const [clubs, setClubs] = useState<DevCatalogClub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/editor/catalog")
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: { clubs: DevCatalogClub[] }) => setClubs(data.clubs))
      .catch(() => setError("Kunde inte läsa databasen (/api/editor/catalog)."));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const tool = devToolForShortcut(event.key);
      if (!tool) return;
      event.preventDefault();
      router.push(tool.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const counts = clubs ? devDataCounts(clubs) : null;
  const toolCount = (id: string): string | null => {
    if (!counts) return null;
    if (id === "players") return `${counts.players} spelare`;
    if (id === "ratings") return `${counts.clubs} klubbar`;
    return null;
  };

  return (
    <>
      <DevPageHead
        eyebrow="Utveckling · HM_EDITOR_ENABLED"
        title="Dev-konsol"
        note="Interna verktyg för data, motorlabb och felsökning. Aldrig länkade från spelets navigation och otillgängliga i produktionsbyggen."
      />
      <div className="hm-dev-split hm-dev-split--8-4">
        <section className="hm-dev-panel" aria-labelledby="dev-tools-title">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title" id="dev-tools-title">Verktyg</span>
            <span className="hm-dev-muted">Tryck <span className="hm-dev-kbd">1</span>–<span className="hm-dev-kbd">{DEV_TOOLS.length}</span> för att öppna</span>
          </div>
          {GROUPS.map((group) => (
            <div key={group} className="hm-dev-tool-group">
              <div className="hm-dev-tool-group-label hm-dev-eyebrow">{DEV_TOOL_GROUP_LABEL[group]}</div>
              <ul className="hm-dev-tools">
                {DEV_TOOLS.filter((tool) => tool.group === group).map((tool) => {
                  const locked = hydrated && !enabled && NEEDS_EDITOR_MODE.has(tool.id);
                  return (
                    <li key={tool.id}>
                      <Link href={tool.href} className="hm-dev-tool" aria-keyshortcuts={tool.shortcut}>
                        <span className="hm-dev-kbd">{tool.shortcut}</span>
                        <span>
                          <span className="hm-dev-tool-name">{tool.label}</span>
                          <span className="hm-dev-tool-desc"> — {tool.description}</span>
                          {locked ? <span className="hm-dev-tool-desc hm-dev-warn"> Kräver Editor Mode (växla i DEV-bandet).</span> : null}
                        </span>
                        <span className="hm-dev-tool-count">{toolCount(tool.id) ?? tool.href}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="hm-dev-panel" aria-labelledby="dev-counts-title">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title" id="dev-counts-title">Verklig databas</span>
          </div>
          {error ? (
            <div className="hm-dev-panel-body"><div className="hm-dev-alert" role="alert">{error}</div></div>
          ) : (
            <div className="hm-dev-stats">
              <Stat label="Nationer" value={counts?.nations} />
              <Stat label="Tävlingar" value={counts?.competitions} />
              <Stat label="Klubbar" value={counts?.clubs} />
              <Stat label="Spelare" value={counts?.players} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="hm-dev-stat">
      <div className="hm-dev-eyebrow">{label}</div>
      <div className="hm-dev-stat-value">{value ?? "…"}</div>
    </div>
  );
}
