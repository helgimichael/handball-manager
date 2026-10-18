// Generated from components/Navbar.tsx; preserve the source layout.
"use client";

import { WebsiteImage as Image, WebsiteLink as Link } from "./WebsiteAdapters.js";
import { useState, useEffect } from "react";

interface NavbarProps {
  onOpenNotify?: () => void;
  appExtras?: React.ReactNode;
}

export function WebsiteNavbar({ onOpenNotify, appExtras }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToAnchor = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header data-website-navbar="source"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/[0.08] bg-[#0A0C0D]/95 backdrop-blur-md py-3 shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          : "border-b border-transparent bg-gradient-to-b from-[#0A0C0D]/80 via-[#0A0C0D]/40 to-transparent py-4 sm:py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Brand Logo / Return to top */}
        <Link
          href="/#top"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="group flex items-center gap-3 focus:outline-none focus:ring-1 focus:ring-[#00C2B3]/50 rounded-lg p-1"
          aria-label="STARKVIS — Tillbaka till toppen"
        >
          <Image
            src="/starkvis-logo-white.png"
            alt="STARKVIS"
            width={1536}
            height={1024}
            priority
            quality={100}
            className="h-7 w-auto transition-opacity group-hover:opacity-85 sm:h-8"
          />
        </Link>

        {/* Locked Primary Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Huvudnavigation">
          <Link
            href="/apps"
            className="text-xs font-mono uppercase tracking-[0.16em] text-[#A9B1AF] transition-colors hover:text-[#00C2B3] focus:outline-none focus:text-[#00C2B3]"
          >
            Apps
          </Link>

          <Link
            href="/#os"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                scrollToAnchor("os");
              }
            }}
            className="text-xs font-mono uppercase tracking-[0.16em] text-[#A9B1AF] transition-colors hover:text-[#00C2B3] focus:outline-none focus:text-[#00C2B3]"
          >
            STARKVIS OS
          </Link>

          <Link
            href="/#journal"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                scrollToAnchor("journal");
              }
            }}
            className="text-xs font-mono uppercase tracking-[0.16em] text-[#A9B1AF] transition-colors hover:text-[#00C2B3] focus:outline-none focus:text-[#00C2B3]"
          >
            Journal & Sagorna
          </Link>
        </nav>

        {/* Action CTAs (Discreet Notify + Verified OS Login) */}
        <div className="hidden items-center gap-4 md:flex">
          {onOpenNotify && (
            <button
              type="button"
              onClick={onOpenNotify}
              className="text-xs font-mono uppercase tracking-[0.16em] text-[#7E8884] transition-colors hover:text-[#F4F7F6]"
            >
              Intresseanmälan
            </button>
          )}

          <a
            href="https://app.starkv.is"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-[#00C2B3]/60 bg-[#00C2B3]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00C2B3] backdrop-blur-md transition-all hover:border-[#00C2B3] hover:bg-[#00C2B3] hover:text-[#0A0C0D] hover:shadow-[0_0_18px_rgba(0,194,179,0.4)] active:translate-y-[1px]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C2B3] animate-pulse" />
            <span>Logga in</span>
            <span className="text-[10px]">↗</span>
          </a>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Öppna navigationsmeny"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#F4F7F6] md:hidden focus:outline-none focus:ring-1 focus:ring-[#00C2B3]"
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-[#0A0C0D]/98 px-6 py-6 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              href="/apps"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center text-sm font-mono uppercase tracking-[0.16em] text-[#F4F7F6] py-2 border-b border-white/5"
            >
              Apps
            </Link>
            <Link
              href="/#os"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  scrollToAnchor("os");
                } else {
                  setMobileMenuOpen(false);
                }
              }}
              className="text-sm font-mono uppercase tracking-[0.16em] text-[#F4F7F6] py-2 border-b border-white/5"
            >
              STARKVIS OS
            </Link>
            <Link
              href="/#journal"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  scrollToAnchor("journal");
                } else {
                  setMobileMenuOpen(false);
                }
              }}
              className="text-sm font-mono uppercase tracking-[0.16em] text-[#F4F7F6] py-2 border-b border-white/5"
            >
              Journal & Sagorna
            </Link>

            <div className="pt-2 flex flex-col gap-3">
              <a
                href="https://app.starkv.is"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#00C2B3] bg-[#00C2B3] py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0A0C0D]"
              >
                <span>Logga in på STARKVIS OS</span>
                <span className="text-[11px]">↗</span>
              </a>

              {onOpenNotify && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenNotify();
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xs font-mono uppercase tracking-[0.18em] text-[#A9B1AF]"
                >
                  Anmäl intresse för uppdateringar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {appExtras}
    </header>
  );
}
