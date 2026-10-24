export const ROUGH_MINIMUM_KG = 2000;
export const ROUGH_MAX_TYPES = 2;
export type RoughMaterial = { id: string; sku: string; name: string; stoneType: string; origin: string; description: string; sizeNotes: string; images: string[]; pricePerKg: number; availableKg: number | null; isAvailable: boolean; currency: string };
export type RoughSelection = { material: RoughMaterial; quantity: string };
export function roughEstimate(lines: RoughSelection[]) {
  const validWeights = lines.every(({ material, quantity }) => /^\d+(?:\.\d{1,3})?$/.test(quantity) && Number(quantity) > 0 && Number(quantity) <= 1000000 && material.isAvailable && (material.availableKg === null || Number(quantity) <= material.availableKg));
  const grams = lines.reduce((sum, line) => sum + (Number.isFinite(Number(line.quantity)) ? Math.round(Number(line.quantity) * 1000) : 0), 0);
  const cents = lines.reduce((sum, { material, quantity }) => sum + (Number.isFinite(Number(quantity)) ? Math.round(Math.round(material.pricePerKg * 100) * Math.round(Number(quantity) * 1000) / 1000) : 0), 0);
  return { totalKg: grams / 1000, total: cents / 100, missingKg: Math.max(0, ROUGH_MINIMUM_KG - grams / 1000), valid: lines.length > 0 && lines.length <= ROUGH_MAX_TYPES && new Set(lines.map((line) => line.material.id)).size === lines.length && validWeights && grams >= ROUGH_MINIMUM_KG * 1000, validWeights };
}
