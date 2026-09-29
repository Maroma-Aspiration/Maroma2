"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "../../components/SignOutButton";
import { formatInrPrice } from "../../../lib/format-price";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  lineCount: number;
  customerEmail: string;
  hasGiftSets?: boolean;
};

export default function AdminOrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [status, setStatus] = useState("Loading orders…");
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponValue, setCouponValue] = useState("10");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = (await res.json()) as { orders?: OrderSummary[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load orders.");
      setOrders(data.orders ?? []);
      setStatus(`${data.orders?.length ?? 0} orders`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load orders.");
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, nextStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed.");
      await loadOrders();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const createCoupon = async () => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          type: couponType,
          value: Number(couponValue),
          active: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save coupon.");
      setStatus(`Coupon ${couponCode.toUpperCase()} saved.`);
      setCouponCode("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save coupon.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" style={{ maxWidth: 960, width: "100%" }}>
        <p className="login-eyebrow">Commerce</p>
        <h1 className="login-title">Orders</h1>
        <p className="login-reason">{status}</p>

        <div className="login-actions-row" style={{ marginBottom: 24 }}>
          <Link href="/admin" className="button secondary">
            ← Site admin
          </Link>
          <Link href="/admin/products" className="button secondary">
            Products
          </Link>
          <Link href="/admin/marketing" className="button secondary">
            Marketing
          </Link>
          <SignOutButton />
        </div>

        <div className="maroma-admin-coupon-form" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Create promo code</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="CODE"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <select value={couponType} onChange={(e) => setCouponType(e.target.value as "percent" | "fixed")}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed INR off</option>
            </select>
            <input
              type="number"
              min="1"
              value={couponValue}
              onChange={(e) => setCouponValue(e.target.value)}
              style={{ width: 80 }}
            />
            <button type="button" className="button primary button-sage" onClick={() => void createCoupon()}>
              Save coupon
            </button>
          </div>
        </div>

        <div className="maroma-admin-coupon-form" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Export orders (Excel / CSV)</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label>
              From
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <button
              type="button"
              className="button primary button-sage"
              onClick={() => {
                const params = new URLSearchParams();
                if (fromDate) params.set("from", fromDate);
                if (toDate) params.set("to", toDate);
                if (selectedIds.length) params.set("ids", selectedIds.join(","));
                window.location.href = `/api/admin/orders/export?${params.toString()}`;
              }}
            >
              Export {selectedIds.length ? "selected" : "range"}
            </button>
            {selectedIds.length ? (
              <button type="button" className="button secondary" onClick={() => setSelectedIds([])}>
                Clear selection
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th align="left">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? orders.map((o) => o.id) : [])}
                    aria-label="Select all orders"
                  />
                </th>
                <th align="left">Order</th>
                <th align="left">Customer</th>
                <th align="left">Status</th>
                <th align="right">Total</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderTop: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={(e) =>
                        setSelectedIds((current) =>
                          e.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id)
                        )
                      }
                      aria-label={`Select ${order.orderNumber}`}
                    />
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <strong>{order.orderNumber}</strong>
                    <br />
                    <small>{new Date(order.createdAt).toLocaleString("en-IN")}</small>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    {order.customerEmail}
                    <br />
                    <small>{order.lineCount} items</small>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{order.status.replace("_", " ")}</td>
                  <td align="right" style={{ padding: "10px 8px" }}>
                    {formatInrPrice(String(order.total)) ?? `₹${order.total}`}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    {order.status === "pending_payment" ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void updateOrderStatus(order.id, "paid")}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {order.status === "paid" ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void updateOrderStatus(order.id, "fulfilled")}
                      >
                        Mark fulfilled
                      </button>
                    ) : null}
                    {order.hasGiftSets ? (
                      <>
                        <br />
                        <Link
                          href={`/admin/orders/${order.id}/production`}
                          className="button secondary"
                          style={{ marginTop: 6, display: "inline-block" }}
                        >
                          Production sheet
                        </Link>
                        <br />
                        <Link
                          href={`/admin/orders/${order.id}/production?print=1`}
                          className="button secondary"
                          style={{ marginTop: 6, display: "inline-block", fontSize: "0.82rem" }}
                        >
                          Print / PDF
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
