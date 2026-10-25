export const SEO_AUDIT_HISTORY_KEY = "rv-seo-audit-history-v1";

export type SeoAuditMetadataEntry = {
  path: string;
  title: string;
  description: string;
  locale: string;
};

export type SeoAuditMetadataSnapshot = {
  at: string;
  entries: SeoAuditMetadataEntry[];
};

/** Read the latest completed browser audit without trusting its localStorage payload. */
export function readLatestSeoAuditMetadata(raw: string): SeoAuditMetadataSnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;

  for (const item of value.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const run = item as Record<string, unknown>;
    if (typeof run.at !== "string" || Number.isNaN(Date.parse(run.at)) || !Array.isArray(run.results)) continue;

    const entries = run.results.slice(0, 500).flatMap((rowValue): SeoAuditMetadataEntry[] => {
      if (!rowValue || typeof rowValue !== "object") return [];
      const row = rowValue as Record<string, unknown>;
      const result = row.result;
      if (!result || typeof result !== "object") return [];
      const metadata = result as Record<string, unknown>;
      if (typeof row.path !== "string" || !row.path.startsWith("/") || row.path.startsWith("//") ||
        metadata.path !== row.path || typeof metadata.title !== "string" || typeof metadata.description !== "string" ||
        typeof metadata.locale !== "string") return [];
      return [{
        path: row.path.slice(0, 2048),
        title: metadata.title.slice(0, 1000),
        description: metadata.description.slice(0, 3000),
        locale: metadata.locale.slice(0, 32),
      }];
    });
    return { at: run.at, entries };
  }
  return null;
}

function normalizePath(path: string) {
  try {
    const url = new URL(path, "https://rendivirgo.com");
    return `${url.pathname.replace(/\/$/, "") || "/"}${url.search}`;
  } catch {
    return path.trim();
  }
}

function normalizeMetadata(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function findSeoMetadataDuplicates(
  title: string,
  description: string,
  currentPath: string,
  locale: string,
  entries: SeoAuditMetadataEntry[],
) {
  const current = normalizePath(currentPath);
  const language = locale.toLowerCase().split("-")[0];
  const candidates = entries.filter(entry => {
    if (normalizePath(entry.path) === current) return false;
    const entryLanguage = entry.locale.toLowerCase().split("-")[0];
    return !entryLanguage || entryLanguage === language;
  });
  const normalizedTitle = normalizeMetadata(title);
  const normalizedDescription = normalizeMetadata(description);
  return {
    titles: normalizedTitle ? candidates.filter(entry => normalizeMetadata(entry.title) === normalizedTitle) : [],
    descriptions: normalizedDescription ? candidates.filter(entry => normalizeMetadata(entry.description) === normalizedDescription) : [],
  };
}
