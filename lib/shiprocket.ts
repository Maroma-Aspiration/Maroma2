import { kv } from "@vercel/kv";
import type { OrderRecord } from "./commerce-types";

const API = "https://apiv2.shiprocket.in/v1/external";
const statePrefix = "maroma:shiprocket:";
const configured = () => Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD && process.env.SHIPROCKET_PICKUP_LOCATION);

export type ShiprocketState = { orderId?: number; shipmentId?: number; awb?: string; courier?: string; status?: string; labelUrl?: string; pickupScheduled?: boolean; updatedAt?: string };

async function token() {
  const response = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }), cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error(data.message || "Shiprocket authentication failed.");
  return String(data.token);
}

async function call(path: string, init: RequestInit = {}) {
  const auth = await token();
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}`, ...(init.headers || {}) }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Shiprocket request failed (${response.status}).`);
  return data;
}

export async function getShiprocketState(orderId: string): Promise<ShiprocketState> { return (await kv.get<ShiprocketState>(`${statePrefix}${orderId}`)) || {}; }
async function save(orderId: string, patch: ShiprocketState) { const next = { ...(await getShiprocketState(orderId)), ...patch, updatedAt: new Date().toISOString() }; await kv.set(`${statePrefix}${orderId}`, next); return next; }
export function shiprocketSetup() { return { configured: configured(), pickupLocation: configured() ? process.env.SHIPROCKET_PICKUP_LOCATION : undefined } as const; }

export async function createShiprocketOrder(order: OrderRecord, parcel?: { weight?: number; length?: number; breadth?: number; height?: number }) {
  if (!configured()) throw new Error("Shiprocket setup required. Add API email, password, and pickup location in Vercel.");
  const existing = await getShiprocketState(order.id); if (existing.shipmentId) return existing;
  const address = order.shipping;
  const data = await call("/orders/create/adhoc", { method: "POST", body: JSON.stringify({
    order_id: order.orderNumber.replace(/[^A-Za-z0-9-]/g, "-"), order_date: order.createdAt.slice(0, 19).replace("T", " "), pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: address.firstName, billing_last_name: address.lastName, billing_address: address.address, billing_city: address.city, billing_pincode: Number(address.pincode), billing_state: address.state, billing_country: address.country || "India", billing_email: address.email || order.customerEmail, billing_phone: address.phone, shipping_is_billing: true,
    order_items: order.lines.map((line) => ({ name: line.name, sku: line.sku || line.productId, units: line.quantity, selling_price: line.price, discount: 0, tax: 0 })), payment_method: "Prepaid", shipping_charges: order.shippingInr, total_discount: order.discountAmount, sub_total: order.total,
    length: parcel?.length || Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM || 20), breadth: parcel?.breadth || Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM || 15), height: parcel?.height || Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM || 10), weight: parcel?.weight || Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG || 0.5),
  }) });
  return save(order.id, { orderId: Number(data.order_id), shipmentId: Number(data.shipment_id), status: "Order created" });
}

export async function assignShiprocketAwb(localOrderId: string, courierId?: number) { const state = await getShiprocketState(localOrderId); if (!state.shipmentId) throw new Error("Create the Shiprocket order first."); const data = await call("/courier/assign/awb", { method: "POST", body: JSON.stringify({ shipment_id: state.shipmentId, ...(courierId ? { courier_id: courierId } : {}) }) }); const response = data.response?.data || data; return save(localOrderId, { awb: String(response.awb_code || response.awb || ""), courier: response.courier_name, status: "AWB assigned" }); }
export async function scheduleShiprocketPickup(localOrderId: string) { const state = await getShiprocketState(localOrderId); if (!state.shipmentId) throw new Error("Create the shipment first."); await call("/courier/generate/pickup", { method: "POST", body: JSON.stringify({ shipment_id: [state.shipmentId] }) }); return save(localOrderId, { pickupScheduled: true, status: "Pickup scheduled" }); }
export async function generateShiprocketLabel(localOrderId: string) { const state = await getShiprocketState(localOrderId); if (!state.shipmentId) throw new Error("Create the shipment first."); const data = await call("/courier/generate/label", { method: "POST", body: JSON.stringify({ shipment_id: [state.shipmentId] }) }); return save(localOrderId, { labelUrl: data.label_url || data.label_created || data.response?.label_url, status: "Label generated" }); }
export async function refreshShiprocketTracking(localOrderId: string) { const state = await getShiprocketState(localOrderId); if (!state.awb) throw new Error("Assign an AWB first."); const data = await call(`/courier/track/awb/${encodeURIComponent(state.awb)}`); const tracking = data.tracking_data || data; return save(localOrderId, { status: tracking.shipment_status || tracking.track_status || state.status }); }
