import { NextResponse } from "next/server";
import { apiOrigin } from "@/lib/api-proxy";
import { buildMcpTools, McpToolError, type McpTool } from "@/lib/mcp/tools";

// Stateless MCP server over streamable HTTP (JSON responses, no SSE).
// Auth: the caller's AdminApiKey ("Authorization: Bearer rvk_..."), validated
// against the internal Nest API so scopes/audit stay in one place.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-03-26", "2025-06-18"];
const LATEST_PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "rendivirgo-admin", title: "RENDI VIRGO Admin", version: "1.0.0" };

const TOOLS: McpTool[] = buildMcpTools();

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function validateApiKey(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer rvk_")) return false;
  try {
    const response = await fetch(`${apiOrigin()}/api/auth/me`, {
      headers: { authorization: header },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const text = (await tool.handler(args ?? {}, token)) as string;
    return { content: [{ type: "text", text }] };
  } catch (error) {
    const message = error instanceof McpToolError ? error.message : `Tool failed: ${(error as Error).message}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

async function handleRpc(request: Request, message: Record<string, unknown>) {
  const { id, method, params } = message as { id?: unknown; method?: string; params?: Record<string, unknown> };
  const token = request.headers.get("authorization")!.slice("Bearer ".length);

  switch (method) {
    case "initialize": {
      const requested = typeof (params as { protocolVersion?: string } | undefined)?.protocolVersion === "string"
        ? (params as { protocolVersion: string }).protocolVersion
        : LATEST_PROTOCOL_VERSION;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
      return jsonResponse(rpcResult(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO }));
    }
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });
    case "ping":
      return jsonResponse(rpcResult(id, {}));
    case "tools/list":
      return jsonResponse(
        rpcResult(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        }),
      );
    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : "";
      if (!name) return jsonResponse(rpcError(id, -32602, "params.name is required"));
      const result = await callTool(token, name, (params?.arguments as Record<string, unknown>) ?? {});
      return jsonResponse(rpcResult(id, result));
    }
    default:
      if (method?.startsWith("notifications/")) return new NextResponse(null, { status: 202 });
      return jsonResponse(rpcError(id, -32601, `Method not found: ${method}`));
  }
}

export async function POST(request: Request) {
  if (!(await validateApiKey(request))) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized: provide a valid API key as Bearer token" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  let message: Record<string, unknown>;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, "Parse error"));
  }

  try {
    return await handleRpc(request, message);
  } catch (error) {
    const { id } = message as { id?: unknown };
    return jsonResponse(rpcError(id, -32603, `Internal error: ${(error as Error).message}`));
  }
}

export async function GET() {
  return NextResponse.json({ error: "SSE streaming is not supported; POST JSON-RPC messages" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "No server-side session to terminate" }, { status: 405 });
}
