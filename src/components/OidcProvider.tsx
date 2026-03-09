"use client";

import { AuthProvider } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

export default function OidcProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const redirectUri =
    typeof window !== "undefined" ? window.location.origin : "";

  // Both stateStore (PKCE code_verifier/state) and userStore (tokens) use
  // localStorage so that they survive across tabs and browser restarts.
  // sessionStorage (the oidc-client-ts default for userStore) is cleared on
  // every new tab, which would force the user to sign in each time.
  const localStorageStore =
    typeof window !== "undefined"
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined;

  return (
    <AuthProvider
      authority="https://auth.spacetimedb.com/oidc"
      client_id={process.env.NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_ID!}
      redirect_uri={redirectUri}
      scope="openid profile email offline_access"
      automaticSilentRenew={true}
      // Fire the auto-renewal timer 5 minutes before expiry (not the default
      // ~60 s). Renewal at 5 min gives the library time to succeed while the
      // tab is still likely visible — if the tab is hidden much longer than
      // that, there's nothing we can do silently and we fall back to redirect.
      accessTokenExpiringNotificationTimeInSeconds={300}
      // Fail the iframe-based silent renew quickly (default can be 60 s+).
      // If the refresh-token grant is going to work, it responds in <1 s.
      // If we're falling back to an iframe and the tab is hidden, we want to
      // know fast so we can redirect rather than wait a minute.
      silentRequestTimeoutInSeconds={15}
      stateStore={localStorageStore}
      userStore={localStorageStore}
      onSigninCallback={(user) => {
        // Clean up ?code=&state= from the URL after the OIDC code exchange.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        const expiresIn = (user as { expires_in?: number } | null)?.expires_in;
        console.log(
          `[OidcProvider] SIGNIN_CALLBACK_COMPLETE expires_in=${expiresIn ?? "?"
          }s`,
        );
      }}
      onRemoveUser={() => {
        console.log("[OidcProvider] USER_REMOVED — session removed (logout or expiry)");
      }}
    >
      {children}
    </AuthProvider>
  );
}
