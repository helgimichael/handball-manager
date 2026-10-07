import type { Metadata } from "next";
import "./globals.css";
import { EditorModeWidget } from "./EditorModeWidget";

export const metadata: Metadata = {
  title: "Handball Manager",
  description: "Led din handbollsklubb. Bygg truppen, följ världen och forma klubbens nästa säsong.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        {children}
        <EditorModeWidget />
      </body>
    </html>
  );
}
