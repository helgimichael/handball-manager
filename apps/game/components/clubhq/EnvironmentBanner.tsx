import type { ReactNode } from "react";
import Link from "next/link";
import { ENVIRONMENTS, type EnvironmentId } from "./environments";

export interface EnvironmentMetric {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "positive" | "warning" | "negative" | "signal";
}

export interface EnvironmentBannerProps {
  environment: EnvironmentId;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  metrics?: EnvironmentMetric[];
  actions?: ReactNode;
  showClubhouseLink?: boolean;
  compact?: boolean;
}

export function EnvironmentBanner({
  environment,
  eyebrow,
  title,
  subtitle,
  badge,
  metrics,
  actions,
  showClubhouseLink = true,
  compact = false,
}: EnvironmentBannerProps) {
  const spec = ENVIRONMENTS[environment];

  return (
    <section
      className="hm-env-banner xp-photo-hero"
      data-environment={environment}
      data-compact={compact ? "true" : undefined}
      style={spec.backdropStyle}
      aria-label={title}
    >
      <div className="hm-env-banner-main">
        <div className="hm-env-banner-top">
          <span className="hm-env-banner-kicker">
            <i className="hm-env-banner-dot" aria-hidden="true" />
            {eyebrow ?? spec.department}
          </span>
          {badge && <span className="hm-env-banner-badge">{badge}</span>}
          {showClubhouseLink && (
            <Link href="/career/klubbhuset" className="hm-env-banner-back">
              ← Klubbhuset
            </Link>
          )}
        </div>
        <h2 className="hm-env-banner-title">{title}</h2>
        {subtitle && <p className="hm-env-banner-sub">{subtitle}</p>}
        {actions && <div className="hm-env-banner-actions">{actions}</div>}
      </div>

      {metrics && metrics.length > 0 && (
        <dl className="hm-env-banner-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="hm-env-banner-metric" data-tone={m.tone ?? "default"}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
              {m.sub && <small>{m.sub}</small>}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

