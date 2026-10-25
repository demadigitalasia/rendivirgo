export const storefrontRoutes = {
  home: "/",
  shop: "/shop",
  about: "/about-us",
  journal: "/blog",
  contact: "/contact",
  account: "/account",
  accountOrders: "/account/orders",
  wishlist: "/wishlist",
  cart: "/cart",
  wholesaleHome: "/wholesale",
  lapidary: "/lapidary",
  wholesaleCatalog: "/wholesale/finished",
  roughMaterials: "/wholesale/rough",
  wholesaleCheckout: "/wholesale/checkout",
} as const;

export type NavigationRouteKey = "home" | "shop" | "wholesale" | "about" | "journal" | "contact" | "account";
export const navigationRouteOptions: Array<{ value: NavigationRouteKey; label: string }> = [
  { value: "home", label: "Home" }, { value: "shop", label: "Shop" },
  { value: "wholesale", label: "Wholesale" }, { value: "about", label: "About us" },
  { value: "journal", label: "Journal" }, { value: "contact", label: "Contact" },
  { value: "account", label: "Customer account" },
];
export type NavigationTarget = { type: "route"; route: NavigationRouteKey }
  | { type: "category"; slug: string } | { type: "page"; slug: string } | { type: "external"; url: string };
export type AdminNavigationItem = { id: string; labelEn: string; labelId: string; target: NavigationTarget; enabled: boolean; openInNewTab: boolean; children: AdminNavigationItem[] };
export type AdminNavigationData = { items: AdminNavigationItem[]; categories: Array<{ slug: string; label: string; labelId: string; available: boolean }>; pages: Array<{ slug: string; label: string; labelId: string; available: boolean }> };

export function isStorefrontRouteActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function canAccessWholesale(customer: { wholesaleAccess?: boolean } | null | undefined): boolean {
  return customer?.wholesaleAccess === true;
}
