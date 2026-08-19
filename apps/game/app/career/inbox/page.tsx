"use client";

import { useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";

export default function InboxPage() {
  const { career } = useCareer();
  const messages = [...career.inbox].reverse();
  const [selectedId, setSelectedId] = useState(messages[0]?.id ?? "");
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, height: "100%" }}>
      <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">Inkorg</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{messages.length} meddelanden</span>
        </div>
        <div style={{ overflowY: "auto" }}>
          {messages.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Inga meddelanden ännu. Fortsätt för att komma igång med säsongen.</div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                data-active={m.id === selected?.id}
                className="hm-nav-item"
                style={{
                  borderRadius: 0,
                  borderLeft: "2px solid transparent",
                  display: "block",
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
                  <span className="hm-text-muted">{m.category}</span>
                  <span className="hm-text-muted">{m.date ? new Date(m.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" }) : ""}</span>
                </div>
                <div style={{ fontWeight: m.read ? 500 : 700, fontSize: "var(--hm-text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
                  {!m.read ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--hm-accent)", display: "inline-block" }} /> : null}
                  {m.subject}
                </div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.preview}
                </div>
              </div>
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
                  {selected.sender} · {selected.category}
                  {selected.date ? ` · ${new Date(selected.date).toLocaleDateString("sv-SE")}` : ""}
                </div>
              </div>
              {selected.important ? <span className="hm-badge hm-badge-warning">VIKTIGT</span> : null}
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.body.map((paragraph, i) => (
                <p key={i} style={{ margin: 0, fontSize: "var(--hm-text-sm)", color: "var(--hm-text-secondary)", lineHeight: 1.6 }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        ) : (
          <div className="hm-panel-body hm-text-muted">Inga meddelanden.</div>
        )}
      </div>
    </div>
  );
}
