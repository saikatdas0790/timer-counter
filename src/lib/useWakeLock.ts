import { useEffect } from "react";

/**
 * Acquires a screen wake lock while `active` is true and releases it when
 * `active` becomes false or the component unmounts.
 *
 * The browser automatically releases the lock when the page is hidden, so
 * a visibilitychange listener re-acquires it when the page becomes visible
 * again (as long as the timer is still running).
 *
 * Silently no-ops in environments where the Wake Lock API is unavailable
 * (server-side rendering, older browsers).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;

    function acquire() {
      navigator.wakeLock
        .request("screen")
        .then((s) => {
          sentinel = s;
        })
        .catch(() => {
          // Denied or not available (e.g. page not visible yet) — safe to ignore.
        });
    }

    acquire();

    function onVisibilityChange() {
      // The sentinel is automatically released when the page becomes hidden.
      // Re-acquire it when the page becomes visible again.
      if (document.visibilityState === "visible") {
        acquire();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
