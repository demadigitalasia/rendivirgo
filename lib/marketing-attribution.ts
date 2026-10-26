export type MarketingAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
};

type StoredCampaignVisit = MarketingAttribution & { discountCode?: string };

const STORAGE_KEY = "rv.campaign-attribution.v1";

function clean(value: string | null, maxLength: number): string | undefined {
  const normalized = value?.trim().slice(0, maxLength);
  return normalized || undefined;
}

function readStored(): StoredCampaignVisit | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as StoredCampaignVisit : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredCampaignVisit): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Attribution is optional; a blocked storage API must not interrupt checkout.
  }
}

export function captureMarketingAttribution(): StoredCampaignVisit | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const hasUtm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .some((key) => params.has(key));
  const discountCode = clean(params.get("discount_code"), 80)?.toUpperCase();

  if (hasUtm) {
    const visit: StoredCampaignVisit = {
      utmSource: clean(params.get("utm_source"), 120),
      utmMedium: clean(params.get("utm_medium"), 120),
      utmCampaign: clean(params.get("utm_campaign"), 160),
      utmContent: clean(params.get("utm_content"), 200),
      utmTerm: clean(params.get("utm_term"), 200),
      landingPath: window.location.pathname.slice(0, 500),
      discountCode,
    };
    writeStored(visit);
    return visit;
  }

  if (discountCode) {
    const current = readStored() ?? {};
    const visit = { ...current, discountCode };
    writeStored(visit);
    return visit;
  }

  return readStored();
}

export function getMarketingAttribution(): MarketingAttribution {
  const visit = captureMarketingAttribution();
  if (!visit) return {};
  const { utmSource, utmMedium, utmCampaign, utmContent, utmTerm, landingPath } = visit;
  return { utmSource, utmMedium, utmCampaign, utmContent, utmTerm, landingPath };
}

export function getCampaignDiscountCode(): string | null {
  return captureMarketingAttribution()?.discountCode ?? null;
}

export function clearCampaignDiscountCode(): void {
  const current = readStored();
  if (!current) return;
  const attribution = { ...current };
  delete attribution.discountCode;
  writeStored(attribution);
}
