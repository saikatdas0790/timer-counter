"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const auth = useAuth();

    // When the library finishes loading but the user isn't signed in, attempt a
    // silent sign-in. For returning users whose access token expired but whose
    // refresh token (or IdP session) is still valid this avoids the login page
    // entirely. If it fails the sign-in button is shown below.
    useEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error) {
            auth.signinSilent().catch(() => {
                // Falls through — the sign-in button is rendered.
            });
        }
        // auth.signinSilent is stable (bound to UserManager); omitting from deps is safe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.isLoading, auth.isAuthenticated, auth.activeNavigator, auth.error]);

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
                    <span>Session error — sync paused.</span>
                    <button
                        onClick={() => auth.signinRedirect()}
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
