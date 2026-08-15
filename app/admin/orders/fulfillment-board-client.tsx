"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "../../components/SignOutButton";
import { formatInrPrice } from "../../../lib/format-price";
import type { FulfillmentOrderSummary } from "../../../lib/commerce-fulfillment";

const POLL_MS = 4000;

type StageKey = "prepare" | "pack" | "ship";
type InstallPlatform = "android" | "iphone";
type PwaInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const STAGE_META: Record<StageKey, { icon: string; label: string; hint: string }> = {
  prepare: { icon: "✦", label: "Prepare", hint: "Pick items" },
  pack: { icon: "▣", label: "Pack", hint: "Box & card" },
  ship: { icon: "→", label: "Ship", hint: "Label & send" },
};

function statusLabel(status: string): string {
  if (status === "pending_payment") return "Awaiting payment";
  if (status === "paid") return "Paid — make now";
  if (status === "fulfilled") return "Shipped";
  if (status === "cancelled") return "Cancelled";
  return status.replace("_", " ");
}

function ageInDays(createdAt: string): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const nowInIndia = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const createdInIndia = new Date(created.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const today = new Date(nowInIndia.getFullYear(), nowInIndia.getMonth(), nowInIndia.getDate()).getTime();
  const orderDay = new Date(createdInIndia.getFullYear(), createdInIndia.getMonth(), createdInIndia.getDate()).getTime();
  return Math.max(0, Math.floor((today - orderDay) / 86_400_000));
}

function urgencyFor(days: number, percent: number) {
  if (days >= 4 || (days >= 3 && percent < 50)) return { level: 3, label: "Critical" };
  if (days >= 2) return { level: 2, label: "High" };
  return { level: 1, label: "Attention" };
}

function nextTask(order: FulfillmentOrderSummary): string {
  if (!order.progress.stages.prepare.complete && order.progress.stages.prepare.total > 0) return "Finish preparing items";
  if (!order.progress.stages.pack.complete && order.progress.stages.pack.total > 0) return "Finish packing order";
  return "Complete label and courier handoff";
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 42;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="fulfillment-progress-ring" aria-hidden="true">
      <svg width={radius * 2} height={radius * 2}>
        <circle
          className="fulfillment-progress-ring-track"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          className="fulfillment-progress-ring-fill"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="fulfillment-progress-ring-label">{percent}%</span>
    </div>
  );
}

function OrderCard({ order }: { order: FulfillmentOrderSummary }) {
  const isComplete = order.progress.percent === 100;
  const isFulfilled = order.status === "fulfilled";

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className={`fulfillment-order-card${isComplete ? " is-complete" : ""}${isFulfilled ? " is-shipped" : ""}`}
    >
      <div className="fulfillment-order-card-top">
        <div>
          <p className="fulfillment-order-number">{order.orderNumber}</p>
          <p className="fulfillment-order-meta">
            {order.customerName || order.customerEmail}
            {order.city ? ` · ${order.city}` : ""}
          </p>
        </div>
        <ProgressRing percent={order.progress.percent} />
      </div>

      {order.previewImages.length > 0 ? (
        <div className="fulfillment-order-preview-row" aria-hidden="true">
          {order.previewImages.map((image) => (
            <div key={image} className="fulfillment-order-preview-thumb" style={{ backgroundImage: `url(${image})` }} />
          ))}
        </div>
      ) : null}

      <div className="fulfillment-stage-row">
        {(Object.keys(STAGE_META) as StageKey[]).map((stage) => {
          const stageProgress = order.progress.stages[stage];
          const complete = stageProgress.complete;
          const active = !complete && stageProgress.done < stageProgress.total && stageProgress.total > 0;
          return (
            <div
              key={stage}
              className={`fulfillment-stage-pill${complete ? " is-done" : active ? " is-active" : ""}`}
            >
              <span className="fulfillment-stage-icon" aria-hidden="true">
                {STAGE_META[stage].icon}
              </span>
              <span className="fulfillment-stage-copy">
                <strong>{STAGE_META[stage].label}</strong>
                <small>
                  {stageProgress.done}/{stageProgress.total}
                </small>
              </span>
            </div>
          );
        })}
      </div>

      <div className="fulfillment-order-card-foot">
        <span className={`fulfillment-status-badge status-${order.status}`}>{statusLabel(order.status)}</span>
        <span className="fulfillment-order-total">{formatInrPrice(String(order.total)) ?? `₹${order.total}`}</span>
      </div>

      {order.hasGiftSets ? (
        <p className="fulfillment-order-gift-tag">
          {order.giftSetCount} gift set{order.giftSetCount === 1 ? "" : "s"}
        </p>
      ) : null}
    </Link>
  );
}

