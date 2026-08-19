import type { CSSProperties } from "react";
import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export const designSystemTheme = {
  "--color-brand-primary": colors.brandPrimary,
  "--color-brand-surface": colors.brandSurface,
  "--color-background-primary": colors.backgroundPrimary,
  "--color-text-primary": colors.textPrimary,
  "--ds-color-background": colors.background,
  "--ds-color-surface": colors.surface,
  "--ds-color-surface-subtle": colors.surfaceLight,
  "--ds-color-surface-elevated": colors.surfaceElevated,
  "--ds-color-surface-raised": colors.surfaceRaised,
  "--ds-color-border": colors.border,
  "--ds-color-border-strong": colors.borderStrong,
  "--ds-color-text": colors.text,
  "--ds-color-text-secondary": colors.textSecondary,
  "--ds-color-text-muted": colors.textMuted,
  "--ds-color-accent": colors.accent,
  "--ds-color-accent-muted": colors.accentMuted,
  "--ds-color-success": colors.success,
  "--ds-color-warning": colors.warning,
  "--ds-color-error": colors.error,
  "--ds-color-info": colors.info,
  "--ds-space-xs": spacing.xs,
  "--ds-space-sm": spacing.sm,
  "--ds-space-md": spacing.md,
  "--ds-space-lg": spacing.lg,
  "--ds-space-xl": spacing.xl,
  "--ds-radius-sm": radii.small,
  "--ds-radius-md": radii.medium,
  "--ds-radius-lg": radii.large,
  "--ds-radius-round": radii.round,
  "--ds-font-family": typography.fontFamily,
  "--ds-font-title": typography.title,
  "--ds-font-heading": typography.heading,
  "--ds-font-body": typography.body,
  "--ds-font-small": typography.small,
  "--ds-font-caption": typography.caption,
} as CSSProperties;
