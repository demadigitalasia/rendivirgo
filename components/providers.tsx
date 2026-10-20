"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import type { Copy, Language } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";
import { maxQuantityFor } from "@/lib/catalog";
import type { ProductWatermarkSettings } from "@/lib/product-watermark";
import { localizedPath } from "@/lib/locale";

export type CartLine = Product & {
  quantity: number;
  variantId?: string;
  variantName?: string;
  maxQuantity: number;
};

export const cartLineKey = (line: Pick<CartLine, "id" | "variantId" | "wholesale">) => `${line.id}:${line.variantId ?? "base"}:${line.wholesale ? "wholesale" : "retail"}`;

type CartContextValue = {
  lines: CartLine[];
  hydrated: boolean;
  addToCart: (product: Product, quantity?: number, variantId?: string, variantName?: string) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: (channel?: "retail" | "wholesale") => void;
  itemCount: number;
  subtotal: number;
  totalWeight: number;
  quantityInCart: (productId: string, variantId?: string, wholesale?: boolean) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const ProductWatermarkContext = createContext<ProductWatermarkSettings | null>(null);

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

export function Providers({
  children,
  productWatermark,
  initialLanguage,
  hasLanguagePreferenceCookie,
}: {
  children: React.ReactNode;
  productWatermark: ProductWatermarkSettings;
  initialLanguage: Language;
  hasLanguagePreferenceCookie: boolean;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [activeProductWatermark, setActiveProductWatermark] = useState(productWatermark);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [cartAnnouncement, setCartAnnouncement] = useState("");
  const previousItemCount = useRef<number | null>(null);

  useEffect(() => {
    const savedCart = readJson<CartLine[]>(cartStorageKey);
    if (Array.isArray(savedCart)) {
      setLines(
        savedCart.flatMap((line) => {
          if (!line || typeof line !== "object" || typeof line.id !== "string") return [];
          const limit = maxQuantityFor(line, line.variantId);
          const quantity = Number(line.quantity);
          if (limit <= 0 || !Number.isInteger(quantity) || quantity < 1) return [];
          return [{ ...line, maxQuantity: limit, quantity: Math.min(quantity, limit) }];
        }),
      );
    }
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    const hasExplicitLanguagePath = window.location.pathname === "/id" || window.location.pathname.startsWith("/id/");
    if (!hasLanguagePreferenceCookie && (savedLanguage === "en" || savedLanguage === "id") && savedLanguage !== initialLanguage && !hasExplicitLanguagePath) {
      void fetch("/api/language", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ language: savedLanguage }),
      }).then((response) => {
        if (response.ok) window.location.replace(`${localizedPath(window.location.pathname, savedLanguage)}${window.location.search}`);
      });
    }
    setStorageReady(true);
  }, [hasLanguagePreferenceCookie, initialLanguage]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/public", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Record<string, unknown>>) : null))
      .then((settings) => {
        if (!settings) return;
        const number = (key: string, fallback: number) => {
          const value = settings[key];
          return typeof value === "number" && Number.isFinite(value) ? value : fallback;
        };
        setActiveProductWatermark({
          enabled:
            typeof settings["store.productWatermarkEnabled"] === "boolean"
              ? settings["store.productWatermarkEnabled"]
              : productWatermark.enabled,
          logo:
            typeof settings["store.productWatermarkLogo"] === "string" && settings["store.productWatermarkLogo"]
              ? settings["store.productWatermarkLogo"]
              : productWatermark.logo,
          opacity: number("store.productWatermarkOpacity", productWatermark.opacity),
          size: number("store.productWatermarkSize", productWatermark.size),
          x: number("store.productWatermarkX", productWatermark.x),
          y: number("store.productWatermarkY", productWatermark.y),
        });
      })
      .catch(() => {
        // Keep the server-rendered configuration if the settings request fails.
      });

    return () => controller.abort();
  }, [productWatermark]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(lines));
  }, [lines, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language === "id" ? "id-ID" : "en-GB";
  }, [language, storageReady]);

  const clearCart = useCallback((channel?: "retail" | "wholesale") => {
    setLines((current) => {
      if (!channel) return current.length ? [] : current;
      const isWholesale = (line: CartLine) => line.wholesale === true;
      const next = current.filter((line) => channel === "wholesale" ? !isWholesale(line) : isWholesale(line));
      return next.length === current.length ? current : next;
    });
  }, []);

  const cartValue = useMemo<CartContextValue>(() => {
    const addToCart = (product: Product, quantity = 1, variantId?: string, variantName?: string) => {
      if (product.status !== "Available") return;
      if (product.variants?.length && !variantId) return;
      const limit = maxQuantityFor(product, variantId);
      if (limit <= 0) return;
      const key = cartLineKey({ id: product.id, variantId, wholesale: product.wholesale });
      const selectedVariant = variantId ? product.variants?.find((variant) => variant.id === variantId) : undefined;
      const cartProduct = selectedVariant
        ? {
            ...product,
            price: selectedVariant.price,
            weightGram: selectedVariant.weightGram,
            sku: selectedVariant.sku,
            wholesalePiecesPerUnit: selectedVariant.wholesalePiecesPerUnit ?? product.wholesalePiecesPerUnit,
          }
        : product;
      setLines((current) => {
        const existing = current.find((line) => cartLineKey(line) === key);
        if (existing) {
          const nextQuantity = Math.min(existing.quantity + quantity, limit);
          if (nextQuantity === existing.quantity) return current;
          return current.map((line) =>
            cartLineKey(line) === key ? { ...line, quantity: nextQuantity, maxQuantity: limit } : line,
          );
        }
        return [...current, { ...cartProduct, quantity: Math.min(Math.max(1, quantity), limit), variantId, variantName, maxQuantity: limit }];
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
    const quantityInCart = (productId: string, variantId?: string, wholesale = false) => {
      const key = cartLineKey({ id: productId, variantId, wholesale });
      return lines.find((line) => cartLineKey(line) === key)?.quantity ?? 0;
    };

    return {
      lines,
      hydrated: storageReady,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      itemCount,
      subtotal,
      totalWeight,
      quantityInCart,
    };
  }, [clearCart, lines, storageReady]);

  useEffect(() => {
    const count = cartValue.itemCount;
    if (previousItemCount.current === null) {
      previousItemCount.current = count;
      return;
    }
    if (previousItemCount.current === count) return;
    previousItemCount.current = count;
    setCartAnnouncement(dictionaries[language].cart.liveUpdate(count));
    const timer = window.setTimeout(() => setCartAnnouncement(""), 5000);
    return () => window.clearTimeout(timer);
  }, [cartValue, language]);

  return (
    <ProductWatermarkContext.Provider value={activeProductWatermark}>
      <LanguageContext.Provider value={{ language, setLanguage }}>
        <CartContext.Provider value={cartValue}>
          {children}
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {cartAnnouncement}
          </span>
        </CartContext.Provider>
      </LanguageContext.Provider>
    </ProductWatermarkContext.Provider>
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

export function useOptionalLanguage(): Language | null {
  return useContext(LanguageContext)?.language ?? null;
}

export function useProductWatermark() {
  const context = useContext(ProductWatermarkContext);
  if (!context) throw new Error("useProductWatermark must be used inside Providers");
  return context;
}

export function useCopy(): Copy {
  const { language } = useLanguage();
  return dictionaries[language];
}