function PendingTaskCard({ order }: { order: FulfillmentOrderSummary }) {
  const days = ageInDays(order.createdAt);
  const urgency = urgencyFor(days, order.progress.percent);
  return (
    <Link href={`/admin/orders/${order.id}`} className={`fulfillment-pending-card urgency-${urgency.level}`}>
      <div className="fulfillment-pending-main">
        <span className={`fulfillment-urgency-badge urgency-${urgency.level}`}>{urgency.label}</span>
        <div>
          <strong>{nextTask(order)}</strong>
          <p>{order.orderNumber} · {order.customerName || order.customerEmail}</p>
        </div>
      </div>
      <div className="fulfillment-pending-age">
        <strong>{days} day{days === 1 ? "" : "s"} overdue</strong>
        <span>{order.progress.done}/{order.progress.total} tasks complete · {order.progress.percent}%</span>
      </div>
    </Link>
  );
}

export default function FulfillmentBoardClient() {
  const [orders, setOrders] = useState<FulfillmentOrderSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [showDone, setShowDone] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform | null>(null);
  const [installPrompt, setInstallPrompt] = useState<PwaInstallPrompt | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installStatus, setInstallStatus] = useState("");
  const [installPreferenceLoaded, setInstallPreferenceLoaded] = useState(false);
  const [role, setRole] = useState<"admin" | "production" | "user" | null>(null);

  const rememberInstalledForAccount = useCallback(async () => {
    setIsInstalled(true);
    window.localStorage.setItem("maroma-production-pwa-installed", "1");
    await fetch("/api/auth/pwa-install", { method: "POST" }).catch(() => undefined);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/fulfillment?includeFulfilled=${showDone ? "1" : "0"}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        orders?: FulfillmentOrderSummary[];
        syncedAt?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load orders.");
      setOrders(data.orders ?? []);
      setSyncedAt(data.syncedAt ?? new Date().toISOString());
      setStatus(`${data.orders?.length ?? 0} active orders`);
      setSyncPulse(true);
      window.setTimeout(() => setSyncPulse(false), 600);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load orders.");
    }
  }, [showDone]);

  useEffect(() => {
    document.body.classList.add("fulfillment-board-active");
    return () => {
      document.body.classList.remove("fulfillment-board-active");
    };
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const locallyInstalled = standalone || window.localStorage.getItem("maroma-production-pwa-installed") === "1";
    setIsInstalled(locallyInstalled);
    void fetch("/api/auth/pwa-install", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { installed?: boolean }) => setIsInstalled((current) => current || Boolean(data.installed)))
      .finally(() => setInstallPreferenceLoaded(true));
    if (standalone) void rememberInstalledForAccount();

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as PwaInstallPrompt);
    };
    const markInstalled = () => { void rememberInstalledForAccount(); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, [rememberInstalledForAccount]);

  const installAndroidApp = useCallback(async () => {
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isChrome = /Chrome\//i.test(userAgent) && !/EdgA|OPR\//i.test(userAgent);

    if (!isAndroid) {
      window.location.href = "/admin/install";
      return;
    }

    if (!isChrome) {
      window.location.href = "/admin/install";
      return;
    }

    if (!installPrompt) {
      window.location.href = "/admin/install";
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallStatus("App installed!");
      await rememberInstalledForAccount();
    }
    setInstallPrompt(null);
  }, [installPrompt, rememberInstalledForAccount]);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { user?: { role?: "admin" | "production" | "user" } }) => setRole(data.user?.role ?? null));
    void loadOrders();
    const timer = window.setInterval(() => {
      void loadOrders();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw-production.js").catch(() => {
      // PWA is optional; ignore registration failures.
    });
  }, []);

  const activeCount = orders.filter((order) => order.status !== "fulfilled").length;
  const inProgress = orders.filter(
    (order) => order.progress.percent > 0 && order.progress.percent < 100 && order.status !== "fulfilled"
  ).length;
  const pendingOrders = orders
    .filter((order) => order.status !== "fulfilled" && ageInDays(order.createdAt) > 0)
    .sort((a, b) => {
      const urgencyDelta = urgencyFor(ageInDays(b.createdAt), b.progress.percent).level - urgencyFor(ageInDays(a.createdAt), a.progress.percent).level;
      return urgencyDelta || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  const currentOrders = orders.filter((order) => order.status === "fulfilled" || ageInDays(order.createdAt) === 0);

  return (
    <main className="fulfillment-board-page">
      <header className="fulfillment-board-header">
        <div>
          <p className="fulfillment-board-eyebrow">Maroma production</p>
          <h1>Fulfillment board</h1>
          <p className="fulfillment-board-subtitle">
            {activeCount} to work on · {inProgress} in progress
          </p>
        </div>
        <div className="fulfillment-board-header-actions">
          <span className={`fulfillment-sync-indicator${syncPulse ? " is-pulsing" : ""}`} role="status">
            <span className="fulfillment-sync-dot" aria-hidden="true" />
            Live
            {syncedAt ? ` · ${new Date(syncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </span>
          <Link href="/?skipIntro=1" className="fulfillment-toolbar-btn">
            Home
          </Link>
          {role === "admin" ? (
            <Link href="/admin/reports" className="fulfillment-toolbar-btn">
              Reports
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </header>

      {installPreferenceLoaded && !isInstalled ? (
        <section className="fulfillment-install-card" aria-labelledby="fulfillment-install-title">
          <div className="fulfillment-install-intro">
            <div>
              <p className="fulfillment-board-eyebrow">Quick access</p>
              <h2 id="fulfillment-install-title">Install this app</h2>
            </div>
            <span>Choose your phone</span>
          </div>
          <div className="fulfillment-install-platforms" role="group" aria-label="Choose phone type">
            <button
              type="button"
              className={`fulfillment-install-platform${installPlatform === "android" ? " is-active" : ""}`}
              onClick={() => { setInstallPlatform("android"); setInstallStatus(""); }}
            >
              Android
            </button>
            <button
              type="button"
              className={`fulfillment-install-platform${installPlatform === "iphone" ? " is-active" : ""}`}
              onClick={() => { setInstallPlatform("iphone"); setInstallStatus(""); }}
            >
              iPhone
            </button>
          </div>
          {installPlatform === "android" ? (
            <div className="fulfillment-install-instructions">
              <button type="button" className="fulfillment-install-action" onClick={() => void installAndroidApp()}>
                Install app
              </button>
              <p>{installStatus || (installPrompt ? "Tap once, then confirm Install in Chrome." : "This button opens the page in Chrome, where you can install the app.")}</p>
            </div>
          ) : null}
          {installPlatform === "iphone" ? (
            <div className="fulfillment-install-instructions">
              <ol>
                <li>Open this page in <strong>Safari</strong>.</li>
                <li>Tap <strong>Share</strong> <span aria-hidden="true">□↑</span>.</li>
                <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="fulfillment-board-toolbar">
        <button
          type="button"
          className={`fulfillment-filter-btn${!showDone ? " is-active" : ""}`}
          onClick={() => setShowDone(false)}
        >
          Active
        </button>
        <button
          type="button"
          className={`fulfillment-filter-btn${showDone ? " is-active" : ""}`}
          onClick={() => setShowDone(true)}
        >
          Include shipped
        </button>
        <p className="fulfillment-board-status">{status}</p>
      </div>

      <div className="fulfillment-legend" aria-label="Stage legend">
        {(Object.keys(STAGE_META) as StageKey[]).map((stage) => (
          <div key={stage} className="fulfillment-legend-item">
            <span className="fulfillment-stage-icon" aria-hidden="true">
              {STAGE_META[stage].icon}
            </span>
            <span>
              <strong>{STAGE_META[stage].label}</strong> — {STAGE_META[stage].hint}
            </span>
          </div>
        ))}
      </div>

      {pendingOrders.length > 0 ? (
        <section className="fulfillment-pending-section" aria-labelledby="pending-tasks-title">
          <header className="fulfillment-pending-header">
            <div>
              <p className="fulfillment-board-eyebrow">Carry-over work</p>
              <h2 id="pending-tasks-title">Pending from previous days</h2>
            </div>
            <span>{pendingOrders.length} overdue order{pendingOrders.length === 1 ? "" : "s"}</span>
          </header>
          <div className="fulfillment-pending-list">
            {pendingOrders.map((order) => <PendingTaskCard key={order.id} order={order} />)}
          </div>
        </section>
      ) : null}

      {orders.length === 0 ? (
        <section className="fulfillment-empty">
          <p className="fulfillment-empty-icon" aria-hidden="true">
            ✧
          </p>
          <h2>Nothing to pack right now</h2>
          <p>New orders will appear here automatically.</p>
        </section>
      ) : (
        <section className="fulfillment-order-grid" aria-label="Today's orders queue">
          {currentOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </section>
      )}
    </main>
  );
}
