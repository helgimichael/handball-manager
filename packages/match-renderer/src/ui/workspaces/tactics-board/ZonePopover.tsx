"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { designSystemTheme } from "../../design-system";
import styles from "./ZonePopover.module.css";

const VIEWPORT_MARGIN_PX = 8;
const ANCHOR_GAP_PX = 8;

type ZonePopoverProps = {
  anchorRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
};

// Portal-based, position:fixed popover anchored to a trigger button --
// renders OUTSIDE the workspace's normal document flow, so opening it can
// never change .panel's flex height or move the court (unlike the old
// in-flow .directionControl block it replaces). No focus trap/autofocus:
// opening it must never steal focus or scroll from the plan.
export default function ZonePopover({ anchorRef, isOpen, onClose, label, children }: ZonePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      // No need to reset `position` here -- the component renders null
      // whenever !isOpen (see the early return below), so a stale value
      // is simply never read; it gets recomputed fresh on the next open.
      return undefined;
    }

    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? 0;
      const rawLeft = anchorRect.left;
      const maxLeft = window.innerWidth - panelWidth - VIEWPORT_MARGIN_PX;
      const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rawLeft, maxLeft));
      const top = anchorRect.bottom + ANCHOR_GAP_PX;
      setPosition({ top, left });
    }

    reposition();
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    // Capture phase + stopPropagation so this Escape handler runs and
    // closes ONLY the popover, before it can also reach the workspace's
    // own bubble-phase window Escape listener (which deselects objects /
    // resets the active tool -- see TacticsBoardWorkspace.tsx).
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  // The portal target (document.body) sits OUTSIDE the workspace's own
  // <div style={designSystemTheme}> subtree -- CSS custom properties
  // follow the real DOM tree, not the React tree, so they don't cascade
  // into a portaled node otherwise. Re-applying the same theme object
  // here (never a different one) keeps every var(--ds-...) in this
  // panel's CSS resolving correctly without touching the portal
  // mechanism itself.
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={styles.popover}
      style={{
        ...designSystemTheme,
        ...(position ? { top: position.top, left: position.left, visibility: "visible" } : { visibility: "hidden" }),
      }}
    >
      <div className={styles.heading}>{label}</div>
      {children}
    </div>,
    document.body,
  );
}
