"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const RITUAL_LINKS = [
  {
    id: "morning",
    label: "Morning",
    hint: "Awaken & energise",
    href: "/rituals/morning"
  },
  {
    id: "evening",
    label: "Evening",
    hint: "Unwind & restore",
    href: "/rituals/evening"
  },
  {
    id: "home",
    label: "Home",
    hint: "Scent & sanctuary",
    href: "/rituals/home"
  }
] as const;

function MorningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 3.5v2M12 18.5v2M4.2 12h-2M21.8 12h-2M6.1 6.1l-1.4-1.4M19.3 19.3l-1.4-1.4M6.1 17.9l-1.4 1.4M19.3 4.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M5 19.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EveningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.5 14.8a6.2 6.2 0 0 1-8.9-8.9 7.5 7.5 0 1 0 8.9 8.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 5.5l.75 1.3 1.45.2-1.05 1 .25 1.45-1.3-.7-1.3.7.25-1.45-1.05-1 1.45-.2.75-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 10.5 12 5l6.5 5.5V18a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5V13a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const RITUAL_ICONS: Record<(typeof RITUAL_LINKS)[number]["id"], ReactNode> = {
  morning: <MorningIcon />,
  evening: <EveningIcon />,
  home: <HomeIcon />
};

type Props = {
  label?: string;
};

export function HeroRitualsMenu({ label = "Discover Rituals" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`hero-shop-care hero-rituals-menu${open ? " is-open" : ""}`}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={clearCloseTimer}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="button primary button-sage hero-shop-care-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>
      <div className="hero-shop-care-menu" role="menu" aria-label="Discover rituals options">
        {RITUAL_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hero-shop-care-menu-item hero-shop-care-menu-item--${item.id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="hero-shop-care-menu-icon">{RITUAL_ICONS[item.id]}</span>
            <span className="hero-shop-care-menu-copy">
              <span className="hero-shop-care-menu-title">{item.label}</span>
              <span className="hero-shop-care-menu-hint">{item.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
