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
      scope="openid profile email"
      automaticSilentRenew={false}
      // We handle token renewal ourselves (see AuthGate) via the
      // accessTokenExpiring event. oidc-client-ts's built-in
      // automaticSilentRenew falls back to an iframe when there is no
      // refresh_token; SpacetimeAuth (currently in beta) does not issue
      // refresh tokens for public clients, so the iframe path always fires
      // and always fails with "End-User authentication is required".
      //
      // Fire the expiring event 5 minutes before expiry so we have time to
      // redirect and complete the sign-in while the IdP session is still alive.
      accessTokenExpiringNotificationTimeInSeconds={300}
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
