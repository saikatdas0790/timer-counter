export function registerServiceWorker(): void {
  if (typeof navigator === "undefined") return;
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
    console.error("Service worker registration failed:", err);
  });
}
