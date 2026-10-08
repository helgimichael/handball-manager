import type { ReactNode } from 'react';
import './secondary.css';

export function SectionScene({ eyebrow, title, description, mark, actions, children }: { eyebrow: string; title: string; description?: string; mark?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return <header className="game-section-scene">{mark && <div className="game-section-mark">{mark}</div>}<div className="game-scene-heading"><span className="game-overline">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}{actions && <div className="hm-actions">{actions}</div>}</div>{children && <div className="game-section-context">{children}</div>}</header>;
}
export function SceneEmpty({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="game-scene-empty"><span className="game-empty-court" aria-hidden="true"><svg viewBox="0 0 180 110" fill="none"><path d="M8 8h164v94H8zM90 8v94M8 35h6v40H8m164-40h-6v40h6M8 20c42 0 42 70 0 70m164-70c-42 0-42 70 0 70" stroke="currentColor" strokeWidth="2"/><circle cx="90" cy="55" r="13" stroke="currentColor" strokeWidth="2"/></svg></span><div><h2>{title}</h2><p>{children}</p>{actions && <div className="hm-actions">{actions}</div>}</div></section>;
}
export function StaffMark({ name, size = 62 }: { name: string; size?: number }) {
  return <span className="game-staff-mark" style={{ width: size, height: size }} aria-hidden="true">{name.split(/\s+/).filter(Boolean).map(n => n[0]).slice(0,2).join('')}</span>;
}
