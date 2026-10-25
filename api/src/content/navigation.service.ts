import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import type { StorefrontLanguage } from "../common/utils/storefront-language";
import { PrismaService } from "../prisma/prisma.service";

const NAVIGATION_SETTING_KEY = "navigation.primary";
const ROUTE_PATHS = {
  home: "/",
  shop: "/shop",
  wholesale: "/wholesale",
  about: "/about-us",
  journal: "/blog",
  contact: "/contact",
  account: "/account",
} as const;

type RouteKey = keyof typeof ROUTE_PATHS;
type NavigationTarget =
  | { type: "route"; route: RouteKey }
  | { type: "category"; slug: string }
  | { type: "page"; slug: string }
  | { type: "external"; url: string };

type NavigationItem = {
  id: string;
  labelEn: string;
  labelId: string;
  target: NavigationTarget;
  enabled: boolean;
  openInNewTab: boolean;
  children: NavigationItem[];
};

type CategoryDestination = {
  slug: string;
  name: string;
  nameId: string | null;
  idTranslationStatus: string;
  isActive: boolean;
};

type PageDestination = {
  slug: string;
  title: string;
  titleId: string | null;
  idTranslationStatus: string;
  status: string;
};

type ResolvedNavigationItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  openInNewTab: boolean;
  children: ResolvedNavigationItem[];
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_TOP_LEVEL_ITEMS = 16;
const MAX_CHILD_ITEMS = 16;

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getDestinations() {
    const [categories, pages] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { slug: true, name: true, nameId: true, idTranslationStatus: true, isActive: true },
      }),
      this.prisma.page.findMany({
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: { slug: true, title: true, titleId: true, idTranslationStatus: true, status: true },
      }),
    ]);
    return { categories, pages };
  }

  private defaultItems(categories: CategoryDestination[]): NavigationItem[] {
    const categoryItems = categories.filter((category) => category.isActive).slice(0, 6).map((category, index) => ({
      id: `shop-category-${index + 1}`,
      labelEn: category.name,
      labelId: category.idTranslationStatus === "Ready" && category.nameId?.trim() ? category.nameId : category.name,
      target: { type: "category", slug: category.slug } as const,
      enabled: true,
      openInNewTab: false,
      children: [],
    }));
    return [
      { id: "home", labelEn: "Home", labelId: "Beranda", target: { type: "route", route: "home" }, enabled: true, openInNewTab: false, children: [] },
      { id: "shop", labelEn: "Shop", labelId: "Belanja", target: { type: "route", route: "shop" }, enabled: true, openInNewTab: false, children: categoryItems },
      { id: "wholesale", labelEn: "Wholesale", labelId: "Wholesale", target: { type: "route", route: "wholesale" }, enabled: true, openInNewTab: false, children: [] },
      { id: "about", labelEn: "About Us", labelId: "Tentang Kami", target: { type: "route", route: "about" }, enabled: true, openInNewTab: false, children: [] },
      { id: "journal", labelEn: "Journal", labelId: "Jurnal", target: { type: "route", route: "journal" }, enabled: true, openInNewTab: false, children: [] },
      { id: "contact", labelEn: "Contact", labelId: "Kontak", target: { type: "route", route: "contact" }, enabled: true, openInNewTab: false, children: [] },
      { id: "account", labelEn: "Account", labelId: "Akun", target: { type: "route", route: "account" }, enabled: true, openInNewTab: false, children: [] },
    ];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private parseItems(value: unknown): NavigationItem[] {
    if (!Array.isArray(value)) throw new BadRequestException("Navigation items must be an array");
    if (value.length > MAX_TOP_LEVEL_ITEMS) throw new BadRequestException(`Navigation can contain up to ${MAX_TOP_LEVEL_ITEMS} top-level items`);
    const ids = new Set<string>();

    const parseItem = (raw: unknown, depth: number): NavigationItem => {
      if (!this.isRecord(raw)) throw new BadRequestException("Each navigation item must be an object");
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      const labelEn = typeof raw.labelEn === "string" ? raw.labelEn.trim() : "";
      const labelId = typeof raw.labelId === "string" ? raw.labelId.trim() : "";
      if (!ID_PATTERN.test(id) || ids.has(id)) throw new BadRequestException("Navigation item IDs must be unique and URL-safe");
      ids.add(id);
      if (!labelEn || labelEn.length > 60 || labelId.length > 60) {
        throw new BadRequestException("Navigation labels must have an English value and be no longer than 60 characters");
      }
      if (typeof raw.enabled !== "boolean") throw new BadRequestException("Navigation visibility must be a boolean");
      if (raw.openInNewTab !== undefined && typeof raw.openInNewTab !== "boolean") {
        throw new BadRequestException("openInNewTab must be a boolean");
      }
      if (!this.isRecord(raw.target)) throw new BadRequestException("Each navigation item needs a destination");

      let target: NavigationTarget;
      const targetType = raw.target.type;
      if (targetType === "route" && typeof raw.target.route === "string" && Object.prototype.hasOwnProperty.call(ROUTE_PATHS, raw.target.route)) {
        target = { type: "route", route: raw.target.route as RouteKey };
      } else if ((targetType === "category" || targetType === "page") && typeof raw.target.slug === "string" && SLUG_PATTERN.test(raw.target.slug)) {
        target = { type: targetType, slug: raw.target.slug };
      } else if (targetType === "external" && typeof raw.target.url === "string" && raw.target.url.length <= 2048) {
        let url: URL;
        try {
          url = new URL(raw.target.url);
        } catch {
          throw new BadRequestException("External navigation URLs must be valid absolute URLs");
        }
        if (url.protocol !== "https:" || url.username || url.password) {
          throw new BadRequestException("External navigation URLs must use HTTPS and cannot contain credentials");
        }
        target = { type: "external", url: url.toString() };
      } else {
        throw new BadRequestException("Unsupported navigation destination");
      }

      const rawChildren = raw.children ?? [];
      if (!Array.isArray(rawChildren)) throw new BadRequestException("Navigation children must be an array");
      if (depth > 0 && rawChildren.length) throw new BadRequestException("Navigation supports one submenu level");
      if (rawChildren.length > MAX_CHILD_ITEMS) throw new BadRequestException(`A submenu can contain up to ${MAX_CHILD_ITEMS} items`);
      const children = rawChildren.map((child) => parseItem(child, depth + 1));
      const openInNewTab = target.type === "external" && raw.openInNewTab === true;

      return { id, labelEn, labelId, target, enabled: raw.enabled, openInNewTab, children };
    };

    const items = value.map((item) => parseItem(item, 0));
    if (!items.some((item) => item.enabled)) {
      throw new BadRequestException("At least one top-level navigation item must be visible");
    }
    return items;
  }

  private storedItems(value: unknown, categories: CategoryDestination[]): NavigationItem[] {
    try {
      return this.parseItems(value);
    } catch {
      return this.defaultItems(categories);
    }
  }

  async getAdmin() {
    const [{ categories, pages }, setting] = await Promise.all([
      this.getDestinations(),
      this.prisma.siteSetting.findUnique({ where: { key: NAVIGATION_SETTING_KEY } }),
    ]);
    const items = setting ? this.storedItems(setting.value, categories) : this.defaultItems(categories);
    return {
      items,
      categories: categories.map((category) => ({
        slug: category.slug,
        label: category.name,
        labelId: category.idTranslationStatus === "Ready" && category.nameId?.trim() ? category.nameId : category.name,
        available: category.isActive,
      })),
      pages: pages.map((page) => ({
        slug: page.slug,
        label: page.title,
        labelId: page.idTranslationStatus === "Ready" && page.titleId?.trim() ? page.titleId : page.title,
        available: page.status === "Published",
      })),
    };
  }

  async getPublic(language: StorefrontLanguage = "en") {
    const { items, categories, pages } = await this.getAdmin();
    const categorySlugs = new Set(categories.filter((category) => category.available).map((category) => category.slug));
    const pageSlugs = new Set(pages.filter((page) => page.available).map((page) => page.slug));

    const resolve = (item: NavigationItem): string | null => {
      switch (item.target.type) {
        case "route": return ROUTE_PATHS[item.target.route];
        case "category": return categorySlugs.has(item.target.slug) ? `${ROUTE_PATHS.shop}/${item.target.slug}` : null;
        case "page": return pageSlugs.has(item.target.slug) ? `/${item.target.slug}` : null;
        case "external": return item.target.url;
      }
    };

    const toPublic = (item: NavigationItem): ResolvedNavigationItem | null => {
      if (!item.enabled) return null;
      const href = resolve(item);
      if (!href) return null;
      const children = item.children.map(toPublic).filter((child): child is NonNullable<typeof child> => child !== null);
      return {
        id: item.id,
        label: (language === "id" ? item.labelId : item.labelEn).trim() || item.labelEn,
        href,
        external: item.target.type === "external",
        openInNewTab: item.openInNewTab,
        children,
      };
    };

    return items.map(toPublic).filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async update(payload: unknown, context: AuditContext) {
    if (!this.isRecord(payload) || !("items" in payload)) {
      throw new BadRequestException("Body must contain an items array");
    }
    const items = this.parseItems(payload.items);
    const requestedCategories = new Set<string>();
    const requestedPages = new Set<string>();
    const collectEnabledTargets = (entries: NavigationItem[]) => {
      for (const item of entries) {
        if (!item.enabled) continue;
        if (item.target.type === "category") requestedCategories.add(item.target.slug);
        if (item.target.type === "page") requestedPages.add(item.target.slug);
        collectEnabledTargets(item.children);
      }
    };
    collectEnabledTargets(items);

    if (requestedCategories.size) {
      const available = await this.prisma.category.findMany({
        where: { slug: { in: [...requestedCategories] }, isActive: true },
        select: { slug: true },
      });
      const missing = [...requestedCategories].filter((slug) => !available.some((category) => category.slug === slug));
      if (missing.length) throw new BadRequestException(`These menu categories are inactive or missing: ${missing.join(", ")}`);
    }
    if (requestedPages.size) {
      const available = await this.prisma.page.findMany({
        where: { slug: { in: [...requestedPages] }, status: "Published" },
        select: { slug: true },
      });
      const missing = [...requestedPages].filter((slug) => !available.some((page) => page.slug === slug));
      if (missing.length) throw new BadRequestException(`These menu pages are unpublished or missing: ${missing.join(", ")}`);
    }

    await this.prisma.siteSetting.upsert({
      where: { key: NAVIGATION_SETTING_KEY },
      create: { key: NAVIGATION_SETTING_KEY, value: items as unknown as Prisma.InputJsonValue },
      update: { value: items as unknown as Prisma.InputJsonValue },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "navigation.update",
      entityType: "SiteSetting",
      entityId: NAVIGATION_SETTING_KEY,
      summary: `Updated primary navigation (${items.length} top-level item(s))`,
      metadata: { itemIds: items.map((item) => item.id) },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.getAdmin();
  }
}
