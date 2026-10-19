import { HostNavigation } from "./app-shell/HostNavigation";
import type { Metadata } from "next";
import "./globals.css";
import { EditorModeWidget } from "./EditorModeWidget";
import { AlphaAccessGate } from "../components/AlphaAccessGate";
import { AlphaFeedbackControl } from "../components/FeedbackModal";

export const metadata: Metadata = {
  title: "Handball Manager",
  description: "Led din handbollsklubb. Bygg truppen, följ världen och forma klubbens nästa säsong.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <AlphaAccessGate>
          {children}
          <EditorModeWidget />
          <HostNavigation />
          <AlphaFeedbackControl />
        </AlphaAccessGate>
      </body>
    </html>
  );
}
