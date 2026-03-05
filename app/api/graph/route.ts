import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexHttp } from "@/lib/convex-client";

export async function GET() {
  const snapshot = await convexHttp.query(api.graph.getCurrentSnapshot, {});

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
