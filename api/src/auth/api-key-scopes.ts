// Scope model for AdminApiKey tokens: "<domain>:read" | "<domain>:write" | "*".
// A write scope implicitly grants read on the same domain.

export const API_KEY_SCOPE_DOMAINS = ["catalog", "content", "orders", "uploads", "settings"] as const;

export type ApiKeyScopeDomain = (typeof API_KEY_SCOPE_DOMAINS)[number];

export const API_KEY_ALL_SCOPE = "*";

export function isValidApiKeyScope(scope: string): boolean {
  if (scope === API_KEY_ALL_SCOPE) return true;
  const [domain, level] = scope.split(":");
  if (!domain || !level) return false;
  return (API_KEY_SCOPE_DOMAINS as readonly string[]).includes(domain) && (level === "read" || level === "write");
}

/** Route path (segments after the "api" prefix, e.g. ["admin", "products"]) -> scope domain. */
export function scopeDomainForSegments(segments: string[]): ApiKeyScopeDomain | "self" | null {
  if (segments[0] === "auth" || segments[0] === "health") return "self";
  if (segments[0] !== "admin") return null;
  const resource = segments[1];
  switch (resource) {
    case "products":
    case "categories":
    case "conditions":
      return "catalog";
    case "blog":
    case "pages":
    case "banners":
    case "hero-slides":
    case "navigation":
    case "site-content":
    case "testimonials":
    case "content":
    case "newsletter":
    case "reviews":
      return "content";
    case "orders":
    case "wholesale":
    case "lapidary":
      return "orders";
    case "uploads":
      return "uploads";
    default:
      // settings, shipping, audit, and anything not yet mapped fall under settings
      return "settings";
  }
}

export function hasApiKeyScope(scopes: string[], domain: ApiKeyScopeDomain, level: "read" | "write"): boolean {
  if (scopes.includes(API_KEY_ALL_SCOPE)) return true;
  if (scopes.includes(`${domain}:write`)) return true;
  if (level === "read" && scopes.includes(`${domain}:read`)) return true;
  return false;
}
