"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PromoBannerAdminPanel } from "../../components/PromoBannerAdminPanel";
import type { PromoBanner } from "../../../lib/promo-types";
import "./admin-promo-banners.css";

export default function AdminSiteClient() {
  const [status, setStatus] = useState("");
  const [publishSucceeded, setPublishSucceeded] = useState(false);
  const [banners, setBanners] = useState<PromoBanner[]>([]);

  useEffect(() => {
    if (!publishSucceeded) return;
    const timer = window.setTimeout(() => setPublishSucceeded(false), 8000);
    return () => window.clearTimeout(timer);
  }, [publishSucceeded]);

  const load = useCallback(async () => {
    const promoRes = await fetch("/api/promos?admin=1", { cache: "no-store" });
    const promoData = (await promoRes.json()) as { banners?: PromoBanner[] };
    setBanners(promoData.banners ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="login-page">
      <section className="login-card admin-site-card" style={{ maxWidth: 1180, width: "100%" }}>
        <p className="login-eyebrow">Admin</p>
        <h1 className="login-title">Promo</h1>
        <p className={`login-reason${status === "Published!" ? " promo-admin-status-success" : ""}`}>
          {status || "Hero promo banners and sequences."}
        </p>
        <p style={{ margin: "0 0 20px" }}>
          <Link className="button secondary" href="https://www.maromashopping.com/admin/products">QR Codes</Link>
        </p>
        <PromoBannerAdminPanel
          banners={banners}
          onRefresh={load}
          onStatus={setStatus}
          publishSucceeded={publishSucceeded}
          onPublishSucceeded={() => setPublishSucceeded(true)}
        />
      </section>
    </main>
  );
}
