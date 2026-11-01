// HM-ALPHA2-05E: the Negotiation Room's atmospheric backdrop -- a handball
// goal area drawn as line art (6 m arc, dashed 9 m free-throw arc, the
// goal, the 7 m mark) fading off the right edge of a navy band. Pure SVG,
// a few hundred bytes, scales to any band height; reusable for any
// "management room" hero. Decorative only (aria-hidden).
export function CourtBackdrop({ accent = "var(--hm-accent)" }: { accent?: string }) {
  return (
    <svg className="tc-backdrop" viewBox="0 0 1200 300" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tc-court-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f8f3e9" stopOpacity="0" />
          <stop offset=".55" stopColor="#f8f3e9" stopOpacity=".09" />
          <stop offset="1" stopColor="#f8f3e9" stopOpacity=".2" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#tc-court-fade)" strokeWidth="2">
        {/* goal line */}
        <line x1="1180" y1="-20" x2="1180" y2="320" />
        {/* 6 m goal area: quarter circles joined by a straight segment */}
        <path d="M1180 -10 A170 170 0 0 0 1010 130 L1010 170 A170 170 0 0 0 1180 310" />
        {/* 9 m free-throw line, dashed */}
        <path d="M1180 -95 A255 255 0 0 0 925 130 L925 170 A255 255 0 0 0 1180 395" strokeDasharray="14 12" />
        {/* 7 m mark */}
        <line x1="982" y1="138" x2="982" y2="162" strokeWidth="3" />
        {/* centre-line hint at the far left of the fade */}
        <line x1="640" y1="-20" x2="640" y2="320" strokeOpacity=".5" />
      </g>
      {/* the 4 m goalkeeper restraining line, in the signal colour */}
      <line x1="1112" y1="142" x2="1112" y2="158" stroke={accent} strokeOpacity=".45" strokeWidth="3" />
    </svg>
  );
}
