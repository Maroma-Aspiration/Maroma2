"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GiftCardPreview } from "../../../components/GiftCardPreview";
import { formatInrPrice } from "../../../../lib/format-price";
import type {
  FulfillmentChecklistItem,
  FulfillmentOrderDetail,
  FulfillmentStage,
} from "../../../../lib/commerce-fulfillment";
import { giftSetCategoryLabel } from "../../../../lib/gift-set-production";
import type { GiftCardPreset } from "../../../../lib/gift-builder-types";
import type { ProductionGiftSetLine } from "../../../../lib/gift-set-production";

const POLL_MS = 4000;

const STAGE_META: Record<FulfillmentStage, { icon: string; title: string }> = {
  prepare: { icon: "✦", title: "Prepare — pick items" },
  pack: { icon: "▣", title: "Pack — box, card & extras" },
  ship: { icon: "→", title: "Ship — label & handoff" },
};

type FulfillmentOrderClientProps = {
  orderId: string;
};

function cardPresetFromProduction(
  card: NonNullable<ProductionGiftSetLine["card"]>
): GiftCardPreset {
  return {
    id: card.id,
    name: card.name,
    description: "",
    suggestedMessage: card.message,
    price: 0,
    style: card.style as GiftCardPreset["style"],
  };
}

function ChecklistButton({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: FulfillmentChecklistItem;
  checked: boolean;
  disabled?: boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`fulfillment-check-item${checked ? " is-done" : ""}`}
      onClick={() => onToggle(item.key, !checked)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="fulfillment-check-box" aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
      {item.image ? (
        <span className="fulfillment-check-thumb" style={{ backgroundImage: `url(${item.image})` }} aria-hidden="true" />
      ) : (
        <span className="fulfillment-check-thumb fulfillment-check-thumb--plain" aria-hidden="true" />
      )}
      <span className="fulfillment-check-copy">
        <strong>{item.label}</strong>
        {item.sublabel ? <small>{item.sublabel}</small> : null}
        {item.setName ? (
          <span className="fulfillment-check-set">
            {item.setName}
            {item.copyLabel ? ` · ${item.copyLabel}` : ""}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function FulfillmentOrderClient({ orderId }: FulfillmentOrderClientProps) {
  const [detail, setDetail] = useState<FulfillmentOrderDetail | null>(null);
  const [status, setStatus] = useState("Loading order…");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [markingFulfilled, setMarkingFulfilled] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/fulfillment/${orderId}`, { cache: "no-store" });
      const data = (await res.json()) as FulfillmentOrderDetail & { error?: string; syncedAt?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load order.");
      setDetail(data);
      setSyncedAt(data.syncedAt ?? new Date().toISOString());
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load order.");
    }
  }, [orderId]);

  useEffect(() => {
    document.body.classList.add("fulfillment-board-active");
    return () => {
      document.body.classList.remove("fulfillment-board-active");
    };
  }, []);

  useEffect(() => {
    void loadDetail();
    const timer = window.setInterval(() => {
      void loadDetail();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadDetail]);

  const toggleItem = async (key: string, checked: boolean) => {
    if (busyKey) return;
    setBusyKey(key);

    const previous = detail;
    if (detail) {
      const nextChecked = { ...detail.checked, [key]: checked };
      if (!checked) delete nextChecked[key];
      setDetail({
        ...detail,
        checked: nextChecked,
      });
    }

    try {
      const res = await fetch(`/api/admin/fulfillment/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, checked }),
      });
      const data = (await res.json()) as FulfillmentOrderDetail & { error?: string; syncedAt?: string };
      if (!res.ok) throw new Error(data.error || "Update failed.");
      setDetail(data);
      setSyncedAt(data.syncedAt ?? new Date().toISOString());
    } catch (err) {
      setDetail(previous);
      setStatus(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const markFulfilled = async () => {
    if (markingFulfilled || !detail) return;
    setMarkingFulfilled(true);
    try {
      const res = await fetch(`/api/admin/fulfillment/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markFulfilled: true }),
      });
      const data = (await res.json()) as FulfillmentOrderDetail & { error?: string; syncedAt?: string };
      if (!res.ok) throw new Error(data.error || "Could not mark shipped.");
      setDetail(data);
      setSyncedAt(data.syncedAt ?? new Date().toISOString());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not mark shipped.");
    } finally {
      setMarkingFulfilled(false);
    }
  };

  const groupedChecklist = useMemo(() => {
    if (!detail) return {} as Record<FulfillmentStage, FulfillmentChecklistItem[]>;
    const groups: Record<FulfillmentStage, FulfillmentChecklistItem[]> = {
      prepare: [],
      pack: [],
      ship: [],
    };
    for (const item of detail.checklist) {
      groups[item.stage].push(item);
    }
    return groups;
  }, [detail]);

  if (!detail) {
    return (
      <main className="fulfillment-order-page">
        <p className="fulfillment-board-status">{status}</p>
      </main>
    );
  }

  const customerName = `${detail.order.shipping.firstName} ${detail.order.shipping.lastName}`.trim();
  const allDone = detail.progress.percent === 100;

  return (
    <main className="fulfillment-order-page">
      <header className="fulfillment-order-header">
        <div className="fulfillment-order-header-main">
          <Link href="/admin/orders" className="fulfillment-back-link">
            ← Board
          </Link>
          <div>
            <p className="fulfillment-board-eyebrow">Order</p>
            <h1>{detail.orderNumber}</h1>
            <p className="fulfillment-order-header-meta">
              {customerName || detail.customerEmail}
              {detail.order.shipping.city ? ` · ${detail.order.shipping.city}` : ""}
            </p>
          </div>
        </div>
        <div className="fulfillment-order-header-side">
          <div className="fulfillment-order-progress-block">
            <span className="fulfillment-order-progress-value">{detail.progress.percent}%</span>
            <span className="fulfillment-order-progress-caption">
              {detail.progress.done}/{detail.progress.total} done
            </span>
          </div>
          {syncedAt ? (
            <p className="fulfillment-sync-caption">
              Synced {new Date(syncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          ) : null}
        </div>
      </header>

      {status ? <p className="fulfillment-board-status" role="alert">{status}</p> : null}

      <section className="fulfillment-ship-card" aria-label="Ship to">
        <h2>Ship to</h2>
        <div className="fulfillment-ship-grid">
          <div>
            <p className="fulfillment-ship-label">Name</p>
            <p>{customerName || "—"}</p>
          </div>
          <div>
            <p className="fulfillment-ship-label">Phone</p>
            <p>{detail.order.shipping.phone}</p>
          </div>
          <div className="fulfillment-ship-full">
            <p className="fulfillment-ship-label">Address</p>
            <p>
              {detail.order.shipping.address}
              <br />
              {detail.order.shipping.city}
              {detail.order.shipping.state ? `, ${detail.order.shipping.state}` : ""} {detail.order.shipping.pincode}
              {detail.order.shipping.country ? (
                <>
                  <br />
                  {detail.order.shipping.country}
                </>
              ) : null}
            </p>
          </div>
        </div>
      </section>

      {detail.giftSets.map((set) => (
        <section key={set.lineIndex} className="fulfillment-gift-set-panel">
          <header className="fulfillment-gift-set-head">
            <div>
              <h2>{set.setName}</h2>
              <p>
                {set.box.name} · {set.box.slotCount} slots · Qty {set.quantity}
              </p>
            </div>
            <span className="fulfillment-gift-set-price">
              {formatInrPrice(String(set.unitPrice)) ?? `₹${set.unitPrice}`}
            </span>
          </header>

          {set.card ? (
            <div className="fulfillment-card-preview-block">
              <h3>Card message</h3>
              <div className="fulfillment-card-preview-layout">
                <GiftCardPreview preset={cardPresetFromProduction(set.card)} message={set.card.message} />
                <blockquote className="fulfillment-card-quote">&ldquo;{set.card.message}&rdquo;</blockquote>
              </div>
            </div>
          ) : null}

          <div className="fulfillment-elements-grid" aria-label="Gift set elements">
            {set.elements.map((element) => (
              <div key={element.id} className="fulfillment-element-card">
                {element.image ? (
                  <img src={element.image} alt="" className="fulfillment-element-image" />
                ) : null}
                <div>
                  <strong>{element.name}</strong>
                  <p>
                    Slot {element.slot} · {giftSetCategoryLabel(element.category)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {(Object.keys(STAGE_META) as FulfillmentStage[]).map((stage) => {
        const items = groupedChecklist[stage];
        if (items.length === 0) return null;
        const stageProgress = detail.progress.stages[stage];
        return (
          <section key={stage} className={`fulfillment-stage-section stage-${stage}`}>
            <header className="fulfillment-stage-section-head">
              <span className="fulfillment-stage-icon" aria-hidden="true">
                {STAGE_META[stage].icon}
              </span>
              <div>
                <h2>{STAGE_META[stage].title}</h2>
                <p>
                  {stageProgress.done}/{stageProgress.total} complete
                </p>
              </div>
              {stageProgress.complete ? <span className="fulfillment-stage-done-badge">Done</span> : null}
            </header>
            <div className="fulfillment-checklist">
              {items.map((item) => (
                <ChecklistButton
                  key={item.key}
                  item={item}
                  checked={Boolean(detail.checked[item.key])}
                  disabled={busyKey === item.key}
                  onToggle={toggleItem}
                />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="fulfillment-order-footer">
        <div>
          <p className="fulfillment-order-total-label">Order total</p>
          <p className="fulfillment-order-total-value">
            {formatInrPrice(String(detail.total)) ?? `₹${detail.total}`}
          </p>
        </div>
        <div className="fulfillment-order-footer-actions">
          <Link href={`/admin/orders/${orderId}/production?print=1`} className="fulfillment-toolbar-btn">
            Print sheet
          </Link>
          <button
            type="button"
            className="fulfillment-primary-btn"
            disabled={!allDone || detail.status === "fulfilled" || markingFulfilled}
            onClick={() => void markFulfilled()}
          >
            {detail.status === "fulfilled"
              ? "Shipped"
              : markingFulfilled
                ? "Saving…"
                : allDone
                  ? "Mark shipped"
                  : "Complete all steps first"}
          </button>
        </div>
      </footer>
    </main>
  );
}
