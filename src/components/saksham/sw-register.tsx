"use client";

/** Registers the offline-shell service worker (C.7). No-op when unsupported. */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") return; // avoid dev-server cache confusion
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failed — app still works online */
    });
  }, []);
  return null;
}
