"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import type { AuthContextProps } from "react-oidc-context";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";

// Proactively trigger silent renewal when the tab becomes visible with fewer
// than this many seconds left on the access token. We use the same window as
// accessTokenExpiringNotificationTime (300 s) so we catch any renewal that
// was skipped while the tab was hidden.
const PROACTIVE_RENEW_THRESHOLD_SECONDS = 300;

// Errors that indicate the IdP session / refresh token is gone and no amount
// of silent retrying will help. We must stop and let the user sign in manually.
function isTerminalError(err: Error): boolean {
    const msg = err.message ?? "";
    return (
        msg.includes("End-User authentication is required") ||
        msg.includes("IFrame timed out") ||
        msg.includes("login_required") ||
        msg.includes("interaction_required") ||
        msg.includes("consent_required")
    );
}

// Errors that are worth retrying — transient network failures right after
// a device wakes from sleep.
function isNetworkError(err: Error): boolean {
    const msg = err.message ?? "";
    return (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed") ||
        msg.includes("disposed window")
    );
}

// Prefer a fetch-based refresh-token grant over the iframe silent-renew path.
//
// oidc-client-ts already uses a direct token-endpoint POST (fetch) when a
// refresh token is present, and only falls back to an iframe when there is
// none. The iframe path is problematic: browsers suspend iframes in hidden
// tabs, causing multi-minute timeouts. By routing through this helper we
// ensure we never accidentally land on the iframe path — if the refresh token
// is gone we redirect immediately instead.
async function renewOrRedirect(auth: AuthContextProps): Promise<void> {
    if (auth.user?.refresh_token) {
        // refresh_token present → oidc-client-ts uses token endpoint (fetch), no iframe
        await auth.signinSilent();
        return;
    }
    // No refresh token → silent renew would use iframe; skip it and redirect.
    console.log("[AuthGate] No refresh token available — redirecting to sign-in.");
    return auth.signinRedirect();
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const latestAuthRef = useRef(auth);
    latestAuthRef.current = auth;

    // When the library finishes loading but the user isn't signed in, attempt a
    // silent sign-in. For returning users whose access token expired but whose
    // refresh token (or IdP session) is still valid this avoids the login page
    // entirely. If it fails the sign-in button is shown below.
    useEffect(() => {
        if (
            !auth.isLoading &&
            !auth.isAuthenticated &&
            !auth.activeNavigator &&
            !auth.error
        ) {
            renewOrRedirect(auth).catch(() => {
                // Falls through — the sign-in button is rendered.
            });
        }
        // renewOrRedirect captures auth by value; stable deps are sufficient.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.isLoading, auth.isAuthenticated, auth.activeNavigator, auth.error]);

    // Recovery with retry-and-backoff when automatic silent renewal fails with
    // a transient network error (the most common cause: device woke from sleep,
    // network not yet ready). We retry at 2 s, 5 s, and 10 s then give up.
    //
    // We do NOT retry terminal IdP errors ("End-User authentication is required",
    // "IFrame timed out", etc.) — those mean the refresh token / IdP session is
    // gone and only a manual sign-in can fix them. Retrying them creates an
    // iframe-timeout storm (as seen in the logs).
    useEffect(() => {
        if (!auth.error || !auth.isAuthenticated) return;

        // Bail out immediately for terminal errors — no point retrying.
        if (isTerminalError(auth.error)) {
            console.warn("[AuthGate] Terminal auth error — not retrying:", auth.error.message);
            return;
        }

        if (!isNetworkError(auth.error)) {
            console.warn("[AuthGate] Unrecognised auth error — not retrying:", auth.error.message);
            return;
        }

        console.error("[AuthGate] Transient network error during renewal — will retry:", auth.error.message);

        const delays = [2_000, 5_000, 10_000];
        const timers: ReturnType<typeof setTimeout>[] = [];
        let recovered = false;

        for (const delay of delays) {
            const t = setTimeout(() => {
                if (recovered) return;
                const current = latestAuthRef.current;
                // Stop if no longer in an error state or already signed out.
                if (!current.error || !current.isAuthenticated) {
                    recovered = true;
                    return;
                }
                // Stop if the error has become terminal during the backoff.
                if (isTerminalError(current.error)) {
                    recovered = true;
                    console.warn("[AuthGate] Error became terminal during backoff — stopping retries.");
                    return;
                }
                // Don't start a second concurrent renewal.
                if (current.activeNavigator) return;
                // If there's no refresh token renewOrRedirect will call
                // signinRedirect, which navigates the page. Don't do that
                // silently while the tab is hidden — defer to the
                // visibilitychange handler which will redirect when the
                // user returns. If we do have a refresh token the call is
                // a plain fetch and works fine in background tabs.
                if (document.visibilityState === "hidden" && !current.user?.refresh_token) {
                    console.log(`[AuthGate] Tab hidden, no refresh token — deferring recovery to next visibility.`);
                    return;
                }

                console.log(`[AuthGate] Recovery attempt after ${delay}ms…`);
                renewOrRedirect(current).then(() => {
                    recovered = true;
                    console.log("[AuthGate] Recovery succeeded.");
                }).catch((err) => {
                    console.warn("[AuthGate] Recovery attempt failed:", err);
                });
            }, delay);
            timers.push(t);
        }

        return () => timers.forEach(clearTimeout);
        // Re-run only when auth.error transitions from falsy → truthy (new error).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.error]);

    // Proactive visibility-based renewal AND auto-redirect on terminal errors.
    //
    // On every tab-visible event:
    //   a) If token is expiring (<300 s) and no error / retriable error: signinSilent
    //   b) If there's a TERMINAL error + token is expired: auto-redirect.
    //      Timer state lives in localStorage and is fully restored after the
    //      redirect completes, so the user loses nothing.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            const current = latestAuthRef.current;
            if (!current.isAuthenticated) return;
            if (current.activeNavigator) return; // already in flight

            const expiresIn = current.user?.expires_in ?? Infinity;

            // Terminal error + expired token = redirect immediately.
            // The user is already effectively signed out; redirect gets them
            // back without needing to click the banner.
            if (current.error && isTerminalError(current.error) && expiresIn <= 0) {
                console.log("[AuthGate] Terminal error + expired token on tab visible — redirecting to sign-in.");
                current.signinRedirect().catch((err) => {
                    console.warn("[AuthGate] Auto-redirect failed:", err);
                });
                return;
            }

            // Proactive renewal when token is getting short.
            if (!current.error && expiresIn < PROACTIVE_RENEW_THRESHOLD_SECONDS) {
                console.log(
                    `[AuthGate] Tab visible with ${expiresIn}s left — ` +
                    `proactively calling renewOrRedirect()`,
                );
                renewOrRedirect(current).catch((err) => {
                    console.warn("[AuthGate] Proactive renewal failed:", err);
                });
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    // Show skeleton while the library initialises or while silent sign-in is in flight.
    if (auth.isLoading || auth.activeNavigator === "signinSilent") {
        return <TimerSkeletonGrid />;
    }

    if (!auth.isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <button
                    onClick={() => auth.signinRedirect()}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-500 active:bg-blue-700"
                >
                    Sign in with Google
                </button>
            </div>
        );
    }

    // Authenticated: always render children so running timers are never interrupted.
    // If automatic silent renew fails, show a dismissible banner instead of
    // replacing the UI — the timer keeps ticking, only STDB sync is affected.
    return (
        <>
            {auth.error && (
                <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-red-600 px-4 py-2 text-sm text-white">
                    <span>
                        Session error — sync paused.{" "}
                        {auth.user?.expires_in && (
                            <span className="opacity-80">
                                (Token expires in {Math.floor(auth.user.expires_in / 60)}m)
                            </span>
                        )}
                    </span>
                    <button
                        onClick={() => {
                            // Clear error state and attempt sign-in
                            auth.clearStaleState();
                            auth.signinRedirect();
                        }}
                        className="ml-4 rounded bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                        Sign in again
                    </button>
                </div>
            )}
            {children}
        </>
    );
}
