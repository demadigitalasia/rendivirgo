import type { Metadata } from "next";
import { RoughMaterialsCatalog } from "@/components/rough-materials-catalog";
export const metadata: Metadata = { title: "Rough Materials — Bulk Stone Supply | RENDI VIRGO", description: "Explore rough stone materials and estimate bulk supply. Minimum 2 metric tons, maximum 2 material types. Request a quotation via WhatsApp or email." };
export default function RoughMaterialsPage() { return <RoughMaterialsCatalog />; }
