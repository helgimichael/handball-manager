"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { categoryLabel } from "@/lib/career/inboxBridge";
import { destinationLabel, resolveDestinationHref } from "@/lib/career/destinations";
import { filterInboxMessages, INBOX_FILTERS, type InboxFilterId } from "@/lib/career/inboxFilters";

export default function InboxPage() { return <Suspense><Inbox /></Suspense>; }
function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const { career, markInboxMessageRead, archiveInboxMessage, unarchiveInboxMessage } = useCareer();
  const [filter, setFilter] = useState<InboxFilterId>("ALL");

  const messages = useMemo(() => {
    return [...filterInboxMessages(career.inbox, filter)].reverse();
  }, [career.inbox, filter]);

  const [selectedId, setSelectedId] = useState(params.get("message") ?? "");
  const selected = messages.find((m) => m.id === selectedId);

  function selectMessage(id: string) {
    setSelectedId(id);
    markInboxMessageRead(id);
  }

  const canArchive = selected ? !(selected.actionRequired && !selected.resolved) : false;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, height: "100%" }}>
      <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">Inkorg</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{messages.length} meddelanden</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 10px", borderBottom: "1px solid var(--hm-border-subtle)" }}>
          {INBOX_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="hm-btn hm-btn-sm"
              style={{
                fontSize: "var(--hm-text-2xs)",
                padding: "3px 8px",
                background: filter === f.id ? "var(--hm-accent)" : undefined,
                borderColor: filter === f.id ? "var(--hm-accent)" : undefined,
                color: filter === f.id ? "#fff" : undefined,
              }}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ overflowY: "auto" }}>
          {messages.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Inga meddelanden i denna vy.</div>
          ) : (
            messages.map((m) => (
              <button
                type="button"
                aria-label={m.subject}
                key={m.id}
                onClick={() => selectMessage(m.id)}
                data-active={m.id === selected?.id}
                className="hm-nav-item"
                style={{
                  width: "100%", background: "transparent", border: 0, color: "inherit",
                  borderRadius: 0,
                  borderLeft: "2px solid transparent",
                  display: "block",
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
                  <span className="hm-text-muted">
                    {categoryLabel(m.category)}
                    {m.careerEventId ? " · Karriär" : ""}
                  </span>
                  <span className="hm-text-muted">{m.date ? new Date(m.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" }) : ""}</span>
                </div>
                <div style={{ fontWeight: m.read ? 500 : 700, fontSize: "var(--hm-text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
                  {!m.read ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--hm-accent)", display: "inline-block", flexShrink: 0 }} /> : null}
                  {m.subject}
                  {m.actionRequired && !m.resolved ? <span className="hm-badge hm-badge-warning" style={{ marginLeft: "auto" }}>ÅTGÄRD</span> : null}
                  {m.archived ? <span className="hm-badge hm-badge-neutral" style={{ marginLeft: "auto" }}>ARKIVERAT</span> : null}
                </div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.preview}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="hm-panel">
        {selected ? (
          <>
            <div className="hm-panel-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--hm-text-sm)" }}>{selected.subject}</div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  {selected.sender} · {categoryLabel(selected.category)}
                  {selected.date ? ` · ${new Date(selected.date).toLocaleDateString("sv-SE")}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {selected.actionRequired && !selected.resolved ? <span className="hm-badge hm-badge-warning">ÅTGÄRD KRÄVS</span> : selected.important ? <span className="hm-badge hm-badge-warning">VIKTIGT</span> : null}
              </div>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.body.map((paragraph, i) => (
                <p key={i} style={{ margin: 0, fontSize: "var(--hm-text-sm)", color: "var(--hm-text-secondary)", lineHeight: 1.6 }}>
                  {paragraph}
                </p>
              ))}
            </div>
            {selected.destinations && selected.destinations.length > 0 ? (
              <div className="hm-panel-body" style={{ display: "flex", gap: 8, paddingTop: 0, flexWrap: "wrap" }}>
                {selected.destinations.map((destination, i) => {
                  const href = resolveDestinationHref(destination);
                  if (!href) {
                    return null; // Reserved destination with no live screen yet -- never render a dead button.
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      className={i === 0 ? "hm-btn hm-btn-sm hm-btn-primary" : "hm-btn hm-btn-sm"}
                      onClick={() => router.push(href)}
                    >
                      {destinationLabel(destination)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="hm-panel-body" style={{ display: "flex", gap: 8, paddingTop: 0 }}>
              {!selected.read && <button className="hm-btn hm-btn-sm" onClick={() => markInboxMessageRead(selected.id)}>Markera som l?st</button>}
              {selected.archived ? (
                <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => unarchiveInboxMessage(selected.id)}>
                  Återställ från arkiv
                </button>
              ) : (
                <button
                  type="button"
                  className="hm-btn hm-btn-sm hm-btn-ghost"
                  disabled={!canArchive}
                  title={canArchive ? undefined : "Kan inte arkiveras förrän den obligatoriska åtgärden är genomförd."}
                  onClick={() => archiveInboxMessage(selected.id)}
                >
                  Arkivera
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="hm-empty">{messages.length ? 'Välj ett meddelande för att öppna ärendet och dess relevanta åtgärder.' : 'Inga meddelanden i denna vy.'}</div>
        )}
      </div>
    </div>
  );
}
