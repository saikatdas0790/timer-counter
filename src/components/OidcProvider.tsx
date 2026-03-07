"use client";

import { AuthProvider } from "react-oidc-context";

export default function OidcProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const redirectUri =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AuthProvider
      authority="https://auth.spacetimedb.com/oidc"
      client_id={process.env.NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_ID!}
      client_secret={process.env.NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_SECRET}
      redirect_uri={redirectUri}
      scope="openid profile email"
      automaticSilentRenew={true}
      onSigninCallback={() => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }}
    >
      {children}
    </AuthProvider>
  );
}
