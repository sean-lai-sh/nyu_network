import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;

if (!convexUrl) {
  throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) in your Next.js environment.");
}
if (!convexSiteUrl) {
  throw new Error("Missing Convex Site URL. Set NEXT_PUBLIC_CONVEX_SITE_URL (or CONVEX_SITE_URL) in your Next.js environment.");
}

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction
} = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl
});
