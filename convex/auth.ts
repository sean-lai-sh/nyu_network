import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const baseUrl = requiredEnv("BETTER_AUTH_URL");
  const secret = requiredEnv("BETTER_AUTH_SECRET");

  return {
    appName: "NYU Network",
    baseURL: baseUrl,
    secret,
    database: authComponent.adapter(ctx),
    plugins: [convex({ authConfig })],
    trustedOrigins: [baseUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false
    }
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
