import type { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, `/uploads/${path.join("/")}`);
}

export const GET = handler;
export const HEAD = handler;
