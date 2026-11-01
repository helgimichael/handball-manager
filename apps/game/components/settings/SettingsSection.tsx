// HM-ALPHA3-M01: one block on the Settings page. Future preferences (sound,
// match speed, notifications …) add a section; nothing else changes.
import type { ReactNode } from "react";

export function SettingsSection({ id, eyebrow, title, description, children, aside }: { id: string; eyebrow?: string; title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="hm-settings-section" aria-labelledby={`${id}-title`}>
      <header className="hm-settings-section-head">
        <div>
          {eyebrow && <span className="xp-eyebrow">{eyebrow}</span>}
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {aside}
      </header>
      <div className="hm-settings-section-body">{children}</div>
    </section>
  );
}
