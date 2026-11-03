import type { ReactNode } from 'react';
import { ENVIRONMENTS, type EnvironmentId } from '@/components/clubhq/environments';
import './secondary.css';

function inferSceneEnvironment(title: string, eyebrow: string): EnvironmentId {
  const hay = `${title} ${eyebrow}`.toLowerCase();
  if (hay.includes('medicinsk') || hay.includes('fysio') || hay.includes('rehab') || hay.includes('skad')) return 'medical-room';
  if (hay.includes('rekryter') || hay.includes('scout') || hay.includes('övergång') || hay.includes('marknad') || hay.includes('bevaka')) return 'scouting-office';
  if (hay.includes('träning') || hay.includes('försäsong') || hay.includes('fysik')) return 'training-hall';
  if (hay.includes('media') || hay.includes('press')) return 'press-room';
  if (hay.includes('ekonomi') || hay.includes('styrelse') || hay.includes('budget') || hay.includes('historik') || hay.includes('trof')) return 'boardroom';
  if (hay.includes('analys') || hay.includes('taktik') || hay.includes('personal') || hay.includes('tränar') || hay.includes('assisterande') || hay.includes('målvaktstränare')) return 'tactical-room';
  if (hay.includes('trupp') || hay.includes('omklädning')) return 'dressing-room';
  if (hay.includes('match') || hay.includes('live')) return 'arena-matchday';
  if (hay.includes('tabell') || hay.includes('tävling') || hay.includes('serie') || hay.includes('schema') || hay.includes('kalender')) return 'arena-club';
  return 'manager-office';
}

export function SectionScene({
  eyebrow,
  title,
  description,
  mark,
  actions,
  environment,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  mark?: ReactNode;
  actions?: ReactNode;
  environment?: EnvironmentId;
  children?: ReactNode;
}) {
  const envId = environment ?? inferSceneEnvironment(title, eyebrow);
  const env = ENVIRONMENTS[envId] ?? ENVIRONMENTS['arena-club'];
  return (
    <header className="game-section-scene" style={env.backdropStyle} data-environment={env.id}>
      {mark && <div className="game-section-mark">{mark}</div>}
      <div className="game-scene-heading">
        <div className="game-scene-meta-row">
          <span className="game-overline">{eyebrow}</span>
          <span className="game-scene-env-pill">{env.department}</span>
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {actions && <div className="hm-actions">{actions}</div>}
      </div>
      {children && <div className="game-section-context">{children}</div>}
    </header>
  );
}
export function SceneEmpty({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="game-scene-empty"><span className="game-empty-court" aria-hidden="true"><svg viewBox="0 0 180 110" fill="none"><path d="M8 8h164v94H8zM90 8v94M8 35h6v40H8m164-40h-6v40h6M8 20c42 0 42 70 0 70m164-70c-42 0-42 70 0 70" stroke="currentColor" strokeWidth="2"/><circle cx="90" cy="55" r="13" stroke="currentColor" strokeWidth="2"/></svg></span><div><h2>{title}</h2><p>{children}</p>{actions && <div className="hm-actions">{actions}</div>}</div></section>;
}
export function StaffMark({ name, size = 62 }: { name: string; size?: number }) {
  return <span className="game-staff-mark" style={{ width: size, height: size }} aria-hidden="true">{name.split(/\s+/).filter(Boolean).map(n => n[0]).slice(0,2).join('')}</span>;
}
