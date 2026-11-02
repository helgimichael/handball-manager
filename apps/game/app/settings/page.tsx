"use client";
import Link from "next/link";
import { GlobalPreferences } from "@/components/settings/GlobalPreferences";

export default function SettingsEntryPage() {
  return (
    <main className="hm-settings-entry">
      <header><span className="hm-eyebrow">Handball Manager</span><h1>Inställningar</h1><p>Gäller den här enheten och alla dina karriärer.</p><Link className="hm-btn" href="/">← Huvudmeny</Link></header>
      <GlobalPreferences />
    </main>
  );
}
