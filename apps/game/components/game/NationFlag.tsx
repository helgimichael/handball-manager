// HM-PLAYTEST-01 5.2: national flags as inline SVG, keyed by the game's own
// three-letter nationality codes. No emoji (inconsistent across platforms)
// and no runtime downloads. Flags with a coat of arms or emblem (ESP, SRB,
// SVN, BIH, KOS, HRV) are drawn in their simplified civil form; that is
// noted in the title. Unknown codes render nothing rather than a guess.
import type { ReactNode } from "react";

const W = 30, H = 20;
const hBands = (colors: string[], weights = colors.map(() => 1)) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let y = 0;
  return colors.map((c, i) => { const h = (weights[i] / total) * H; const el = <rect key={i} x={0} y={y} width={W} height={h + 0.05} fill={c} />; y += h; return el; });
};
const vBands = (colors: string[]) => colors.map((c, i) => <rect key={i} x={(i * W) / colors.length} y={0} width={W / colors.length + 0.05} height={H} fill={c} />);
const nordic = (bg: string, outer: string, inner: string | null, x: [number, number], y: [number, number], ix?: [number, number], iy?: [number, number]) => (
  <>
    <rect width={W} height={H} fill={bg} />
    <rect x={x[0]} y={0} width={x[1] - x[0]} height={H} fill={outer} />
    <rect x={0} y={y[0]} width={W} height={y[1] - y[0]} fill={outer} />
    {inner && ix && iy && <><rect x={ix[0]} y={0} width={ix[1] - ix[0]} height={H} fill={inner} /><rect x={0} y={iy[0]} width={W} height={iy[1] - iy[0]} fill={inner} /></>}
  </>
);

const FLAGS: Record<string, { name: string; simplified?: boolean; art: ReactNode }> = {
  SWE: { name: "Sverige", art: nordic("#006AA7", "#FECC00", null, [9.4, 13.1], [8, 12]) },
  DEN: { name: "Danmark", art: nordic("#C8102E", "#FFFFFF", null, [9.7, 12.9], [8.6, 11.4]) },
  NOR: { name: "Norge", art: nordic("#BA0C2F", "#FFFFFF", "#00205B", [8.2, 13.6], [7.5, 12.5], [9.5, 12.3], [8.75, 11.25]) },
  ISL: { name: "Island", art: nordic("#02529C", "#FFFFFF", "#DC1E35", [8.4, 13.2], [7.8, 12.2], [9.6, 12], [8.9, 11.1]) },
  FIN: { name: "Finland", art: nordic("#FFFFFF", "#003580", null, [8.3, 13.3], [7.3, 12.7]) },
  FRO: { name: "Färöarna", art: nordic("#FFFFFF", "#0065BD", "#EF303E", [8.2, 13.6], [7.5, 12.5], [9.5, 12.3], [8.75, 11.25]) },
  GER: { name: "Tyskland", art: hBands(["#000000", "#DD0000", "#FFCE00"]) },
  HUN: { name: "Ungern", art: hBands(["#CD2A3E", "#FFFFFF", "#436F4D"]) },
  EST: { name: "Estland", art: hBands(["#0072CE", "#000000", "#FFFFFF"]) },
  POL: { name: "Polen", art: hBands(["#FFFFFF", "#DC143C"]) },
  NED: { name: "Nederländerna", art: hBands(["#AE1C28", "#FFFFFF", "#21468B"]) },
  AUT: { name: "Österrike", art: hBands(["#ED2939", "#FFFFFF", "#ED2939"]) },
  FRA: { name: "Frankrike", art: vBands(["#0055A4", "#FFFFFF", "#EF4135"]) },
  IRL: { name: "Irland", art: vBands(["#169B62", "#FFFFFF", "#FF883E"]) },
  ESP: { name: "Spanien", simplified: true, art: hBands(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]) },
  SRB: { name: "Serbien", simplified: true, art: hBands(["#C6363C", "#0C4076", "#FFFFFF"]) },
  SVN: { name: "Slovenien", simplified: true, art: hBands(["#FFFFFF", "#005CE5", "#ED1C24"]) },
  HRV: { name: "Kroatien", simplified: true, art: <>{hBands(["#FF0000", "#FFFFFF", "#171796"])}<g transform="translate(12.5 5.5)"><rect width={5} height={6} fill="#FFFFFF" stroke="#171796" strokeWidth={0.3} />{[0, 1, 2, 3, 4].flatMap((c) => [0, 1, 2, 3, 4, 5].filter((r) => (c + r) % 2 === 0).map((r) => <rect key={`${c}${r}`} x={c} y={r} width={1} height={1} fill="#FF0000" />))}</g></> },
  BIH: { name: "Bosnien och Hercegovina", simplified: true, art: <><rect width={W} height={H} fill="#002395" /><path d="M9 0h12v20z" fill="#FECB00" /></> },
  KOS: { name: "Kosovo", simplified: true, art: <><rect width={W} height={H} fill="#244AA5" />{[8, 11, 14, 17, 20, 23].map((x, i) => <circle key={x} cx={x - 0.5} cy={5.2 - Math.sin((i / 5) * Math.PI) * 1.4} r={0.8} fill="#FFFFFF" />)}<path d="M11 9l6-1 3 3-2 5-5 1-3-4z" fill="#D0A650" /></> },
  GBR: { name: "Storbritannien", simplified: true, art: <><rect width={W} height={H} fill="#012169" /><path d="M0 0l30 20M30 0L0 20" stroke="#FFFFFF" strokeWidth={4} /><path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth={1.4} /><path d="M15 0v20M0 10h30" stroke="#FFFFFF" strokeWidth={6} /><path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth={3.4} /></> },
  CHL: { name: "Chile", art: <><rect width={W} height={H} fill="#FFFFFF" /><rect y={10} width={W} height={10} fill="#D52B1E" /><rect width={10} height={10} fill="#0039A6" /><path d="M5 2.2l1.1 3.4h3.6l-2.9 2.1 1.1 3.4L5 9l-2.9 2.1 1.1-3.4L.3 5.6h3.6z" transform="translate(0 -0.6) scale(1)" fill="#FFFFFF" /></> },
};

export function nationName(code: string | null | undefined): string | null {
  return code ? FLAGS[code]?.name ?? null : null;
}

export function hasNationFlag(code: string | null | undefined): boolean {
  return !!code && code in FLAGS;
}

export function NationFlag({ code, label }: { code: string | null | undefined; label?: string }) {
  const flag = code ? FLAGS[code] : undefined;
  if (!flag) return null;
  const title = `${label ?? flag.name}${flag.simplified ? " (förenklad flagga)" : ""}`;
  return (
    <span className="hm-flag" role="img" aria-label={title} title={title}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">{flag.art}</svg>
    </span>
  );
}
