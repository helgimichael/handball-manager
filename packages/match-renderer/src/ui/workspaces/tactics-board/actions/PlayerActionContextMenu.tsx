"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { designSystemTheme } from "../../../design-system";
import type { PlayerActionDefinition } from "./PlayerActionRegistry.ts";
import type { PlayerActionType } from "./PlayerActionTypes.ts";
import type { PlayerStateDefinition } from "../states/PlayerStateRegistry.ts";
import type { PlayerStateType } from "../states/PlayerStateTypes.ts";
import styles from "./PlayerActionContextMenu.module.css";

type PlayerActionContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number };
  actions: readonly PlayerActionDefinition[];
  states: readonly PlayerStateDefinition[];
  extraItems?: readonly { id: string; label: string; onSelect: () => void }[];
  onSelectAction: (type: PlayerActionType) => void;
  onSelectState: (type: PlayerStateType) => void;
  onClose: () => void;
};

export default function PlayerActionContextMenu({
  isOpen,
  position,
  actions,
  states,
  extraItems = [],
  onSelectAction,
  onSelectState,
  onClose,
}: PlayerActionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

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
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  function handleMenuPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const hasMenuItems = actions.length > 0 || states.length > 0 || extraItems.length > 0;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Actions"
      className={styles.menu}
      style={{
        ...designSystemTheme,
        top: position.y,
        left: position.x,
      }}
      onPointerDown={handleMenuPointerDown}
    >
      <div className={styles.heading}>Actions</div>
      {hasMenuItems ? (
        <>
          {actions.map((action) => (
            <button
              key={`action-${action.type}`}
              type="button"
              role="menuitem"
              className={styles.actionButton}
              onClick={() => onSelectAction(action.type)}
            >
              {action.label}
            </button>
          ))}
          {states.map((state) => (
          <button
            key={`state-${state.type}`}
            type="button"
            role="menuitem"
            className={styles.actionButton}
            onClick={() => onSelectState(state.type)}
          >
            {state.label}
          </button>
          ))}
          {extraItems.map((item) => (
            <button
              key={`extra-${item.id}`}
              type="button"
              role="menuitem"
              className={styles.actionButton}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          ))}
        </>
      ) : (
        <div className={styles.emptyState}>No actions available</div>
      )}
    </div>,
    document.body,
  );
}
