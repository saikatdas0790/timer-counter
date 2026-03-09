"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";

// Proactively trigger silent renewal when the tab becomes visible with fewer
// than this many seconds left on the access token. The automatic renewal fires
// at ~60 s remaining, but if the browser woke from sleep the network may not
// be ready yet — starting early gives the library more time to retry.
const PROACTIVE_RENEW_THRESHOLD_SECONDS = 90;

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

    // Recovery with retry-and-backoff when automatic silent renewal fails.
    // The most common cause is a transient network error ("TypeError: Failed to
    // fetch") immediately after a device wakes from sleep. We retry at 2 s,
    // 5 s, and 10 s before giving up — the network is usually ready within a
    // few seconds of tab visibility being restored.
    useEffect(() => {
        if (!auth.error || !auth.isAuthenticated) return;

        console.error("[AuthGate] Auth renewal error — starting recovery:", auth.error);

        const delays = [2_000, 5_000, 10_000];
        const timers: ReturnType<typeof setTimeout>[] = [];
        let recovered = false;

        for (const delay of delays) {
            const t = setTimeout(() => {
                if (recovered) return;
                // Stop retrying if there's no longer an active error or the
                // user has since been signed out.
                const current = latestAuthRef.current;
                if (!current.error || !current.isAuthenticated) {
                    recovered = true;
                    return;
                }
                console.log(`[AuthGate] Recovery attempt after ${delay}ms…`);
                current.signinSilent().then(() => {
                    recovered = true;
                    console.log("[AuthGate] Recovery succeeded.");
                }).catch((err) => {
                    console.warn(`[AuthGate] Recovery attempt failed:`, err);
                });
            }, delay);
            timers.push(t);
        }

        return () => timers.forEach(clearTimeout);
    // Re-run only when auth.error transitions from falsy → truthy (new error).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.error]);

    // Proactive renewal on tab-visibility restore.
    // When the tab becomes visible with a short-lived token we call signinSilent
    // immediately — before the oidc-client-ts automatic timer fires — giving it
    // the best chance of succeeding while the network wakes up.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            const current = latestAuthRef.current;
            if (!current.isAuthenticated || current.activeNavigator) return;
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
