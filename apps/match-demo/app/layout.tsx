import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match demo — Handball Manager",
  description: "HM-0.2E first live SIM -> FIELD bridge. Not the Handball Manager desktop app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
