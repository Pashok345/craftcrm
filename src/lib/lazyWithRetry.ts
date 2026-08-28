import { lazy, ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";

/**
 * React.lazy wrapper that survives stale chunk hashes after a new deploy.
 * If a dynamic import fails, retry once, then force a one-time hard reload.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // Retry once — transient network failures are common.
      try {
        return await factory();
      } catch (err2) {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 15_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Never resolves; page is reloading.
          return new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
