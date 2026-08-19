import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";
import styles from "./DesignSystem.module.css";

function joinClassNames(
  ...classNames: Array<string | undefined>
) {
  return classNames.filter(Boolean).join(" ");
}

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "subtle" | "elevated";
};

export function Panel({
  variant = "default",
  className,
  ...props
}: PanelProps) {
  return (
    <div
      className={joinClassNames(
        styles.panel,
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  eyebrow,
  subtitle,
  trailing,
  className,
}: SectionHeaderProps) {
  return (
    <div className={joinClassNames(styles.sectionHeader, className)}>
      <div>
        {eyebrow ? (
          <span className={styles.eyebrow}>{eyebrow}</span>
        ) : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle ? (
          <p className={styles.sectionSubtitle}>{subtitle}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className={styles.sectionTrailing}>{trailing}</div>
      ) : null}
    </div>
  );
}

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
  className?: string;
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={joinClassNames(
        styles.statusBadge,
        styles[tone],
        className
      )}
    >
      <span className={styles.statusDot} aria-hidden="true" />
      {children}
    </span>
  );
}

type ProgressBarProps = {
  value: number;
  label: string;
  showValue?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  label,
  showValue = true,
  className,
}: ProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={joinClassNames(styles.progress, className)}>
      <div className={styles.progressHeader}>
        <span>{label}</span>
        {showValue ? <strong>{normalizedValue} %</strong> : null}
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
      >
        <span
          className={styles.progressValue}
          style={{ width: normalizedValue + "%" }}
        />
      </div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(
        styles.button,
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({
  label,
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={joinClassNames(styles.iconButton, className)}
      {...props}
    />
  );
}

type AvatarPortrait = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type AvatarProps = {
  initials: string;
  size?: "small" | "medium";
  className?: string;
  label?: string;
  imageSrc?: string;
  portrait?: AvatarPortrait;
};

const portraitEditorSize = 204;

export function Avatar({
  initials,
  size = "medium",
  className,
  label,
  imageSrc,
  portrait,
}: AvatarProps) {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [avatarDiameter, setAvatarDiameter] = useState(0);
  const portraitRatio = avatarDiameter / portraitEditorSize;
  const portraitStyle: CSSProperties = portrait
    ? {
        transform:
          "translate(" +
          portrait.offsetX * portraitRatio +
          "px, " +
          portrait.offsetY * portraitRatio +
          "px) scale(" +
          portrait.scale +
          ")",
      }
    : {};

  useEffect(() => {
    const avatarElement = avatarRef.current;

    if (!avatarElement) {
      return;
    }

    const updateAvatarDiameter = () => {
      const { width, height } = avatarElement.getBoundingClientRect();

      setAvatarDiameter(Math.min(width, height));
    };

    updateAvatarDiameter();

    const resizeObserver = new ResizeObserver(updateAvatarDiameter);
    resizeObserver.observe(avatarElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <span
      ref={avatarRef}
      className={joinClassNames(
        styles.avatar,
        styles[size],
        className
      )}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          aria-hidden="true"
          fill
          quality={90}
          // `sizes` must account for the CSS zoom applied via `portraitStyle`
          // (portrait.scale, up to ~4.7x) -- otherwise Next fetches a raster
          // sized only for the unzoomed box (e.g. 56px) which then gets
          // magnified by that same factor, an upscale-of-a-downscale that
          // reads as blur regardless of source image quality.
          sizes={
            avatarDiameter
              ? Math.round(avatarDiameter * (portrait?.scale ?? 1)) + "px"
              : undefined
          }
          className={styles.avatarImage}
          style={portraitStyle}
        />
      ) : (
        initials
      )}
    </span>
  );
}
type DividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function Divider({
  orientation = "horizontal",
  className,
}: DividerProps) {
  return (
    <span
      className={joinClassNames(
        styles.divider,
        styles[orientation],
        className
      )}
      aria-hidden="true"
    />
  );
}
