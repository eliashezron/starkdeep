"use client";

import { type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Wrap client-side providers (Privy) for the app.
export function Providers({ children }: { children: ReactNode }) {
  if (!appId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID is missing; Privy login will be disabled.");
    return children;
  }

  return <PrivyProvider appId={appId}>{children}</PrivyProvider>;
}
