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
      stateStore={localStorageStore}
      userStore={localStorageStore}
      onSigninCallback={() => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }}
      onRemoveUser={() => {
        console.log("User session removed (logout or expiry)");
      }}
    >
      {children}
    </AuthProvider>
  );
}
