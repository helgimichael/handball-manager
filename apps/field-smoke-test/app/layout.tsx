import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FIELD smoke test — Handball Manager",
  description: "Verification harness for the migrated match-renderer package. Not the Handball Manager desktop app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
