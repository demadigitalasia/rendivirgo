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
  wholesaleCatalog: "/wholesale",
  wholesaleCheckout: "/wholesale/checkout",
} as const;

export function isStorefrontRouteActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function canAccessWholesale(customer: { wholesaleAccess?: boolean } | null | undefined): boolean {
  return customer?.wholesaleAccess === true;
}
