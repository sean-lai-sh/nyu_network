import { NiaSDK } from "nia-ai-ts";

if (!process.env.NIA_API_KEY) {
  console.warn("NIA_API_KEY is not set — Nia search will be unavailable");
}

export const nia = new NiaSDK({
  apiKey: process.env.NIA_API_KEY ?? ""
});
