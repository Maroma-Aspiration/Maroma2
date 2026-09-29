"use client";

import { useEffect, useState } from "react";
import { chapters } from "../../../lib/marketing/profile";

export function ChapterNav() {
  const [active, setActive] = useState<string>(chapters[0].id);

  useEffect(() => {
    const nodes = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((node): node is HTMLElement => node !== null);

    if (nodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-28% 0px -58% 0px",
        threshold: [0.1, 0.25, 0.5],
      },
    );

    for (const node of nodes) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="ml-nav" aria-label="Lookbook chapters">
      <div className="ml-wrap ml-nav-inner">
        {chapters.map((chapter, index) => {
          const isActive = chapter.id === active;
          return (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              className={isActive ? "is-active" : undefined}
            >
              <span className="ml-nav-index">{String(index + 1).padStart(2, "0")}</span>
              {chapter.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
