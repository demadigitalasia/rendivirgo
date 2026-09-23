"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import type { Copy, Language } from "@/lib/i18n";
import { defaultLanguage, dictionaries } from "@/lib/i18n";
import { maxQuantityFor } from "@/lib/catalog";

export type CartLine = Product & {
  quantity: number;
  variantId?: string;
  variantName?: string;
  maxQuantity: number;
};

export const cartLineKey = (line: Pick<CartLine, "id" | "variantId">) => `${line.id}:${line.variantId ?? "base"}`;

type CartContextValue = {
  lines: CartLine[];
  addToCart: (product: Product, quantity?: number, variantId?: string, variantName?: string) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  totalWeight: number;
  quantityInCart: (productId: string, variantId?: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

const cartStorageKey = "rendi-virgo-cart";
const languageStorageKey = "rendi-virgo-language";

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [language, setLanguage] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const savedCart = readJson<CartLine[]>(cartStorageKey);
    if (Array.isArray(savedCart)) {
      setLines(
        savedCart.flatMap((line) => {
          if (!line || typeof line !== "object" || typeof line.id !== "string") return [];
          const limit = maxQuantityFor(line, line.variantId);
          return [{ ...line, maxQuantity: limit, quantity: Math.min(Math.max(1, line.quantity), limit) }];
        }),
      );
    }
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (savedLanguage === "en" || savedLanguage === "id") setLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  const cartValue = useMemo<CartContextValue>(() => {
    const addToCart = (product: Product, quantity = 1, variantId?: string, variantName?: string) => {
      if (product.status !== "Available") return;
      const limit = maxQuantityFor(product, variantId);
      const key = cartLineKey({ id: product.id, variantId });
      setLines((current) => {
        const existing = current.find((line) => cartLineKey(line) === key);
        if (existing) {
          const nextQuantity = Math.min(existing.quantity + quantity, limit);
          if (nextQuantity === existing.quantity) return current;
          return current.map((line) =>
            cartLineKey(line) === key ? { ...line, quantity: nextQuantity, maxQuantity: limit } : line,
          );
        }
        return [...current, { ...product, quantity: Math.min(Math.max(1, quantity), limit), variantId, variantName, maxQuantity: limit }];
      });
    };

    const removeFromCart = (key: string) => setLines((current) => current.filter((line) => cartLineKey(line) !== key));

    const updateQuantity = (key: string, quantity: number) => {
      if (quantity <= 0) return removeFromCart(key);
      setLines((current) =>
        current.map((line) => (cartLineKey(line) === key ? { ...line, quantity: Math.min(quantity, line.maxQuantity) } : line)),
      );
    };

    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const totalWeight = lines.reduce((sum, line) => sum + line.weightGram * line.quantity, 0);
    const quantityInCart = (productId: string, variantId?: string) => {
      const key = cartLineKey({ id: productId, variantId });
      return lines.find((line) => cartLineKey(line) === key)?.quantity ?? 0;
    };

    return {
      lines,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart: () => setLines([]),
      itemCount,
      subtotal,
      totalWeight,
      quantityInCart,
    };
  }, [lines]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
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

export function useCopy(): Copy {
  const { language } = useLanguage();
  return dictionaries[language];
}
