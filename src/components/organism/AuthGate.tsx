"use client";

import { useAuth } from "react-oidc-context";
import TimerSkeletonGrid from "@/components/organism/timer-grid/TimerSkeletonGrid";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return <TimerSkeletonGrid />;
  }

  if (auth.error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-400">
          Authentication error: {auth.error.message}
        </p>
      </div>
    );
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

  return <>{children}</>;
}
