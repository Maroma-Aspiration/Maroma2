"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { SignOutButton } from "../../components/SignOutButton";

type Report = {
  summary: { revenue: number; orders: number; units: number; products: number; availableUnits: number; lowStock: number; outOfStock: number };
  daily: { date: string; revenue: number; orders: number }[];
  lowStock: { id: string; name: string; sku: string; stock: number; category: string }[];
  topProducts: { name: string; units: number; revenue: number }[];
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const iso = (date: Date) => date.toISOString().slice(0, 10);

function datesFor(preset: string) {
  const end = new Date(); const start = new Date(end);
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else if (preset === "week") start.setDate(end.getDate() - 6);
  else if (preset === "month") start.setDate(end.getDate() - 29);
  else if (preset === "quarter") start.setDate(end.getDate() - 89);
  else start.setFullYear(end.getFullYear(), 0, 1);
  return { from: iso(start), to: iso(end) };
}

export default function ReportsClient() {
  const initial = datesFor("month");
  const [preset, setPreset] = useState("month"); const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await fetch(`/api/admin/reports?from=${from}&to=${to}`, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Unable to load reports."); setReport(data); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports."); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const maxRevenue = useMemo(() => Math.max(1, ...(report?.daily.map((d) => d.revenue) || [1])), [report]);
  const exportCsv = () => {
    if (!report) return;
    const rows = [["Maroma sales report", `${from} to ${to}`], [], ["Date", "Orders", "Revenue INR"], ...report.daily.map((d) => [d.date, d.orders, d.revenue]), [], ["Low stock product", "SKU", "Category", "Available"], ...report.lowStock.map((p) => [p.name, p.sku, p.category, p.stock])];
    const escapeCsv = (value: unknown) => JSON.stringify(String(value ?? ""));
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `maroma-report-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const applyPreset = (value: string) => { setPreset(value); if (value !== "custom") { const dates = datesFor(value); setFrom(dates.from); setTo(dates.to); } };
  return <main className="reports-page"><div className="reports-shell">
    <header className="reports-header"><div><p>MAROMA COMMERCE</p><h1>Stock & sales reports</h1><span>Live business health at a glance</span></div><nav><Link href="/">Home</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><SignOutButton /></nav></header>
    <section className="reports-controls"><label>Time period<select value={preset} onChange={(e) => applyPreset(e.target.value)}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option><option value="quarter">Last 90 days</option><option value="year">This year</option><option value="custom">Custom dates</option></select></label><label>From<input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></label><label>To<input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></label><button onClick={() => void load()}>Refresh</button><button className="export" onClick={exportCsv}>Download CSV</button><button className="export" onClick={() => window.print()}>Download PDF</button></section>
    {error ? <p className="reports-error">{error}</p> : null}{loading && !report ? <p className="reports-loading">Preparing your report…</p> : null}
    {report ? <>
      <section className="report-kpis"><article><span>Sales</span><strong>{money.format(report.summary.revenue)}</strong><small>{report.summary.orders} completed orders</small></article><article><span>Units sold</span><strong>{report.summary.units.toLocaleString()}</strong><small>within selected period</small></article><article><span>Available stock</span><strong>{report.summary.availableUnits.toLocaleString()}</strong><small>across {report.summary.products.toLocaleString()} products</small></article><article className={report.summary.lowStock + report.summary.outOfStock ? "warning" : "healthy"}><span>Stock attention</span><strong>{report.summary.lowStock + report.summary.outOfStock}</strong><small>{report.summary.lowStock} low · {report.summary.outOfStock} out</small></article></section>
      <section className="reports-grid"><article className="report-panel report-sales"><header><div><p>SALES TREND</p><h2>Revenue by day</h2></div><strong>{money.format(report.summary.revenue)}</strong></header>{report.daily.length ? <div className="sales-chart" aria-label="Daily revenue chart">{report.daily.map((day) => <div className="sales-bar-wrap" key={day.date} title={`${day.date}: ${money.format(day.revenue)}`}><span>{day.revenue ? money.format(day.revenue) : ""}</span><div className="sales-bar" style={{ height: `${Math.max(4, day.revenue / maxRevenue * 100)}%` }} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></div>)}</div> : <div className="report-empty">No completed sales in this period.</div>}</article>
      <article className="report-panel"><header><div><p>INVENTORY HEALTH</p><h2>Stock position</h2></div></header><div className="stock-visual"><div className="stock-ring" style={{ "--healthy": `${report.summary.products ? ((report.summary.products-report.summary.lowStock-report.summary.outOfStock)/report.summary.products)*360 : 0}deg` } as CSSProperties}><span>{report.summary.products ? Math.round(((report.summary.products-report.summary.lowStock-report.summary.outOfStock)/report.summary.products)*100) : 0}%<small>healthy</small></span></div><ul><li><i className="good" />Healthy <b>{report.summary.products-report.summary.lowStock-report.summary.outOfStock}</b></li><li><i className="low" />Low <b>{report.summary.lowStock}</b></li><li><i className="out" />Out <b>{report.summary.outOfStock}</b></li></ul></div></article>
      <article className="report-panel"><header><div><p>BEST SELLERS</p><h2>Top products</h2></div></header><ol className="top-products">{report.topProducts.length ? report.topProducts.map((p, i) => <li key={p.name}><b>{i+1}</b><span>{p.name}<small>{money.format(p.revenue)}</small></span><strong>{p.units} units</strong></li>) : <li className="report-empty">No product sales yet.</li>}</ol></article>
      <article className="report-panel"><header><div><p>REORDER WATCH</p><h2>Low stock items</h2></div><Link href="/admin/products?status=low_stock">Manage stock</Link></header>{report.lowStock.length ? <div className="low-stock-list">{report.lowStock.map((p) => <Link href={`/admin/products/${p.id}`} key={p.id}><span>{p.name}<small>{p.sku} · {p.category}</small></span><strong>{p.stock}</strong></Link>)}</div> : <div className="report-empty report-healthy">All products are comfortably stocked.</div>}</article></section>
    </> : null}
  </div></main>;
}
