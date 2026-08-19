"use client";

import type { ReactNode } from "react";
import styles from "./ToolPanelSection.module.css";

type ToolPanelSectionProps = {
  id: string;
  title: string;
  icon?: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
};

// The ONE disclosure/collapsible implementation for every collapsible
// section in the tool panel (Verktyg, Objekt, Rotation, Kortkommandon,
// and any future section -- Linjer, Markeringar, Formationer, ...).
// Semantic <button> (native Tab/Enter/Space keyboard support for free,
// no custom key handling), aria-expanded/aria-controls, and content only
// mounted in the DOM when open -- no section implements its own
// chevron/toggle logic separately.
export default function ToolPanelSection({ id, title, icon, isOpen, onToggle, children }: ToolPanelSectionProps) {
  const contentId = `tactics-board-section-${id}`;

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => onToggle(id)}
      >
        <span className={styles.chevron} aria-hidden="true">
          {isOpen ? "▼" : "▶"}
        </span>
        {icon ? (
          <span aria-hidden="true" className={styles.icon}>
            {icon}
          </span>
        ) : null}
        {title}
      </button>
      {isOpen ? (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
