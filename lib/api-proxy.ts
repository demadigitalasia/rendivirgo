import { NextResponse, type NextRequest } from "next/server";

export const apiOrigin = () => (process.env.API_ORIGIN ?? "http://localhost:4000").replace(/\/+$/, "");

export async function proxyRequest(request: NextRequest, targetPath: string): Promise<Response> {
  const target = `${apiOrigin()}${targetPath}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { statusCode: 502, message: "Store API is unreachable", path: targetPath },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("set-cookie");

  const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });

  for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
