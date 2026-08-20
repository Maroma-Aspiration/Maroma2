"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "../../components/SignOutButton";
import type { PromoBanner, PromoAnimation, PromoMediaKind } from "../../../lib/promo-types";
import type { HomepageContent } from "../../../lib/homepage-content-types";
import { defaultHomepageContent } from "../../../lib/homepage-content-types";
import type { StoreLocation } from "../../../lib/store-locator-types";
import type { ProductReview } from "../../../lib/reviews-types";

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-canvas-image", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
  return data.url;
}

export default function AdminSiteClient() {
  const [tab, setTab] = useState<"promos" | "homepage" | "stores" | "reviews">("promos");
  const [status, setStatus] = useState("");
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [promo, setPromo] = useState({
    title: "",
    body: "",
    mediaUrl: "",
    mediaKind: "none" as PromoMediaKind,
    animation: "marquee" as PromoAnimation,
    ctaLabel: "",
    ctaHref: "",
    startsAt: "",
    endsAt: "",
    active: true,
  });
  const [home, setHome] = useState<HomepageContent>(defaultHomepageContent());
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [location, setLocation] = useState({
    name: "",
    kind: "retailer" as StoreLocation["kind"],
    address: "",
    city: "",
    region: "",
    country: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    lat: "",
    lng: "",
  });
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const load = useCallback(async () => {
    const [promoRes, homeRes, storeRes, reviewRes] = await Promise.all([
      fetch("/api/promos?admin=1", { cache: "no-store" }),
      fetch("/api/homepage-content", { cache: "no-store" }),
      fetch("/api/stores", { cache: "no-store" }),
      fetch("/api/reviews?admin=1", { cache: "no-store" }),
    ]);
    const promoData = (await promoRes.json()) as { banners?: PromoBanner[] };
    const homeData = (await homeRes.json()) as { content?: HomepageContent };
    const storeData = (await storeRes.json()) as { locations?: StoreLocation[] };
    const reviewData = (await reviewRes.json()) as { reviews?: ProductReview[] };
    setBanners(promoData.banners ?? []);
    if (homeData.content) setHome(homeData.content);
    setLocations(storeData.locations ?? []);
    setReviews(reviewData.reviews ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="login-page">
      <section className="login-card" style={{ maxWidth: 960, width: "100%" }}>
        <p className="login-eyebrow">Admin</p>
        <h1 className="login-title">Site content</h1>
        <p className="login-reason">{status || "Promotions, homepage, stores, reviews."}</p>
        <div className="login-actions-row" style={{ marginBottom: 16 }}>
          <Link href="/admin/orders" className="button secondary">
            Orders
          </Link>
          <Link href="/admin/b2b" className="button secondary">
            B2B
          </Link>
          <SignOutButton />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {(["promos", "homepage", "stores", "reviews"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "button primary button-sage" : "button secondary"}
              onClick={() => setTab(id)}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === "promos" ? (
          <div>
            <h2>Homepage banners</h2>
            <p>Schedule text, image or video. Animation presets: marquee, fade, slide, pulse.</p>
            <input placeholder="Title" value={promo.title} onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))} />
            <textarea placeholder="Message" value={promo.body} onChange={(e) => setPromo((p) => ({ ...p, body: e.target.value }))} />
            <select
              value={promo.mediaKind}
              onChange={(e) => setPromo((p) => ({ ...p, mediaKind: e.target.value as PromoMediaKind }))}
            >
              <option value="none">Text only</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <input
              type="file"
              accept={promo.mediaKind === "video" ? "video/*" : "image/*"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadFile(file)
                  .then((url) => setPromo((p) => ({ ...p, mediaUrl: url })))
                  .catch((err) => setStatus(err instanceof Error ? err.message : "Upload failed"));
              }}
            />
            <select
              value={promo.animation}
              onChange={(e) => setPromo((p) => ({ ...p, animation: e.target.value as PromoAnimation }))}
            >
              <option value="marquee">Marquee</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="pulse">Pulse</option>
            </select>
            <input placeholder="CTA label" value={promo.ctaLabel} onChange={(e) => setPromo((p) => ({ ...p, ctaLabel: e.target.value }))} />
            <input placeholder="CTA link" value={promo.ctaHref} onChange={(e) => setPromo((p) => ({ ...p, ctaHref: e.target.value }))} />
            <label>
              Starts
              <input type="datetime-local" value={promo.startsAt} onChange={(e) => setPromo((p) => ({ ...p, startsAt: e.target.value }))} />
            </label>
            <label>
              Ends
              <input type="datetime-local" value={promo.endsAt} onChange={(e) => setPromo((p) => ({ ...p, endsAt: e.target.value }))} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={promo.active}
                onChange={(e) => setPromo((p) => ({ ...p, active: e.target.checked }))}
              />
              Active
            </label>
            <button
              type="button"
              className="button primary button-sage"
              onClick={async () => {
                const res = await fetch("/api/promos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(promo),
                });
                const data = (await res.json()) as { error?: string };
                setStatus(data.error || "Banner saved.");
                await load();
              }}
            >
              Save banner
            </button>
            <ul>
              {banners.map((banner) => (
                <li key={banner.id}>
                  {banner.title} {banner.active ? "(on)" : "(off)"} {banner.startsAt}–{banner.endsAt}
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/promos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deleteId: banner.id }),
                      });
                      await load();
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "homepage" ? (
          <div>
            <h2>About, gallery, films, testimonials</h2>
            <input
              value={home.aboutTitle}
              onChange={(e) => setHome((h) => ({ ...h, aboutTitle: e.target.value }))}
            />
            <textarea
              rows={5}
              value={home.aboutBody}
              onChange={(e) => setHome((h) => ({ ...h, aboutBody: e.target.value }))}
            />
            {home.places.map((place, index) => (
              <fieldset key={place.id} style={{ margin: "12px 0" }}>
                <legend>{place.name}</legend>
                <input
                  value={place.description}
                  onChange={(e) =>
                    setHome((h) => {
                      const places = [...h.places];
                      places[index] = { ...place, description: e.target.value };
                      return { ...h, places };
                    })
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    void Promise.all(files.map(uploadFile)).then((urls) => {
                      setHome((h) => {
                        const places = [...h.places];
                        places[index] = { ...place, images: [...place.images, ...urls] };
                        return { ...h, places };
                      });
                    });
                  }}
                />
                <p>{place.images.length} images</p>
              </fieldset>
            ))}
            <h3>Video feed</h3>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setHome((h) => ({
                  ...h,
                  videos: [...h.videos, { id: crypto.randomUUID(), title: "", url: "" }],
                }))
              }
            >
              Add video URL
            </button>
            {home.videos.map((video, index) => (
              <div key={video.id}>
                <input
                  placeholder="Title"
                  value={video.title}
                  onChange={(e) =>
                    setHome((h) => {
                      const videos = [...h.videos];
                      videos[index] = { ...video, title: e.target.value };
                      return { ...h, videos };
                    })
                  }
                />
                <input
                  placeholder="YouTube or video URL"
                  value={video.url}
                  onChange={(e) =>
                    setHome((h) => {
                      const videos = [...h.videos];
                      videos[index] = { ...video, url: e.target.value };
                      return { ...h, videos };
                    })
                  }
                />
              </div>
            ))}
            <h3>Testimonials</h3>
            <p>
              Google does not allow scraping reviews. Add quotes here and mark the source as Google
              when they come from a public Google listing.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setHome((h) => ({
                  ...h,
                  testimonials: [
                    ...h.testimonials,
                    { id: crypto.randomUUID(), quote: "", attribution: "", source: "site" },
                  ],
                }))
              }
            >
              Add testimonial
            </button>
            {home.testimonials.map((item, index) => (
              <div key={item.id}>
                <textarea
                  value={item.quote}
                  onChange={(e) =>
                    setHome((h) => {
                      const testimonials = [...h.testimonials];
                      testimonials[index] = { ...item, quote: e.target.value };
                      return { ...h, testimonials };
                    })
                  }
                />
                <input
                  placeholder="Attribution"
                  value={item.attribution}
                  onChange={(e) =>
                    setHome((h) => {
                      const testimonials = [...h.testimonials];
                      testimonials[index] = { ...item, attribution: e.target.value };
                      return { ...h, testimonials };
                    })
                  }
                />
                <select
                  value={item.source}
                  onChange={(e) =>
                    setHome((h) => {
                      const testimonials = [...h.testimonials];
                      testimonials[index] = {
                        ...item,
                        source: e.target.value === "google" ? "google" : "site",
                      };
                      return { ...h, testimonials };
                    })
                  }
                >
                  <option value="site">Site</option>
                  <option value="google">Google</option>
                </select>
              </div>
            ))}
            <button
              type="button"
              className="button primary button-sage"
              onClick={async () => {
                const res = await fetch("/api/homepage-content", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: home }),
                });
                const data = (await res.json()) as { error?: string };
                setStatus(data.error || "Homepage saved.");
              }}
            >
              Save homepage
            </button>
          </div>
        ) : null}

        {tab === "stores" ? (
          <div>
            <h2>Store locator</h2>
            <input placeholder="Name" value={location.name} onChange={(e) => setLocation((l) => ({ ...l, name: e.target.value }))} />
            <select
              value={location.kind}
              onChange={(e) => setLocation((l) => ({ ...l, kind: e.target.value as StoreLocation["kind"] }))}
            >
              <option value="store">Store</option>
              <option value="outlet">Outlet</option>
              <option value="spa">Spa</option>
              <option value="cafe">Café</option>
              <option value="retailer">Retailer</option>
              <option value="distributor">Distributor</option>
            </select>
            <input placeholder="Address" value={location.address} onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))} />
            <input placeholder="City" value={location.city} onChange={(e) => setLocation((l) => ({ ...l, city: e.target.value }))} />
            <input placeholder="Region" value={location.region} onChange={(e) => setLocation((l) => ({ ...l, region: e.target.value }))} />
            <input placeholder="Country" value={location.country} onChange={(e) => setLocation((l) => ({ ...l, country: e.target.value }))} />
            <input placeholder="Postal code" value={location.postalCode} onChange={(e) => setLocation((l) => ({ ...l, postalCode: e.target.value }))} />
            <input placeholder="Phone" value={location.phone} onChange={(e) => setLocation((l) => ({ ...l, phone: e.target.value }))} />
            <input placeholder="Email" value={location.email} onChange={(e) => setLocation((l) => ({ ...l, email: e.target.value }))} />
            <input placeholder="Website" value={location.website} onChange={(e) => setLocation((l) => ({ ...l, website: e.target.value }))} />
            <input placeholder="Latitude" value={location.lat} onChange={(e) => setLocation((l) => ({ ...l, lat: e.target.value }))} />
            <input placeholder="Longitude" value={location.lng} onChange={(e) => setLocation((l) => ({ ...l, lng: e.target.value }))} />
            <button
              type="button"
              className="button primary button-sage"
              onClick={async () => {
                const res = await fetch("/api/stores", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(location),
                });
                const data = (await res.json()) as { error?: string };
                setStatus(data.error || "Location saved.");
                await load();
              }}
            >
              Save location
            </button>
            <ul>
              {locations.map((item) => (
                <li key={item.id}>
                  {item.name} · {item.city} {item.country}
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/stores", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deleteId: item.id }),
                      });
                      await load();
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "reviews" ? (
          <div>
            <h2>Product reviews</h2>
            <p>Site reviews start pending. Publish to show on the product page. Google quotes can be added from the homepage tab or here with source Google.</p>
            <ul>
              {reviews.map((review) => (
                <li key={review.id}>
                  {review.rating}/5 {review.author} on {review.productId} [{review.status}] {review.source}
                  <p>{review.body}</p>
                  {review.status !== "published" ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/reviews", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ reviewId: review.id, status: "published" }),
                        });
                        await load();
                      }}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/reviews", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ reviewId: review.id, status: "hidden" }),
                        });
                        await load();
                      }}
                    >
                      Hide
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
