export type NavIconName =
  | "home"
  | "inbox"
  | "squad"
  | "tactics"
  | "training"
  | "schedule"
  | "matches"
  | "scouting"
  | "recruitment"
  | "transfers"
  | "staff"
  | "club"
  | "competitions"
  | "analysis"
  | "editor"
  | "medical"
  | "settings"
  | "finance"
  | "board"
  | "manager"
  | "media"
  | "hq";

const PATHS: Record<NavIconName, string> = {
  home: "M2 7L8 2l6 5v6.5a.5.5 0 0 1-.5.5H10v-4H6v4H2.5a.5.5 0 0 1-.5-.5V7z",
  inbox: "M1.5 3.5h11v8h-11z M1.5 3.5l5.5 4 5.5-4",
  squad: "M4.5 4a1.8 1.8 0 1 1 0 3.6A1.8 1.8 0 0 1 4.5 4zM9.5 4a1.8 1.8 0 1 1 0 3.6A1.8 1.8 0 0 1 9.5 4zM1 12c.3-2 1.8-3.2 3.5-3.2S7.7 10 8 12M6.5 12c.3-2 1.8-3.2 3.5-3.2S13.7 10 14 12",
  tactics: "M2 2h10v9H2z M2 6.5h10 M7 2v9",
  training: "M2 8h1.5v-2h1v4h-1v-2H2zM11.5 8H13v2h-1v-4h1v2h-1.5zM4.5 8h5",
  schedule: "M2 3h10v9H2z M2 6h10 M4.5 1.5v3 M9.5 1.5v3",
  matches: "M8 1.5l1.6 3.3 3.6.5-2.6 2.6.6 3.6L8 9.8l-3.2 1.7.6-3.6-2.6-2.6 3.6-.5z",
  scouting: "M6.2 6.2a3 3 0 1 1 0 0zM10 10l3 3",
  recruitment: "M2.5 2h6l3 3v9h-9z M8.5 2v3h3 M6 8l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z",
  transfers: "M2 5.5h8l-2-2 M14 5.5l0 0 M14 9.5H6l2 2 M2 9.5l0 0",
  staff: "M8 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 13c.5-3 2.3-4.5 5-4.5S12.5 10 13 13",
  club: "M8 1.5 13.5 4v4.5c0 3.5-2.4 5.7-5.5 6.5-3.1-.8-5.5-3-5.5-6.5V4z",
  competitions: "M4 2h8v2.5A3.5 3.5 0 0 1 8.5 8h-1A3.5 3.5 0 0 1 4 4.5zM2.5 2.5h1.5v2h-1a1 1 0 0 1-1-1zM13.5 2.5H12v2h1a1 1 0 0 0 1-1zM8 8v2.5M6 13.5h4v-1.2c0-.7-.5-1.3-1.2-1.3H7.2c-.7 0-1.2.6-1.2 1.3z",
  analysis: "M2 13.5V8.5 M6 13.5V5 M10 13.5V9.5 M14 13.5V3",
  editor: "M10.5 2.5l3 3-8 8H2.5v-3zM9 4l3 3",
  medical: "M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z",
  // three sliders: the preference controls
  settings: "M2 4h12 M2 8h12 M2 12h12 M5 2.5v3 M10.5 6.5v3 M7 10.5v3",
  // a ledger: rising bars on a baseline
  finance: "M2 13.5h12 M4 12V8.5 M7 12V5.5 M10 12V7 M13 12V3",
  // a boardroom table seen from above, chairs on both sides
  board: "M3 6h10v4H3z M4.5 4v1.2 M8 4v1.2 M11.5 4v1.2 M4.5 10.8V12 M8 10.8V12 M11.5 10.8V12",
  // a briefcase: the manager's own career
  manager: "M2 5.5h12v7.5H2z M6 5.5V3.5h4v2 M2 9h12",
  // a folded newspaper
  media: "M2.5 3h9v10h-8a1 1 0 0 1-1-1z M11.5 6h2v6a1 1 0 0 1-2 0 M4.5 5.5h5 M4.5 8h5 M4.5 10.5h3",
  // the club building: a hall with a pitched entrance and a flag
  hq: "M1.5 13.5h13 M2.5 13.5V7h11v6.5 M6.5 13.5v-3h3v3 M2.5 7l5.5-3 5.5 3 M12 4V1.5l2 .8-2 .8",
};

export default function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
