"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "../../components/SignOutButton";
import { formatInrPrice } from "../../../lib/format-price";
import type { FulfillmentOrderSummary } from "../../../lib/commerce-fulfillment";

const POLL_MS = 4000;

type StageKey = "prepare" | "pack" | "ship";

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

export default function FulfillmentBoardClient() {
  const [orders, setOrders] = useState<FulfillmentOrderSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [showDone, setShowDone] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);

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
          <Link href="/admin" className="fulfillment-toolbar-btn">
            Admin
          </Link>
          <SignOutButton />
        </div>
      </header>

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

      {orders.length === 0 ? (
        <section className="fulfillment-empty">
          <p className="fulfillment-empty-icon" aria-hidden="true">
            ✧
          </p>
          <h2>Nothing to pack right now</h2>
          <p>New orders will appear here automatically.</p>
        </section>
      ) : (
        <section className="fulfillment-order-grid" aria-label="Orders queue">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </section>
      )}
    </main>
  );
}
