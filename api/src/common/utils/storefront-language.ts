export type StorefrontLanguage = "en" | "id";

export function storefrontLanguage(value: string | undefined): StorefrontLanguage {
  void value;
  return "en";
}
