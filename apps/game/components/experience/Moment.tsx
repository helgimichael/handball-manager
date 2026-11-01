// HM-ALPHA3-M01: Moments -- how the game marks a significant career event.
//
// Three building blocks, used together or alone:
// - <MomentHero>: the cinematic header (photo, court line art or plain
//   navy) with tags, a display headline, a lede, an optional stamp and a
//   slot for a route line or stats.
// - <Moment>: hero + body sections + next steps, as one full-width
//   ceremony page (Deal Completion's layout, generalised).
// - <EventCard> / <DecisionCard>: the same event as a card inside a feed
//   or dashboard, and an important choice with its consequence.
// MOMENT_PRESETS gives each kind of event a default tone, tag and stamp so
// future milestones start consistent, but every field can be overridden --
// nothing forces an event into one presentation.
import type { CSSProperties, ReactNode } from "react";
import { CourtBackdrop } from "./CourtBackdrop";
import { Stamp, Tag } from "./primitives";
import type { ExperienceTone } from "./visuals";

export type MomentKind =
  | "SIGNING"
  | "STAFF_APPOINTMENT"
  | "PROMOTION"
  | "RELEGATION"
  | "CHAMPIONSHIP"
  | "ANNOUNCEMENT"
  | "DISMISSAL"
  | "SEASON_ACHIEVEMENT";

export interface MomentPreset { tone: ExperienceTone; tag: string; stamp?: string }

export const MOMENT_PRESETS: Readonly<Record<MomentKind, MomentPreset>> = {
  SIGNING: { tone: "success", tag: "Övergång genomförd", stamp: "Klar" },
  STAFF_APPOINTMENT: { tone: "success", tag: "Ny i staben", stamp: "Anställd" },
  PROMOTION: { tone: "gold", tag: "Uppflyttning", stamp: "Uppflyttade" },
  RELEGATION: { tone: "loss", tag: "Nedflyttning" },
  CHAMPIONSHIP: { tone: "gold", tag: "Mästare", stamp: "Guld" },
  ANNOUNCEMENT: { tone: "signal", tag: "Klubbesked" },
  DISMISSAL: { tone: "loss", tag: "Styrelsens besked", stamp: "Avsatt" },
  SEASON_ACHIEVEMENT: { tone: "gold", tag: "Säsongens prestation" },
};

export type MomentBackdrop = { kind: "photo"; style: CSSProperties } | { kind: "court" } | { kind: "plain" };

export function MomentHero({
  kind,
  tone,
  tags,
  headline,
  lede,
  stamp,
  backdrop = { kind: "court" },
  size,
  headingLevel = 1,
  children,
  aside,
}: {
  kind?: MomentKind;
  tone?: ExperienceTone;
  /** Extra tags after the preset tag (dates, competition names). Pass `false` as the first item to drop the preset tag. */
  tags?: readonly (ReactNode | false)[];
  headline: ReactNode;
  lede?: ReactNode;
  /** Overrides the preset stamp; `null` hides it. */
  stamp?: ReactNode | null;
  backdrop?: MomentBackdrop;
  size?: "compact";
  headingLevel?: 1 | 2;
  /** Below the lede: a RouteLine, stats, crests. */
  children?: ReactNode;
  /** Right-hand side instead of the stamp: steps, a clock, figures. */
  aside?: ReactNode;
}) {
  const preset = kind ? MOMENT_PRESETS[kind] : undefined;
  const resolvedTone = tone ?? preset?.tone;
  const stampText = stamp === null ? null : stamp ?? preset?.stamp;
  const dropPresetTag = tags?.[0] === false;
  const tagItems = [...(preset && !dropPresetTag ? [<Tag key="preset" tone={resolvedTone}>{preset.tag}</Tag>] : []), ...(tags ?? []).filter((t) => t !== false).map((t, i) => <span key={i}>{t}</span>)];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={backdrop.kind === "photo" ? "xp-moment-hero xp-photo-hero" : "xp-moment-hero"} data-tone={resolvedTone} data-size={size} style={backdrop.kind === "photo" ? backdrop.style : undefined}>
      {backdrop.kind === "court" && <CourtBackdrop />}
      <div className="xp-moment-copy xp-reveal">
        {tagItems.length > 0 && <div className="xp-tags">{tagItems}</div>}
        <Heading>{headline}</Heading>
        {lede && <p>{lede}</p>}
        {children}
      </div>
      {aside ?? (stampText ? <Stamp tone={resolvedTone}>{stampText}</Stamp> : null)}
    </header>
  );
}

/** A full ceremony: hero, then one or more body sections side by side, then next steps. */
export function Moment({ hero, children, next, label, tone }: { hero: ReactNode; children?: ReactNode; next?: ReactNode; label: string; tone?: ExperienceTone }) {
  return (
    <section className="xp-moment" data-tone={tone} aria-label={label} aria-live="polite">
      {hero}
      {children && <div className="xp-moment-body">{children}</div>}
      {next && <nav className="xp-moment-next" aria-label="Nästa steg">{next}</nav>}
    </section>
  );
}

/** The same event as a card in a feed, dashboard or inbox. */
export function EventCard({ kind, tone, eyebrow, title, children, media, footer, headingLevel = 3 }: { kind?: MomentKind; tone?: ExperienceTone; eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; media?: ReactNode; footer?: ReactNode; headingLevel?: 2 | 3 }) {
  const preset = kind ? MOMENT_PRESETS[kind] : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="xp-event-card" data-tone={tone ?? preset?.tone} data-media={media ? undefined : "none"}>
      {media && <div>{media}</div>}
      <div>
        <span className="xp-eyebrow">{eyebrow ?? preset?.tag}</span>
        <Heading>{title}</Heading>
        {children && <p>{children}</p>}
      </div>
      {footer && <footer>{footer}</footer>}
    </article>
  );
}

/** An important decision: one clear primary action with its consequence on the second line, then quieter alternatives. */
export function DecisionCard({ tone, title, children, primary, secondary, status }: { tone?: ExperienceTone; title: ReactNode; children?: ReactNode; primary?: { label: ReactNode; consequence?: ReactNode; onSelect: () => void; disabled?: boolean }; secondary?: ReactNode; status?: ReactNode }) {
  return (
    <section className="xp-decision" data-tone={tone} aria-label={typeof title === "string" ? title : undefined}>
      <header><h3>{title}</h3>{status}</header>
      {children && <p>{children}</p>}
      {primary && (
        <button type="button" className="xp-decision-primary" onClick={primary.onSelect} disabled={primary.disabled}>
          <strong>{primary.label}</strong>
          {primary.consequence && <span>{primary.consequence}</span>}
        </button>
      )}
      {secondary && <div className="xp-decision-actions">{secondary}</div>}
    </section>
  );
}
