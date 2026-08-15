"use client";

type NetworkConnection = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function readConnection(): NetworkConnection | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/** True when the browser reports a constrained / data-saver link. */
export function isNetworkConstrained(connection: NetworkConnection | null = readConnection()): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  const type = (connection.effectiveType ?? "").toLowerCase();
  if (type === "slow-2g" || type === "2g" || type === "3g") return true;
  if (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < 1.5) {
    return true;
  }
  if (typeof connection.rtt === "number" && connection.rtt >= 500) {
    return true;
  }
  return false;
}

export function subscribeNetworkConnection(onChange: () => void): () => void {
  const connection = readConnection();
  if (!connection?.addEventListener) {
    return () => undefined;
  }
  connection.addEventListener("change", onChange);
  return () => connection.removeEventListener?.("change", onChange);
}

export { readConnection };
export type { NetworkConnection };
