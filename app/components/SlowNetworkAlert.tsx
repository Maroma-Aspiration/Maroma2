"use client";

import { useEffect, useRef, useState } from "react";
import { isNetworkConstrained, subscribeNetworkConnection } from "../../lib/slow-network";

/** Show alert if a request is still in flight after this many ms. */
const SLOW_REQUEST_MS = 2500;

type FetchMeta = { timer: number; slowFired: boolean };

/**
 * Site-wide notice when loading is slow because the network is constrained,
 * or when any fetch has been pending longer than SLOW_REQUEST_MS.
 */
export function SlowNetworkAlert() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("Slow connection — loading may take a moment.");
  const pendingRef = useRef(0);
  const slowTimerCountRef = useRef(0);
  const constrainedRef = useRef(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    dismissedRef.current = dismissed;
  }, [dismissed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncVisibility = () => {
      if (dismissedRef.current) {
        setVisible(false);
        return;
      }
      const constrained = constrainedRef.current;
      const hasPending = pendingRef.current > 0;
      const hasSlowPending = slowTimerCountRef.current > 0;
      const shouldShow = (constrained && hasPending) || hasSlowPending;
      if (shouldShow) {
        setMessage(
          constrained
            ? "Slow connection detected — loading may take a moment."
            : "Still loading — your connection seems slow."
        );
      }
      setVisible(shouldShow);
    };

    const refreshConstraint = () => {
      constrainedRef.current = isNetworkConstrained();
      syncVisibility();
    };
    refreshConstraint();
    const unsubscribe = subscribeNetworkConnection(refreshConstraint);

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      pendingRef.current += 1;
      syncVisibility();

      const meta: FetchMeta = { timer: 0, slowFired: false };
      meta.timer = window.setTimeout(() => {
        meta.slowFired = true;
        slowTimerCountRef.current += 1;
        syncVisibility();
      }, SLOW_REQUEST_MS);

      const promise = originalFetch(input, init);

      const settle = () => {
        window.clearTimeout(meta.timer);
        if (meta.slowFired) {
          slowTimerCountRef.current = Math.max(0, slowTimerCountRef.current - 1);
        }
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        if (pendingRef.current === 0) {
          slowTimerCountRef.current = 0;
          dismissedRef.current = false;
          setDismissed(false);
        }
        syncVisibility();
      };

      promise.then(settle, settle);
      return promise;
    };

    return () => {
      unsubscribe();
      window.fetch = originalFetch;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="slow-network-alert" role="status" aria-live="polite">
      <span className="slow-network-alert-dot" aria-hidden="true" />
      <p className="slow-network-alert-text">{message}</p>
      <button
        type="button"
        className="slow-network-alert-dismiss"
        onClick={() => {
          setDismissed(true);
          setVisible(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
