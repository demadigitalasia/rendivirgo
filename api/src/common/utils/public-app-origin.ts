import { ServiceUnavailableException } from "@nestjs/common";

/** Canonical frontend origin for account and project links; CORS lists are not canonical URLs. */
export function publicAppOrigin(env: Record<string, string | undefined> = process.env): string {
  const configured = env.PUBLIC_SITE_URL?.trim() || env.APP_ORIGIN?.split(",")[0]?.trim();
  const candidate = configured || (env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    if (env.NODE_ENV === "production" && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error();
    return url.origin;
  } catch {
    throw new ServiceUnavailableException("Configure PUBLIC_SITE_URL with the canonical frontend origin before sending account or project links");
  }
}
