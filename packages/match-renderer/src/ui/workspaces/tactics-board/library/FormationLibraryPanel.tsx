"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "../../../design-system";
import { FORMATIONS, type FormationDefinition } from "./FormationLibrary.ts";
import styles from "./FormationLibraryPanel.module.css";

type FilterTab = "ALLA" | "FORMATIONER" | "SCENER" | "FAVORITER" | "SENASTE" | "PAPPERSKORG";

const FILTER_TABS: Array<{ id: FilterTab; label: string; disabled: boolean }> = [
  { id: "ALLA", label: "Alla", disabled: false },
  { id: "FORMATIONER", label: "Formationer", disabled: false },
  { id: "SCENER", label: "Scener", disabled: true },
  { id: "FAVORITER", label: "Favoriter", disabled: true },
  { id: "SENASTE", label: "Senaste", disabled: true },
  { id: "PAPPERSKORG", label: "Papperskorg", disabled: true },
];

type FormationLibraryPanelProps = {
  activeFormationId: string | null;
  onOpenFormation: (formation: FormationDefinition) => void;
};

function FormationThumbnail({ formation }: { formation: FormationDefinition }) {
  return (
    <svg viewBox="0 0 20 20" className={styles.cardThumbnailImage} aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="19" rx="1" className={styles.thumbnailCourt} />
      <path d="M4 1 A6 6 0 0 0 16 1" className={styles.thumbnailLine} />
      {formation.objects.map((object, index) => (
        <circle
          key={`${formation.id}-${index}`}
          cx={object.position.x}
          cy={object.position.y}
          r={object.type === "BALL" ? 0.35 : 0.55}
          className={styles[`thumbnail${object.type}`]}
        />
      ))}
    </svg>
  );
}

export default function FormationLibraryPanel({
  activeFormationId,
  onOpenFormation,
}: FormationLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALLA");

  const visibleFormations = useMemo(() => {
    if (activeTab === "FORMATIONER") {
      return FORMATIONS;
    }
    return FORMATIONS;
  }, [activeTab]);

  return (
    <div className={styles.libraryPanelContent}>
      <h3 className={styles.libraryTitle}>FIELD Library</h3>

      <div className={styles.filterTabs} role="tablist" aria-label="Filtrera bibliotek">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            data-active={activeTab === tab.id ? "true" : "false"}
            className={styles.filterTab}
            disabled={tab.disabled}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        className={styles.searchInput}
        placeholder="Sök i biblioteket..."
        aria-label="Sök i biblioteket"
        disabled
      />

      <div className={styles.cardList}>
        {visibleFormations.map((formation) => (
          <button
            key={formation.id}
            type="button"
            className={styles.card}
            data-open={formation.id === activeFormationId ? "true" : "false"}
            onClick={() => onOpenFormation(formation)}
          >
            <span className={styles.cardThumbnail} aria-hidden="true">
              <FormationThumbnail formation={formation} />
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardHeaderRow}>
                <StatusBadge tone="neutral">Formation</StatusBadge>
                <span
                  role="button"
                  aria-disabled="true"
                  className={styles.favoriteToggle}
                  data-active="false"
                >
                  ★
                </span>
              </span>
              <span className={styles.cardTitle}>{formation.title}</span>
              <span className={styles.cardMeta}>{formation.category}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
