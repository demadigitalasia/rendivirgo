/** International destination digits for wa.me. Never guess a country code. */
export function internationalWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== "string" || !/^\+?[\d ()-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
