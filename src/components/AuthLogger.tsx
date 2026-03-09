"use client";

/**
 * AuthLogger — headless component that captures every meaningful auth
 * lifecycle event, emits it to the browser console (always), and writes it
 * as a row in the `auth_log` SpacetimeDB table (whenever a valid token is
 * available).  This lets you read the log from any machine via the CLI:
 *
 *   spacetime sql timer-counter-6b3bt "SELECT * FROM auth_log ORDER BY id DESC LIMIT 100"
 *
 * Events captured:
 *   LOGGER_CONNECTED      – AuthLogger obtained a STDB connection (new token)
 *   LOGGER_DISCONNECTING  – STDB connection being torn down (token rotation / auth error)
 *   AUTH_ERROR            – auth.error became truthy (e.g. silent-renew network error)
 *   AUTH_ERROR_CLEARED    – auth.error became falsy after previously being set
 *   NAVIGATOR_CHANGE      – auth.activeNavigator transitioned (e.g. "" → signinSilent)
 *   AUTH_STATE_CHANGE     – isAuthenticated transitioned (login / logout)
 *   USER_LOADED           – oidc-client-ts loaded a new/renewed User object
 *   USER_UNLOADED         – oidc-client-ts removed the User object from storage
 *   TOKEN_EXPIRING        – access token is within the expiring window (default 60 s)
 *   TOKEN_EXPIRED         – access token has expired
 *   SILENT_RENEW_ERROR    – automatic silent renewal failed
 *   VISIBILITY_CHANGE     – browser tab became visible / hidden
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { createDbConnection } from "@/lib/spacetimedb";
import type { DbConnection } from "@/lib/spacetimedb";

export function AuthLogger() {
    const auth = useAuth();

    // Keep a mutable ref so that callbacks registered once with auth.events
    // can always read the latest auth state without re-subscribing.
    const latestAuthRef = useRef(auth);
    latestAuthRef.current = auth;

    // Mutable ref for the active STDB connection used solely for logging.
    const connRef = useRef<DbConnection | null>(null);

    /**
     * Core logging function.
     * Always logs to the console; writes to STDB best-effort when a connection is present.
     */
    const logEvent = useCallback((event: string, detail: string) => {
        const ts = new Date().toISOString();
        console.log(`[AuthLogger] ${ts} | ${event} | ${detail}`);

        const conn = connRef.current;
        if (conn) {
            conn.reducers
                .insertAuthLog({ clientTs: ts, event, detail })
                .catch((err: unknown) => {
                    console.warn(`[AuthLogger] STDB write failed for ${event}:`, err);
                });
        }
    }, []);

    // ── Connection lifecycle ────────────────────────────────────────────────────
    // Creates a dedicated (reducer-only) STDB connection whenever the auth token
    // changes. Intentionally does NOT include auth.error in the dep array —
    // we want the connection to stay alive during a renewal error so that
    // recovery events (USER_LOADED, AUTH_ERROR_CLEARED) are still captured.
    useEffect(() => {
        if (!auth.isAuthenticated) return;

        const token = auth.user?.access_token;
        if (!token) return;

        const conn = createDbConnection(token);
        connRef.current = conn;

        logEvent(
            "LOGGER_CONNECTED",
            `expires_in=${auth.user?.expires_in ?? "?"}s ` +
            `sub=${auth.user?.profile?.sub ?? "?"}`,
        );

        return () => {
            logEvent(
                "LOGGER_DISCONNECTING",
                "token changed or user signed out — tearing down log connection",
            );
            connRef.current = null;
            conn.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.user?.access_token, auth.isAuthenticated, logEvent]);

    // ── auth.error changes ─────────────────────────────────────────────────────
    const prevErrorRef = useRef<Error | undefined>(undefined);
    useEffect(() => {
        const curr = auth.error;
        const prev = prevErrorRef.current;

        if (curr !== prev) {
            if (curr) {
                logEvent(
                    "AUTH_ERROR",
                    `${curr.name}: ${curr.message}` +
                    `${latestAuthRef.current.user?.expires_in !== undefined ? ` (expires_in=${latestAuthRef.current.user.expires_in}s)` : ""}`,
                );
            } else if (prev) {
                logEvent("AUTH_ERROR_CLEARED", "auth.error transitioned back to falsy");
            }
            prevErrorRef.current = curr;
        }
    }, [auth.error, logEvent]);

    // ── auth.isAuthenticated changes ───────────────────────────────────────────
    const prevAuthenticatedRef = useRef<boolean | undefined>(undefined);
    useEffect(() => {
        const curr = auth.isAuthenticated;
        const prev = prevAuthenticatedRef.current;

        if (curr !== prev && prev !== undefined) {
            logEvent(
                "AUTH_STATE_CHANGE",
                `isAuthenticated: ${prev} → ${curr}` +
                (curr
                    ? ` (expires_in=${auth.user?.expires_in ?? "?"}s)`
                    : " (user logged out)"),
            );
        }
        prevAuthenticatedRef.current = curr;
    }, [auth.isAuthenticated, auth.user?.expires_in, logEvent]);

    // ── auth.activeNavigator changes ───────────────────────────────────────────
    const prevNavigatorRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const curr = auth.activeNavigator ?? "none";
        const prev = prevNavigatorRef.current;

        if (prev !== undefined && curr !== prev) {
            logEvent("NAVIGATOR_CHANGE", `${prev} → ${curr}`);
        }
        prevNavigatorRef.current = curr;
    }, [auth.activeNavigator, logEvent]);

    // ── oidc-client-ts token lifecycle events ─────────────────────────────────
    // These fire for every token event regardless of React render cycles.
    // We use auth.events which is a stable reference bound to the UserManager.
    useEffect(() => {
        const removeUserLoaded = auth.events.addUserLoaded((user) => {
            logEvent(
                "USER_LOADED",
                `expires_in=${user.expires_in ?? "?"}s ` +
                `sub=${user.profile?.sub ?? "?"} ` +
                `refresh_token=${user.refresh_token ? "present" : "absent"}`,
            );
        });

        const removeUserUnloaded = auth.events.addUserUnloaded(() => {
            logEvent("USER_UNLOADED", "user object removed from storage");
        });

        const removeAccessTokenExpiring = auth.events.addAccessTokenExpiring(() => {
            const expiresIn = latestAuthRef.current.user?.expires_in;
            logEvent(
                "TOKEN_EXPIRING",
                `access token expiring — expires_in=${expiresIn ?? "?"}s`,
            );
        });

        const removeAccessTokenExpired = auth.events.addAccessTokenExpired(() => {
            logEvent("TOKEN_EXPIRED", "access token has expired");
        });

        const removeSilentRenewError = auth.events.addSilentRenewError(
            (error: Error) => {
                logEvent(
                    "SILENT_RENEW_ERROR",
                    `${error?.name ?? "Error"}: ${error?.message ?? String(error)}`,
                );
            },
        );

        return () => {
            removeUserLoaded();
            removeUserUnloaded();
            removeAccessTokenExpiring();
            removeAccessTokenExpired();
            removeSilentRenewError();
        };
    }, [auth.events, logEvent]);

    // ── Visibility changes ─────────────────────────────────────────────────────
    // Logs when the tab is hidden/shown. This is useful for diagnosing cases
    // where background-tab throttling caused token renewal to fail.
    useEffect(() => {
        const onVisibilityChange = () => {
            const state = document.visibilityState;
            const auth = latestAuthRef.current;
            logEvent(
                "VISIBILITY_CHANGE",
                `visibilityState=${state} isAuthenticated=${auth.isAuthenticated} ` +
                `expires_in=${auth.user?.expires_in ?? "?"}s ` +
                `error=${auth.error?.message ?? "none"}`,
            );
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () =>
            document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [logEvent]);

    return null;
}
