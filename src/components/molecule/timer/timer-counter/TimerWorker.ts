// Wall-clock based ticker: instead of trusting setInterval to fire exactly
// every 1000ms (browsers throttle intervals in background tabs), we record
// the last-tick timestamp and on every interval firing calculate how many
// full seconds have *actually* elapsed. If the tab was suspended for 30s the
// first tick after wakeup will carry seconds=30, keeping the timer accurate.
let lastTickAt = Date.now();

setInterval(() => {
  const now = Date.now();
  const seconds = Math.max(1, Math.round((now - lastTickAt) / 1000));
  lastTickAt = now;
  postMessage({ type: "SECONDS_ELAPSED", seconds });
}, 1000);

export {};
