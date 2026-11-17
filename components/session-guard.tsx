"use client";

import React from "react";
import { useAuthStore, clearStoredSession } from "@/lib/useAuthStore";
import { toast } from "@/hooks/use-toast";

/**
 * Keeps the browser's idea of "logged in" honest.
 *
 * The token lives in localStorage and outlives deployments, so a stale or
 * revoked one used to make every cart action fail quietly while the page still
 * said the customer was signed in — and an incognito window, with no stored
 * state, worked. Three guards:
 *
 *  1. On load, a stored token is checked once against /api/users/me; a 401
 *     signs the customer out and says so.
 *  2. Any later 401 from our own API (/api/* or /backend/*) while a token is
 *     stored does the same, so the first failing action is also the last.
 *  3. A chunk that no longer exists on the server (a tab left open across a
 *     deployment) reloads the page once instead of leaving dead buttons.
 */
const SESSION_EXPIRED_TITLE = "Sesi login berakhir";
const SESSION_EXPIRED_TEXT = "Silakan login kembali untuk melanjutkan.";
const RELOAD_FLAG = "topsell:chunk-reload";

let fetchPatched = false;
let expiring = false;

const expireSession = () => {
  if (expiring) return;
  expiring = true;
  clearStoredSession();
  toast({ title: SESSION_EXPIRED_TITLE, description: SESSION_EXPIRED_TEXT, variant: "destructive" });
  setTimeout(() => {
    expiring = false;
  }, 3000);
};

const isOurApi = (input: RequestInfo | URL) => {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return u.pathname.startsWith("/api/") || u.pathname.startsWith("/backend/");
  } catch {
    return false;
  }
};

const patchFetch = () => {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    if (res.status === 401 && useAuthStore.getState().token && isOurApi(input)) {
      // Login endpoints answer 401 for a wrong OTP; that is not a dead session.
      const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, window.location.origin).pathname;
      if (!/\/users\/(login|verify-otp|register)/.test(path)) {
        expireSession();
      }
    }
    return res;
  };
};

const SessionGuard = () => {
  const token = useAuthStore((s) => s.token);

  React.useEffect(() => {
    patchFetch();

    const onError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const err: unknown = "reason" in event ? event.reason : event.error;
      const name = (err as { name?: string })?.name || "";
      const message = (err as { message?: string })?.message || "";
      if (name === "ChunkLoadError" || /Loading chunk|Failed to fetch dynamically imported module/i.test(message)) {
        try {
          if (sessionStorage.getItem(RELOAD_FLAG)) return;
          sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch {}
        window.location.reload();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);

  // One check per stored token: is it still accepted by the API?
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) expireSession();
      } catch {
        // Network trouble is not a bad token.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return null;
};

export default SessionGuard;
