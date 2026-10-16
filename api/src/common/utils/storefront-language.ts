export type StorefrontLanguage = "en" | "id";

export function storefrontLanguage(value: string | undefined): StorefrontLanguage {
  return value === "id" ? "id" : "en";
}
