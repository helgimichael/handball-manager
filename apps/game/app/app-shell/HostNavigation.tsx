"use client";
import { useEffect } from "react";
import { StarkvisAppShell } from "./StarkvisAppShell";

export function HostNavigation() {
  useEffect(() => {
    const updateOffset = () => {
      const shell = document.querySelector<HTMLElement>("[data-starkvis-shell]");
      if (!shell) return;
      const isRevealed = shell.getAttribute("data-revealed") === "true";
      if (!isRevealed) {
        document.documentElement.style.setProperty("--sv-shell-offset", "0px");
        return;
      }
      const height = shell.offsetHeight || shell.getBoundingClientRect().height;
      if (height > 0) {
        document.documentElement.style.setProperty("--sv-shell-offset", `${Math.round(height)}px`);
      }
    };

    updateOffset();

    const observer = new MutationObserver(() => {
      updateOffset();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-revealed", "style"],
      subtree: true,
    });

    window.addEventListener("resize", updateOffset, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOffset);
      document.documentElement.style.removeProperty("--sv-shell-offset");
    };
  }, []);

  return <StarkvisAppShell appName="Handball Manager · LAB" />;
}
