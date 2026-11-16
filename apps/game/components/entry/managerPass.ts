// Arena 231 -- ENT-03e B "Accreditation pass": the pass's flavour (portrait style, coaching-philosophy line) is
// presentation only. It never enters the career save (the save schema is protected) -- it is kept per device,
// keyed by save id, so later surfaces (MGR-01) can print the same pass. Missing/blocked storage = default pass.
export type PassPortrait = "MONOGRAM" | "SILHOUETTE" | "WHISTLE";
export const PASS_PORTRAITS: { value: PassPortrait; label: string }[] = [
  { value: "MONOGRAM", label: "Initialer" },
  { value: "SILHOUETTE", label: "Siluett" },
  { value: "WHISTLE", label: "Visselpipa" },
];
export const PASS_PHILOSOPHIES = ["Snabba omställningar", "6-0 och tålamod", "Egna produkter först", "Kontring på varje räddning", "Disciplin i försvaret", "Bredd före stjärnor"] as const;
export interface ManagerPassFlavour { portrait: PassPortrait; philosophy: string | null }
export const DEFAULT_PASS: ManagerPassFlavour = { portrait: "MONOGRAM", philosophy: null };

const KEY = "hm-manager-pass:v1";

function readAll(): Record<string, ManagerPassFlavour> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ManagerPassFlavour>) : {};
  } catch {
    return {};
  }
}

export function readManagerPass(saveId: string | null | undefined): ManagerPassFlavour {
  if (!saveId) return DEFAULT_PASS;
  const v = readAll()[saveId];
  const portrait = PASS_PORTRAITS.some((p) => p.value === v?.portrait) ? v!.portrait : DEFAULT_PASS.portrait;
  const philosophy = typeof v?.philosophy === "string" && v.philosophy.length <= 60 ? v.philosophy : null;
  return { portrait, philosophy };
}

/** Best effort: returns false when the browser does not allow storage (the pass then shows its default). */
export function writeManagerPass(saveId: string, flavour: ManagerPassFlavour): boolean {
  try {
    const all = readAll();
    all[saveId] = flavour;
    window.localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}
