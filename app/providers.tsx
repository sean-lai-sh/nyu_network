"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";
import { authClient } from "@/lib/auth-client";

export const Providers = ({ children, initialToken }: { children: ReactNode; initialToken: string | null }) => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL).");
  }
  const client = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient} initialToken={initialToken ?? undefined}>
      {children}
    </ConvexBetterAuthProvider>
  );
};
