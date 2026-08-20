"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const SHOP_CARE_LINKS = [
  {
    id: "skin",
    label: "Shop by Skin Type",
    hint: "Face & facial rituals",
    href: "/face-care"
  },
  {
    id: "hair",
    label: "Shop by Hair Type",
    hint: "Hair care collections",
    href: "/hair-care"
  },
  {
    id: "ingredient",
    label: "Shop by Ingredient",
    hint: "Botanical actives",
    href: "/?skipIntro=1#shop"
  }
] as const;

function SkinTypeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12.5" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.2 11.2c.55-.85 1.45-1.35 2.8-1.35s2.25.5 2.8 1.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10.1 14.1c.55.45 1.15.65 1.9.65s1.35-.2 1.9-.65"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 6.25V5M8.1 7.1 7 6M15.9 7.1 17 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HairTypeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 6.5c0 2.2 1.4 4.2 3.5 5.2 2.1-1 3.5-3 3.5-5.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 11.7c-2.8 0-5 1.65-5.75 4.1-.35 1.25.55 2.5 1.85 2.7.95.15 1.9-.35 2.45-1.15.55.8 1.5 1.3 2.45 1.15 1.3-.2 2.2-1.45 1.85-2.7-.75-2.45-2.95-4.1-5.75-4.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 8.2c.55-.75 1.35-1.15 2.2-1.15s1.65.4 2.2 1.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IngredientIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5c-2.2 2.45-3.5 4.55-3.5 6.75 0 2.35 1.55 4 3.5 4s3.5-1.65 3.5-4c0-2.2-1.3-4.3-3.5-6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.25v4M9.25 19.25h5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.75 8.35c-1.45.55-2.55 1.45-3.1 2.55M15.25 8.35c1.45.55 2.55 1.45 3.1 2.55"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SHOP_CARE_ICONS: Record<(typeof SHOP_CARE_LINKS)[number]["id"], ReactNode> = {
  skin: <SkinTypeIcon />,
  hair: <HairTypeIcon />,
  ingredient: <IngredientIcon />
};

type Props = {
  label?: string;
};

export function HeroShopCareMenu({ label = "Shop by Care" }: Props) {
  const displayLabel = label === "Shop Luxury" ? "Shop by Care" : label;
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
      className={`hero-shop-care${open ? " is-open" : ""}`}
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
        className="button primary button-gold hero-shop-care-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {displayLabel}
      </button>
      <div className="hero-shop-care-menu" role="menu" aria-label="Shop by care options">
        {SHOP_CARE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hero-shop-care-menu-item hero-shop-care-menu-item--${item.id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="hero-shop-care-menu-icon">{SHOP_CARE_ICONS[item.id]}</span>
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
