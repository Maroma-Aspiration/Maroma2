"use client";

import Link from "next/link";
import { useEffect } from "react";
import { GiftCardPreview } from "../../../../components/GiftCardPreview";
import { formatInrPrice } from "../../../../../lib/format-price";
import type { ProductionGiftSetLine } from "../../../../../lib/gift-set-production";
import { giftSetCategoryLabel } from "../../../../../lib/gift-set-production";
import type { OrderLineSnapshot, OrderRecord } from "../../../../../lib/commerce-types";
import type { GiftCardPreset } from "../../../../../lib/gift-builder-types";

type ProductionSheetClientProps = {
  order: OrderRecord;
  giftSets: ProductionGiftSetLine[];
  regularLines: OrderLineSnapshot[];
  autoPrint?: boolean;
  productionView: boolean;
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

export default function ProductionSheetClient({
  order,
  giftSets,
  regularLines,
  autoPrint = false,
  productionView,
}: ProductionSheetClientProps) {
  useEffect(() => {
    document.body.classList.add("production-sheet-active");
    return () => {
      document.body.classList.remove("production-sheet-active");
    };
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const formatMoney = (amount: number) => formatInrPrice(String(amount)) ?? `₹${amount}`;

  const customerName = `${order.shipping.firstName} ${order.shipping.lastName}`.trim();
  const placedAt = new Date(order.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalSets = giftSets.reduce((sum, set) => sum + set.quantity, 0);

  return (
    <div className={`production-sheet${productionView ? " production-sheet--production-view" : ""}`}>
      <div className="production-sheet-toolbar no-print">
        <Link href="/admin/orders" className="production-sheet-toolbar-link">
          ← Back to board
        </Link>
        <div className="production-sheet-toolbar-actions">
          <button type="button" className="maroma-btn maroma-btn-primary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        </div>
      </div>

      <article className="production-sheet-document">
        <header className="production-sheet-header">
          <p className="production-sheet-eyebrow">Maroma production instructions</p>
          <h1>Order {order.orderNumber}</h1>
          <p className="production-sheet-meta">
            Placed {placedAt} · Status: <strong>{order.status.replace("_", " ")}</strong> ·{" "}
            {totalSets} gift set{totalSets === 1 ? "" : "s"} to make
          </p>
        </header>

        <section className="production-sheet-ship" aria-label="Shipping details">
          <h2>Ship to</h2>
          <div className="production-sheet-ship-grid">
            <div>
              <p className="production-sheet-label">Customer</p>
              <p className="production-sheet-value">{customerName || "—"}</p>
            </div>
            <div>
              <p className="production-sheet-label">Phone</p>
              <p className="production-sheet-value">{order.shipping.phone}</p>
            </div>
            <div>
              <p className="production-sheet-label">Email</p>
              <p className="production-sheet-value">{order.shipping.email}</p>
            </div>
            <div className="production-sheet-ship-full">
              <p className="production-sheet-label">Delivery address</p>
              <p className="production-sheet-value">
                {order.shipping.address}
                <br />
                {order.shipping.city}
                {order.shipping.state ? `, ${order.shipping.state}` : ""} {order.shipping.pincode}
                {order.shipping.country ? (
                  <>
                    <br />
                    {order.shipping.country}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </section>

        {giftSets.map((set) => {
          const copies = Array.from({ length: set.quantity }, (_, copyIndex) => (
            <section
              key={`${set.lineIndex}-${copyIndex}`}
              className="production-sheet-set"
              aria-label={`${set.setName} copy ${copyIndex + 1}`}
            >
              <div className="production-sheet-set-head">
                <div>
                  <h2>{set.setName}</h2>
                  {set.quantity > 1 ? (
                    <p className="production-sheet-copy-label">
                      Copy {copyIndex + 1} of {set.quantity}
                    </p>
                  ) : null}
                </div>
                <div className="production-sheet-set-meta">
                  <span>{set.box.name} box</span>
                  <span>{set.box.slotCount} slots</span>
                  <span>{formatMoney(set.unitPrice)}</span>
                </div>
              </div>

              <ol className="production-sheet-checklist">
                <li className="production-sheet-checklist-title">Pack these elements into the box:</li>
                {set.elements.map((element) => (
                  <li key={`${element.id}-${element.slot}`} className="production-sheet-element">
                    <label className="production-sheet-checkbox">
                      <input type="checkbox" readOnly aria-label={`Slot ${element.slot}: ${element.name}`} />
                      <span className="production-sheet-checkbox-box" aria-hidden />
                    </label>
                    {element.image ? (
                      <img src={element.image} alt="" className="production-sheet-element-img" />
                    ) : null}
                    <div className="production-sheet-element-body">
                      <strong>
                        Slot {element.slot}: {element.name}
                      </strong>
                      <span>
                        {giftSetCategoryLabel(element.category)} · SKU {element.sku}
                      </span>
                    </div>
                  </li>
                ))}
                <li className="production-sheet-checklist-title">Box &amp; card:</li>
                <li className="production-sheet-element production-sheet-element--plain">
                  <label className="production-sheet-checkbox">
                    <input type="checkbox" readOnly aria-label="Box packed and sealed" />
                    <span className="production-sheet-checkbox-box" aria-hidden />
                  </label>
                  <div className="production-sheet-element-body">
                    <strong>Seal {set.box.name} box after packing</strong>
                    <span>Label with set name: {set.setName}</span>
                  </div>
                </li>
              </ol>

              {set.card ? (
                <div className="production-sheet-card">
                  <h3>Handwrite greeting card · {set.card.name}</h3>
                  <p className="production-sheet-card-note">
                    Write the message below inside the card. Check spelling before sealing.
                  </p>
                  <div className="production-sheet-card-layout">
                    <GiftCardPreview
                      preset={cardPresetFromProduction(set.card)}
                      message={set.card.message}
                    />
                    <blockquote className="production-sheet-handwrite">
                      <p className="production-sheet-handwrite-label">Message to handwrite</p>
                      <p className="production-sheet-handwrite-text">&ldquo;{set.card.message}&rdquo;</p>
                    </blockquote>
                  </div>
                  <label className="production-sheet-checkbox production-sheet-checkbox--inline">
                    <input type="checkbox" readOnly aria-label="Greeting card completed" />
                    <span className="production-sheet-checkbox-box" aria-hidden />
                    <span>Card written, checked, and placed in box</span>
                  </label>
                </div>
              ) : (
                <p className="production-sheet-no-card">No greeting card for this set.</p>
              )}
            </section>
          ));

          return <div key={set.lineIndex}>{copies}</div>;
        })}

        {regularLines.length > 0 ? (
          <section className="production-sheet-other" aria-label="Other order items">
            <h2>Also pack with this shipment</h2>
            <ul>
              {regularLines.map((line, index) => (
                <li key={`${line.productId}-${index}`}>
                  <label className="production-sheet-checkbox production-sheet-checkbox--inline">
                    <input type="checkbox" readOnly aria-label={line.name} />
                    <span className="production-sheet-checkbox-box" aria-hidden />
                    <span>
                      {line.name} × {line.quantity}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="production-sheet-footer-checklist" aria-label="Final dispatch checklist">
          <h2>Dispatch checklist</h2>
          <ul>
            <li>
              <label className="production-sheet-checkbox production-sheet-checkbox--inline">
                <input type="checkbox" readOnly />
                <span className="production-sheet-checkbox-box" aria-hidden />
                <span>All gift sets packed and quality checked</span>
              </label>
            </li>
            <li>
              <label className="production-sheet-checkbox production-sheet-checkbox--inline">
                <input type="checkbox" readOnly />
                <span className="production-sheet-checkbox-box" aria-hidden />
                <span>Shipping label applied with correct address</span>
              </label>
            </li>
            <li>
              <label className="production-sheet-checkbox production-sheet-checkbox--inline">
                <input type="checkbox" readOnly />
                <span className="production-sheet-checkbox-box" aria-hidden />
                <span>Order marked fulfilled in admin</span>
              </label>
            </li>
          </ul>
          <p className="production-sheet-footer-note">
            Order total: {formatMoney(order.total)} · {order.orderNumber}
          </p>
        </section>
      </article>
    </div>
  );
}
