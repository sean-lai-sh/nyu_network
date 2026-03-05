import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL).");
}

export const convexHttp = new ConvexHttpClient(convexUrl);
