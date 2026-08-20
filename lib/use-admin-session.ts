"use client";

import { useCallback, useEffect, useState } from "react";
import { isAdminUiHidden } from "./admin-ui-visible";

export const ADMIN_DRAG_STORAGE_KEY = "maroma-admin-drag";

type SessionUser = { email: string; role: string };

function readDragPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(ADMIN_DRAG_STORAGE_KEY) === "true";
}

function clearDragPreferenceIfSet(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (window.localStorage.getItem(ADMIN_DRAG_STORAGE_KEY) === "true") {
    window.localStorage.setItem(ADMIN_DRAG_STORAGE_KEY, "false");
    window.dispatchEvent(new Event("maroma-admin-changed"));
  }
}

export function setAdminDragPreference(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ADMIN_DRAG_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("maroma-admin-changed"));
}

/** True when the signed-in user has the admin role (verified via /api/auth/session). */
export function useAdminSession() {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [canEditNewsletter, setCanEditNewsletter] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { user?: SessionUser | null };
      const role = data.user?.role;
      const admin = role === "admin";
      const newsletter = role === "admin" || role === "newsletter";
      setIsAdminUser(admin);
      setCanEditNewsletter(newsletter);
      if (!admin) {
        clearDragPreferenceIfSet();
      }
      setAdminModeEnabled(admin && readDragPreference() && !isAdminUiHidden());
    } catch {
      setIsAdminUser(false);
      setCanEditNewsletter(false);
      clearDragPreferenceIfSet();
      setAdminModeEnabled(false);
    } finally {
      setSessionReady(true);
    }
  }, []);

  const syncDragPreference = useCallback(() => {
    setAdminModeEnabled((prev) => {
      const next = isAdminUser && readDragPreference() && !isAdminUiHidden();
      return prev === next ? prev : next;
    });
  }, [isAdminUser]);

  useEffect(() => {
    void refreshSession();
    const onFocus = () => void refreshSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSession]);

  useEffect(() => {
    syncDragPreference();
    window.addEventListener("maroma-admin-changed", syncDragPreference);
    window.addEventListener("storage", syncDragPreference);
    return () => {
      window.removeEventListener("maroma-admin-changed", syncDragPreference);
      window.removeEventListener("storage", syncDragPreference);
    };
  }, [syncDragPreference]);

  return { isAdminUser, canEditNewsletter, adminModeEnabled, sessionReady, refreshSession };
}
