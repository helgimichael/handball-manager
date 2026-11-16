"use client";

// Arena Nights SYS-03 (A): the engine V2 lab list, shown at the top of every lab so the
// three labs read as one family inside the dev console.
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABS = [
  { href: "/scenario-lab", label: "Mittkast", note: "Kontrollerad baslinje: mittkast fram till mottagning, 50 ms-snapshots." },
  { href: "/scenario-lab/core", label: "Anfall & omställning", note: "Enskilda anfall eller sex utfall i följd, kontakter och byten." },
  { href: "/scenario-lab/match", label: "Helmatch", note: "2 × 30 min med tidslinje, förgreningar och exakt återupptagning." },
] as const;

export function LabList() {
  const pathname = usePathname();
  return (
    <nav className="lab-list" aria-label="Motorlabb">
      {LABS.map((lab) => (
        <Link key={lab.href} href={lab.href} className="lab-list-item" aria-current={pathname === lab.href ? "page" : undefined}>
          <span className="lab-list-name">{lab.label}</span>
          <span className="lab-list-note">{lab.note}</span>
        </Link>
      ))}
    </nav>
  );
}
