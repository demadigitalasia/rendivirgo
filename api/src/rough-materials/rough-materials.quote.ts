import { BadRequestException } from "@nestjs/common";

export const ROUGH_MINIMUM_KG = 2000;
export const ROUGH_MAX_TYPES = 2;

type Material = { id: string; sku: string; name: string; pricePerKg: number; availableKg: number | null; isPublished: boolean; isAvailable: boolean };
export function calculateRoughQuote(items: { materialId: string; quantityKg: number }[], materials: Material[]) {
  if (!Array.isArray(items) || items.length < 1 || items.length > ROUGH_MAX_TYPES) throw new BadRequestException("Select one or two material types only");
  if (new Set(items.map((item) => item.materialId)).size !== items.length) throw new BadRequestException("Combine duplicate materials into one quantity");
  const lines = items.map((item) => {
    const material = materials.find((entry) => entry.id === item.materialId);
    if (!material?.isPublished || !material.isAvailable) throw new BadRequestException("A selected material is no longer available. Refresh the catalog.");
    const grams = Math.round(item.quantityKg * 1000);
    if (!Number.isFinite(item.quantityKg) || item.quantityKg <= 0 || item.quantityKg > 1000000 || Math.abs(item.quantityKg * 1000 - grams) > 0.00001) throw new BadRequestException("Enter a positive weight with at most three decimal places");
    if (material.availableKg !== null && grams > Math.round(material.availableKg * 1000)) throw new BadRequestException(`Requested weight exceeds availability for ${material.name}`);
    const priceCents = Math.round(material.pricePerKg * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) throw new BadRequestException("Material pricing is unavailable. Contact our team.");
    return { materialId: material.id, sku: material.sku, name: material.name, quantityKg: grams / 1000, pricePerKg: priceCents / 100, subtotal: Math.round(priceCents * grams / 1000) / 100 };
  });
  const totalGrams = lines.reduce((sum, line) => sum + Math.round(line.quantityKg * 1000), 0);
  if (totalGrams < ROUGH_MINIMUM_KG * 1000) throw new BadRequestException("Minimum total order is 2 metric tons (2,000 kg)");
  return { currency: "USD" as const, lines, totalKg: totalGrams / 1000, total: lines.reduce((sum, line) => sum + Math.round(line.subtotal * 100), 0) / 100 };
}
