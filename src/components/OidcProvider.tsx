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

    const stateStore =
        typeof window !== "undefined"
            ? new WebStorageStateStore({ store: window.localStorage })
            : undefined;

    return (
        <AuthProvider
            authority="https://auth.spacetimedb.com/oidc"
            client_id={process.env.NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_ID!}
            redirect_uri={redirectUri}
            scope="openid profile email"
            automaticSilentRenew={true}
            stateStore={stateStore}
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
