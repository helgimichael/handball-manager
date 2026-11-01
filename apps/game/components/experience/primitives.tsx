// HM-ALPHA3-M01: the reusable presentation primitives behind every career
// Moment. Each one is small and composable; none assumes a particular
// event. Styling: experience.css (xp- classes). Motion is opt-in, single
// and always disabled under prefers-reduced-motion.
import type { CSSProperties, ReactNode } from "react";
import type { ExperienceTone } from "./visuals";

/** A rotated ceremony stamp ("KLAR", "MÄSTARE", "UPPFLYTTADE"). Decorative: the same words must exist in the page's text. */
export function Stamp({ children, tone, size, surface, animate = true }: { children: ReactNode; tone?: ExperienceTone; size?: "sm"; surface?: "paper"; animate?: boolean }) {
  return <span className="xp-stamp" data-tone={tone} data-size={size} data-surface={surface} data-animate={animate} aria-hidden="true">{children}</span>;
}

export function Tag({ children, tone }: { children: ReactNode; tone?: ExperienceTone }) {
  return <span className="xp-tag" data-tone={tone}>{children}</span>;
}

export type StepState = "todo" | "current" | "done" | "failed";
export interface Step { label: string; state: StepState; detail?: string }

/** Ordered progress through a multi-stage process (negotiation, appointment, season). `className` lets an existing system keep its own skin with identical markup. */
export function ProgressSteps({ steps, label, surface, className = "xp-steps" }: { steps: readonly Step[]; label: string; surface?: "paper"; className?: string }) {
  return (
    <ol className={className} data-surface={surface} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.label} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <i aria-hidden="true">{step.state === "done" ? "✓" : step.state === "failed" ? "✕" : index + 1}</i>
          <span>{step.label}</span>
          <small>{step.detail ?? (step.state === "current" ? "Pågår" : step.state === "failed" ? "Stängd" : "")}</small>
        </li>
      ))}
    </ol>
  );
}

/** Crest → subject → crest. Items are rendered in order with an arrow between each; `caption` reads the route in words. */
export function RouteLine({ items, caption }: { items: readonly ReactNode[]; caption?: ReactNode }) {
  return (
    <div className="xp-route">
      {items.map((item, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="xp-route-arrow" aria-hidden="true" />}
          {item}
        </span>
      ))}
      {caption && <span className="xp-route-caption">{caption}</span>}
    </div>
  );
}

export interface FlowPart { label: ReactNode; detail?: ReactNode; value: number; display: ReactNode; color: string }

/** One stacked bar plus legend and total: who receives each part of a whole. Values are only used for proportions; `display` is what the reader sees (already formatted). */
export function ValueFlow({ parts, total, totalLabel = "Totalt", label }: { parts: readonly FlowPart[]; total?: ReactNode; totalLabel?: string; label: string }) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="xp-flow" role="img" aria-label={label}>
        {parts.map((p, i) => <i key={i} style={{ flexGrow: Math.max(p.value, sum * 0.02), background: p.color }} />)}
      </div>
      <ul className="xp-flow-legend">
        {parts.map((p, i) => <li key={i} style={{ ["--xp-swatch" as string]: p.color } as CSSProperties}><span>{p.label}{p.detail && <> <em>{p.detail}</em></>}</span><b>{p.display}</b></li>)}
      </ul>
      {total !== undefined && <div className="xp-flow-total"><span>{totalLabel}</span><strong>{total}</strong></div>}
    </div>
  );
}

/** A thin progress meter with a label row. `value` is 0..1. */
export function MeterBar({ value, label, figure, tone }: { value: number; label: ReactNode; figure?: ReactNode; tone?: ExperienceTone }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="xp-meter" data-tone={tone}>
      <div className="xp-meter-label"><span>{label}</span>{figure !== undefined && <b>{figure}</b>}</div>
      <div className="xp-meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={typeof label === "string" ? label : undefined}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** A figure with its label, for navy bands and hero sides. */
export function Stat({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return <div className="xp-stat"><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div>;
}

/** Children enter once, staggered (≤ 240 ms total), and simply appear under reduced motion. */
export function Reveal({ children, as: Tag = "div", className }: { children: ReactNode; as?: "div" | "section" | "header"; className?: string }) {
  return <Tag className={className ? `xp-reveal ${className}` : "xp-reveal"}>{children}</Tag>;
}
