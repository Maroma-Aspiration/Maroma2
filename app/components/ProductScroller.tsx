"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { AddToBagButton } from "./cart/AddToBagButton";
import { getMaromaMobileViewportMatches } from "../../lib/mobile-viewport";
import type { CSSProperties } from "react";

interface ScrollerItem {
  id?: string;
  label: string;
  description: string;
  image: string;
  color?: string;
  href?: string;
  product?: any; // Using any for now to avoid circular deps or complex imports, but will be ProductRecord
}

interface ProductScrollerProps {
  title?: string;
  subtitle?: string;
  items: ScrollerItem[];
  className?: string;
  sectionStyle?: CSSProperties;
  adminPositionEditable?: boolean;
  onAdminPositionPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onAdminPositionPointerMove?: (event: React.PointerEvent<HTMLElement>) => void;
  onAdminPositionPointerUp?: (event: React.PointerEvent<HTMLElement>) => void;
}

export const ProductScroller: React.FC<ProductScrollerProps> = ({
  title,
  subtitle,
  items,
  className = "",
  sectionStyle,
  adminPositionEditable = false,
  onAdminPositionPointerDown,
  onAdminPositionPointerMove,
  onAdminPositionPointerUp
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [fitsViewport, setFitsViewport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const track = el.querySelector<HTMLElement>(".scroller-track");
    const trackWidth = track?.getBoundingClientRect().width ?? 0;
    const viewportWidth = el.getBoundingClientRect().width;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    // Firefox often under-reports scrollWidth — also compare track vs viewport width.
    const scrollable =
      items.length > 1 &&
      (maxScroll > 1 || trackWidth > viewportWidth + 1);
    const atStart = el.scrollLeft <= 2;
    const atEnd = maxScroll <= 2 || el.scrollLeft >= maxScroll - 2;

    setFitsViewport(!scrollable);
    setIsAtStart(atStart);
    setIsAtEnd(scrollable ? atEnd : true);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const section = el.closest(".scroller-section");
    const isMobileLayout =
      getMaromaMobileViewportMatches() ||
      document.body.classList.contains("admin-mobile-preview-active");
    if (section && isMobileLayout) {
      section.querySelectorAll<HTMLElement>(".scroll-zoom").forEach((node) => {
        node.classList.add("is-inview");
      });
    }

    checkScroll();
    const raf = requestAnimationFrame(() => checkScroll());
    const t1 = window.setTimeout(checkScroll, 150);
    const t2 = window.setTimeout(checkScroll, 600);

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => checkScroll())
      : null;
    ro?.observe(el);
    const track = el.querySelector(".scroller-track");
    if (track) {
      ro?.observe(track);
    }
    el.querySelectorAll("img").forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", checkScroll);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      ro?.disconnect();
    };
  }, [items]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;

    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeft(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    el.scrollLeft = scrollLeft - walk;
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const lovedVeils = className.includes("scroller-loved-for-a-reason");

  const handleLovedScrollInvite = () => {
    carouselRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const scrollByDirection = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const track = el.querySelector<HTMLElement>(".scroller-track");
    const card = el.querySelector<HTMLElement>(".scroller-card");
    if (!card) {
      el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
      return;
    }
    const gap = track ? parseFloat(getComputedStyle(track).gap) || 0 : 0;
    el.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
  };

  const showScrollNav = !fitsViewport && items.length > 1;

  return (
    <section
      className={`scroller-section ${className}${adminPositionEditable ? " is-admin-position-editable" : ""}`}
      style={sectionStyle}
      {...(lovedVeils ? { "data-maroma-loved-section": "true" } : {})}
    >
      {lovedVeils ? (
        <>
          <div
            className="loved-veil loved-veil-wash"
            aria-hidden
            data-maroma-loved-layer="full-wash"
            title="Loved section: full-bleed tint (the grey behind the headline is this layer)"
          />
          <div
            className="loved-veil loved-veil-band"
            aria-hidden
            data-maroma-loved-layer="band-on-wash"
            title="Loved section: optional horizontal band (opacity 0 = invisible)"
          />
        </>
      ) : null}
      {(title || subtitle) && (
        <div
          className={`scroller-header${adminPositionEditable ? " is-admin-position-handle" : ""}`}
          data-maroma-loved-target={lovedVeils ? "headline-row" : undefined}
          onPointerDown={adminPositionEditable ? onAdminPositionPointerDown : undefined}
          onPointerMove={adminPositionEditable ? onAdminPositionPointerMove : undefined}
          onPointerUp={adminPositionEditable ? onAdminPositionPointerUp : undefined}
        >
          {title && <h2 className="scroller-title scroll-zoom">{title}</h2>}
          {subtitle &&
            (lovedVeils ? (
              <p className="scroller-subtitle scroller-subtitle-loved scroll-zoom">
                <span className="scroller-subtitle-line">See what people</span>
                <span className="scroller-subtitle-line">Are loving right now</span>
              </p>
            ) : (
              <p className="scroller-subtitle scroll-zoom">
                {subtitle.split("\n").map((line, index) => (
                  <span key={`${line}-${index}`} className="scroller-subtitle-part">
                    {index > 0 ? <br className="scroller-subtitle-br" aria-hidden="true" /> : null}
                    {line}
                  </span>
                ))}
              </p>
            ))}
          {lovedVeils && (title || subtitle) ? (
            <button
              type="button"
              className="loved-scroll-invite"
              onClick={handleLovedScrollInvite}
              aria-label="Scroll to best sellers"
            >
              <span className="loved-scroll-invite-track" aria-hidden="true">
                <svg className="loved-scroll-invite-arrow loved-scroll-invite-arrow-1" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg className="loved-scroll-invite-arrow loved-scroll-invite-arrow-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          ) : null}
        </div>
      )}

      <div
        ref={carouselRef}
        className={`carousel-fade-wrapper scroller-product-carousel${isAtStart ? " at-start" : ""}${isAtEnd ? " at-end" : ""}${fitsViewport ? " fits-viewport" : ""}`}
      >
        <div className="scroller-viewport-container">
          {showScrollNav && !isAtStart ? (
            <button
              type="button"
              className="scroller-nav scroller-nav-prev"
              aria-label="Scroll products left"
              onClick={() => scrollByDirection(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          {showScrollNav && !isAtEnd ? (
            <button
              type="button"
              className="scroller-nav scroller-nav-next"
              aria-label="Scroll products right"
              onClick={() => scrollByDirection(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <div 
            className="scroller-viewport" 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <div className="scroller-track">
              {items.map((item, index) => (
                <div key={index} className="scroller-card scroll-zoom">
                  <Link href={item.href || "#"} className="scroller-card-inner">
                    <div className="scroller-card-media" style={{ backgroundColor: item.color || "#f8f8f8" }}>
                      <img src={item.image} alt={item.label} loading="lazy" />
                    </div>
                    <div className="scroller-card-content">
                      <h3 className="scroller-card-label">{item.label}</h3>
                      <p className="scroller-card-desc">{item.description}</p>
                    </div>
                  </Link>
                  {item.product && (
                    <div className="scroller-card-actions" style={{ marginTop: "12px", padding: "0 4px" }}>
                      <AddToBagButton product={item.product} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
