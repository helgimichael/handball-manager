import type { Metadata } from "next";
import "./globals.css";
import { EditorModeWidget } from "./EditorModeWidget";

export const metadata: Metadata = {
  title: "Handball Manager",
  description: "Handball Manager — career mode vertical slice.",
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
