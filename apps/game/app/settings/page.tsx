"use client";
// Arena 231 -- ENT-05 A: the main-menu settings use the same unified panel as /career/settings (SYS-01).
import Link from "next/link";
import { UnifiedSettings } from "@/components/settings/UnifiedSettings";
import { EntryDataSection } from "@/components/settings/DataSections";

export default function SettingsEntryPage() {
  return (
    <main className="hm-settings-entry hm-us-page">
      <header><span className="hm-eyebrow">Handball Manager</span><h1>Inställningar</h1><p>Gäller den här enheten och alla dina karriärer.</p><Link className="hm-btn" href="/">← Huvudmeny</Link></header>
      <UnifiedSettings scope="entry" data={<EntryDataSection />} />
    </main>
  );
}
