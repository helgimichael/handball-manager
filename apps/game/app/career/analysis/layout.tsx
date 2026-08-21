"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/career/analysis", label: "Overview" },
  { href: "/career/analysis/opponent", label: "Opponent" },
  { href: "/career/analysis/our-team", label: "Our Team" },
  { href: "/career/analysis/last-match", label: "Last Match" },
];

export default function AnalysisLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="hm-grid" style={{ gap: 10 }}>
      <div className="hm-panel" style={{ padding: "4px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <button
                key={tab.href}
                type="button"
                className="hm-btn hm-btn-sm"
                style={{
                  flex: 1,
                  background: active ? "var(--hm-accent)" : undefined,
                  borderColor: active ? "var(--hm-accent)" : undefined,
                  color: active ? "#fff" : undefined,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: "var(--hm-text-2xs)",
                }}
                onClick={() => router.push(tab.href)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
