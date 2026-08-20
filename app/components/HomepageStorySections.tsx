"use client";

import { useEffect, useState } from "react";
import { parseYouTubeVideoId } from "../../lib/youtube-embed";
import type { HomepageContent } from "../../lib/homepage-content-types";

export function HomepageStorySections() {
  const [content, setContent] = useState<HomepageContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/homepage-content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { content?: HomepageContent }) => {
        if (!cancelled) setContent(data.content ?? null);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!content) return null;

  const placesWithImages = content.places.filter((place) => place.images.length > 0);
  const videos = content.videos.filter((video) => video.url.trim());
  const testimonials = content.testimonials.filter((item) => item.quote.trim());

  return (
    <>
      <section className="home-story-section" id="about">
        <div className="home-story-inner">
          <span className="eyebrow">Maison</span>
          <h2>{content.aboutTitle}</h2>
          <p>{content.aboutBody}</p>
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
