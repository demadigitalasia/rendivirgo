"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";

type CartLine = Product & { quantity: number; variantId?: string; variantName?: string };

type CartContextValue = {
  lines: CartLine[];
  addToCart: (product: Product, quantity?: number, variantId?: string, variantName?: string) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

type Language = "en" | "id";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

const lineKey = (line: Pick<CartLine, "id" | "variantId">) => `${line.id}:${line.variantId ?? "base"}`;

export function Providers({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const savedCart = window.localStorage.getItem("rendi-virgo-cart");
    const savedLanguage = window.localStorage.getItem("rendi-virgo-language") as Language | null;
    if (savedCart) setLines(JSON.parse(savedCart));
    if (savedLanguage === "en" || savedLanguage === "id") setLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rendi-virgo-cart", JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    window.localStorage.setItem("rendi-virgo-language", language);
  }, [language]);

  const value = useMemo<CartContextValue>(() => {
    const addToCart = (product: Product, quantity = 1, variantId?: string, variantName?: string) => {
      if (product.status !== "Available") return;
      const key = lineKey({ id: product.id, variantId });
      setLines((current) => {
        const existing = current.find((line) => lineKey(line) === key);
        if (existing) {
          return current.map((line) =>
            lineKey(line) === key ? { ...line, quantity: line.quantity + quantity } : line,
          );
        }
        return [...current, { ...product, quantity, variantId, variantName }];
      });
    };

    const removeFromCart = (key: string) => setLines((current) => current.filter((line) => lineKey(line) !== key));
    const updateQuantity = (key: string, quantity: number) => {
      if (quantity <= 0) return removeFromCart(key);
      setLines((current) => current.map((line) => (lineKey(line) === key ? { ...line, quantity } : line)));
    };
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    return { lines, addToCart, removeFromCart, updateQuantity, clearCart: () => setLines([]), itemCount, subtotal };
  }, [lines]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </LanguageContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside Providers");
  return context;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside Providers");
  return context;
}
