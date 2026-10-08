import Link from 'next/link';
import type { ReactNode } from 'react';

/** Entry scenes share the game's chrome; career state still belongs to its existing flows. */
export default function CareerEntryFrame({ label, rail, context, footer, children }: {
  label: string;
  rail: ReactNode;
  context: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return <main className="career-entry" aria-labelledby="career-entry-heading">
    <header className="career-entry-top">
      <Link className="career-entry-brand" href="/" aria-label="Handball Manager · huvudmenyn"><span>HM</span><strong>HANDBALL<br />MANAGER</strong></Link>
      <div className="career-entry-top-context"><span>{label}</span><small>Sju positioner. Ett lag. Din karriär.</small></div>
      <Link className="career-entry-menu" href="/">Huvudmenyn →</Link>
    </header>
    <div className="career-entry-layout">
      <aside className="career-entry-journey">{rail}<svg className="career-entry-court" viewBox="0 0 250 380" fill="none" aria-hidden="true"><rect x="12" y="12" width="226" height="356" stroke="currentColor" /><path d="M12 190h226M35 12a90 90 0 0 0 180 0M35 368a90 90 0 0 1 180 0" stroke="currentColor" /><circle cx="125" cy="190" r="33" stroke="currentColor" /></svg></aside>
      <section className="career-entry-workspace">{children}<footer className="career-entry-footer">{footer}</footer></section>
      <aside className="career-entry-context">{context}</aside>
    </div>
  </main>;
}
