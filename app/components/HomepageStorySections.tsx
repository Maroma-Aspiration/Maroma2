"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseYouTubeVideoId } from "../../lib/youtube-embed";
import type { HomepageContent } from "../../lib/homepage-content-types";
import { defaultHomepageContent } from "../../lib/homepage-content-types";
import "../about/about-page.css";

export function HomepageStorySections() {
  const [content, setContent] = useState<HomepageContent>(() => defaultHomepageContent());

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/homepage-content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { content?: HomepageContent }) => {
        if (!cancelled && data.content) setContent(data.content);
      })
      .catch(() => {
        // keep defaults so About still renders
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const placesWithImages = content.places.filter((place) => place.images.length > 0);
  const videos = content.videos.filter((video) => video.url.trim());
  const testimonials = content.testimonials.filter((item) => item.quote.trim());

  return (
    <>
      <section
        className="home-about-teaser"
        id="about"
        data-review="Homepage about teaser"
        data-review-id="home-about"
        data-review-files="app/components/HomepageStorySections.tsx"
      >
        <div className="home-about-teaser-inner">
          <p className="about-eyebrow">Maison · Since 1976</p>
          <h2>{content.aboutTitle || "Every scent tells a story"}</h2>
          <p>
            {content.aboutBody ||
              "Botanical care, natural perfume, and home rituals crafted in Auroville, India. Fair Trade, vegan, and made with the community that has shaped fragrance here for decades."}
          </p>
          <div className="home-about-pillars">
            <Link href="/about#story">
              <strong>Our story</strong>
              <span>From incense under thatch to a global maison of botanical care.</span>
            </Link>
            <Link href="/about#founders">
              <strong>The founders</strong>
              <span>Paul and Laura, craft and voice, joined in Auroville.</span>
            </Link>
            <Link href="/about#values">
              <strong>Mission &amp; vision</strong>
              <span>Quality, earth-friendly practice, and the Auroville Charter.</span>
            </Link>
            <Link href="/about#fair-trade">
              <strong>Fair Trade</strong>
              <span>People before machines. Ten principles we live by.</span>
            </Link>
          </div>
          <Link href="/about" className="button primary">
            Read the full story
          </Link>
        </div>
      </section>

      {placesWithImages.length > 0 ? (
        <section className="home-story-section" id="places">
          <div className="home-story-inner">
            <span className="eyebrow">Visit</span>
            <h2>Café, outlet & spa</h2>
            <div className="home-places-grid">
              {placesWithImages.map((place) => (
                <article key={place.id} className="home-place-card">
                  <div className="home-place-images">
                    {place.images.map((src) => (
                      <img key={src} src={src} alt={place.name} />
                    ))}
                  </div>
                  <h3>{place.name}</h3>
                  {place.description ? <p>{place.description}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {videos.length > 0 ? (
        <section className="home-story-section" id="maroma-films">
          <div className="home-story-inner">
            <span className="eyebrow">Films</span>
            <h2>From the Maroma world</h2>
            <div className="home-video-grid">
              {videos.map((video) => {
                const yt = parseYouTubeVideoId(video.url);
                return (
                  <article key={video.id} className="home-video-card">
                    {yt ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${yt}`}
                        title={video.title || "Maroma video"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video src={video.url} controls playsInline poster="" />
                    )}
                    {video.title ? <h3>{video.title}</h3> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {testimonials.length > 0 ? (
        <section className="home-story-section" id="testimonials">
          <div className="home-story-inner">
            <span className="eyebrow">Voices</span>
            <h2>Testimonials</h2>
            <div className="home-testimonial-grid">
              {testimonials.map((item) => (
                <blockquote key={item.id} className="home-testimonial-card">
                  <p>{item.quote}</p>
                  <footer>
                    {item.attribution}
                    {item.source === "google" ? " · Google" : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
