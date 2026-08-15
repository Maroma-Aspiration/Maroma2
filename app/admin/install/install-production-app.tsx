"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window { __maromaInstallPrompt?: InstallPrompt; }
}

export default function InstallProductionApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [iphone, setIphone] = useState(false);
  const [firefox, setFirefox] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("Preparing the Chrome install prompt…");

  const rememberInstalled = useCallback(() => {
    window.localStorage.setItem("maroma-production-pwa-installed", "1");
    void fetch("/api/auth/pwa-install", { method: "POST" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.body.classList.add("fulfillment-board-active");
    setIphone(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    setFirefox(/Firefox|FxiOS/i.test(navigator.userAgent));
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone);
    if (isStandalone) rememberInstalled();
    void navigator.serviceWorker?.register("/sw-production.js");
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setMessage("Ready to install");
    };
    const captureEarlyPrompt = () => {
      if (!window.__maromaInstallPrompt) return;
      setPrompt(window.__maromaInstallPrompt);
      setMessage("Ready to install — tap the button below.");
    };
    const done = () => {
      setInstalled(true);
      setMessage("App installed");
      rememberInstalled();
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("maroma-install-ready", captureEarlyPrompt);
    window.addEventListener("appinstalled", done);
    captureEarlyPrompt();
    const timer = window.setTimeout(() => setMessage("Tap Install App. If Chrome has not enabled its prompt yet, use ⋮ → Install app."), 2500);
    return () => {
      document.body.classList.remove("fulfillment-board-active");
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("maroma-install-ready", captureEarlyPrompt);
      window.removeEventListener("appinstalled", done);
    };
  }, [rememberInstalled]);

  const install = async () => {
    if (installed) { window.location.href = "/admin/orders"; return; }
    if (!prompt) { setMessage(firefox ? "Firefox creates a badged shortcut. Open this same address in Chrome, then choose Install app." : "Chrome has not offered its install prompt yet. Tap ⋮ once, then Install app or Add to Home screen."); return; }
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
      setMessage("Installed — open the app from your home screen.");
      rememberInstalled();
    }
    else setMessage("Installation cancelled. Tap Install whenever you are ready.");
    setPrompt(null);
  };

  return (
    <main className="production-install-page">
      <section className="production-install-card">
        <img src="/icons/maroma-production-safe-192.png" alt="Maroma" className="production-install-icon" />
        <p className="fulfillment-board-eyebrow">Maroma Production</p>
        <h1>{installed ? "App installed" : "Install on this phone"}</h1>
        <p className="production-install-lead">Fast access to orders, prepare, pack and dispatch.</p>
        {iphone ? (
          <div className="production-install-ios">
            <p><strong>1.</strong> Tap Safari’s <strong>Share</strong> button □↑</p>
            <p><strong>2.</strong> Tap <strong>Add to Home Screen</strong></p>
            <p><strong>3.</strong> Tap <strong>Add</strong></p>
          </div>
        ) : firefox ? (
          <div className="production-install-ios">
            <p><strong>1.</strong> Copy this page address.</p>
            <p><strong>2.</strong> Open it in <strong>Chrome</strong>.</p>
            <p><strong>3.</strong> Tap <strong>Install App</strong>.</p>
          </div>
        ) : (
          <button type="button" className="production-install-button" onClick={() => void install()}>
            {installed ? "Open Production App" : "Install App"}
          </button>
        )}
        <p className="production-install-status" role="status">{iphone ? "No login is needed to install." : firefox ? "Chrome is required for an unbadged Android PWA installation." : message}</p>
        <Link href="/login?next=/admin/orders" className="production-install-signin">Sign in to Production</Link>
      </section>
    </main>
  );
}
