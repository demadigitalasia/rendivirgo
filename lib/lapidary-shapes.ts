export const cabochonShapes = {
  oval: { en: "Oval", id: "Oval", dimensions: "20 × 14 × 4 mm" },
  round: { en: "Round", id: "Bulat", dimensions: "16 × 16 × 4 mm" },
  teardrop: { en: "Teardrop", id: "Tetes air", dimensions: "20 × 15 × 4 mm" },
  "long-oval": { en: "Long oval", id: "Oval panjang", dimensions: "22 × 10 × 4 mm" },
  cushion: { en: "Cushion", id: "Cushion", dimensions: "17 × 17 × 4 mm" },
  freeform: { en: "Freeform", id: "Bentuk bebas", dimensions: "18 × 17 × 4 mm" },
  pear: { en: "Pear", id: "Pear", dimensions: "20 × 16 × 4 mm" },
  marquise: { en: "Marquise", id: "Marquise", dimensions: "23 × 11 × 4 mm" },
  "half-oval": { en: "Half oval", id: "Setengah oval", dimensions: "12 × 24 × 4 mm" },
  "rounded-triangle": { en: "Rounded triangle", id: "Segitiga membulat", dimensions: "20 × 18 × 4 mm" },
  "side-tongue": { en: "Side tongue", id: "Lidah asimetris", dimensions: "22 × 13 × 4 mm" },
  "ladder-trapezoid": { en: "Ladder trapezoid", id: "Trapesium memanjang", dimensions: "23 × 14 × 4 mm" },
  rhombus: { en: "Rhombus", id: "Belah ketupat", dimensions: "24 × 12 × 4 mm" },
  keystone: { en: "Keystone", id: "Keystone", dimensions: "21 × 15 × 4 mm" },
  tongue: { en: "Tongue", id: "Lidah", dimensions: "22 × 14 × 4 mm" },
  cartouche: { en: "Cartouche", id: "Cartouche", dimensions: "22 × 14 × 4 mm" },
  "wide-shield": { en: "Wide shield", id: "Perisai lebar", dimensions: "13 × 22 × 4 mm" },
  "bowed-rectangle": { en: "Bowed rectangle", id: "Persegi panjang melengkung", dimensions: "22 × 15 × 4 mm" },
  barrel: { en: "Barrel", id: "Barrel", dimensions: "22 × 14 × 4 mm" },
  shield: { en: "Shield", id: "Perisai", dimensions: "23 × 15 × 4 mm" },
  trillion: { en: "Trillion", id: "Trillion", dimensions: "20 × 19 × 4 mm" },
  "bowed-triangle": { en: "Bowed triangle", id: "Segitiga melengkung", dimensions: "16 × 22 × 4 mm" },
  "emerald-octagon": { en: "Emerald octagon", id: "Oktagon emerald", dimensions: "20 × 17 × 4 mm" },
  "split-oval": { en: "Split oval", id: "Belahan oval", dimensions: "24 × 10 × 4 mm" },
  "split-marquise": { en: "Split marquise", id: "Belahan marquise", dimensions: "28 × 9 × 4 mm" },
  fan: { en: "Fan", id: "Kipas", dimensions: "20 × 18 × 4 mm" },
  wing: { en: "Wing", id: "Sayap", dimensions: "28 × 12 × 4 mm" },
  "tapered-baton": { en: "Tapered baton", id: "Baton meruncing", dimensions: "32 × 7 × 3.5 mm" },
  kite: { en: "Kite", id: "Layang-layang", dimensions: "28 × 14 × 4 mm" },
  "rounded-rectangle": { en: "Rounded rectangle", id: "Persegi panjang membulat", dimensions: "26 × 10 × 4 mm" },
} as const;

export type CabochonShape = keyof typeof cabochonShapes;
export const standardCabochonKeys = Object.keys(cabochonShapes) as CabochonShape[];
export const basicCabochonKeys = standardCabochonKeys.slice(0, 8);
export function cabochonAssetVersion(_shape: CabochonShape) {
  return 4;
}
