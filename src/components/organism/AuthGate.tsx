"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";

// Proactively trigger silent renewal when the tab becomes visible with fewer
// than this many seconds left on the access token. The automatic renewal fires
// at ~60 s remaining, but if the browser woke from sleep the network may not
// be ready yet — starting early gives the library more time to retry.
const PROACTIVE_RENEW_THRESHOLD_SECONDS = 90;

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
            auth.signinSilent().catch(() => {
                // Falls through — the sign-in button is rendered.
            });
        }
        // auth.signinSilent is stable (bound to UserManager); omitting from deps is safe.
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
                // Don't start a second concurrent signinSilent.
                if (current.activeNavigator) return;

                console.log(`[AuthGate] Recovery attempt after ${delay}ms…`);
                current.signinSilent().then(() => {
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

    // Proactive renewal on tab-visibility restore.
    // When the tab becomes visible with a short-lived (or already expired) token,
    // call signinSilent immediately — before the oidc-client-ts automatic timer
    // fires — giving it the best chance while the network wakes up.
    // Guards: skip if a renewal is already in flight (activeNavigator is set),
    // and skip if the current error is terminal (requires manual sign-in).
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            const current = latestAuthRef.current;
            if (!current.isAuthenticated) return;
            if (current.activeNavigator) return;  // already in flight
            if (current.error && isTerminalError(current.error)) return;  // needs manual login
            const expiresIn = current.user?.expires_in ?? Infinity;
            if (expiresIn < PROACTIVE_RENEW_THRESHOLD_SECONDS) {
                console.log(
                    `[AuthGate] Tab visible with ${expiresIn}s left — ` +
                    `proactively calling signinSilent()`,
                );
                current.signinSilent().catch((err) => {
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
