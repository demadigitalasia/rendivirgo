import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import defaults from "./hero-defaults.json";
import { HeroSlideDto, SaveHeroSlidesDto } from "./hero-slides.dto";

const SETTINGS_KEY = "home.heroSlider";
const isSafePath = (value: string) => /^\/(?!\/)/.test(value) && !/[\\\s\u0000-\u001f]/.test(value);
function safeUrl(value: string, image = false): boolean {
  if (!value) return true;
  if (isSafePath(value)) return true;
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" ||
      (image && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch { return false; }
}

@Injectable()
export class HeroSlidesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async read(db: Prisma.TransactionClient): Promise<SaveHeroSlidesDto> {
    const [setting, rows] = await Promise.all([
      db.siteSetting.findUnique({ where: { key: SETTINGS_KEY } }),
      db.banner.findMany({ where: { placement: "HomeHero" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    const document = plainToInstance(SaveHeroSlidesDto, structuredClone(defaults));
    document.version = setting?.updatedAt.toISOString() ?? "initial";
    if (setting) {
      document.settings = (setting.value as unknown as { settings: SaveHeroSlidesDto["settings"] }).settings;
      document.slides = rows.map(row => ({ ...(row.heroContent as unknown as HeroSlideDto), id: row.id, isActive: row.isActive }));
      return document;
    }

    // Existing single-image home content becomes the opening slide. Old unused banners remain drafts.
    const legacy = await db.siteSetting.findMany({ where: { key: { in: ["home.heroTitle", "home.heroSubtitle", "home.heroTitleId", "home.heroSubtitleId", "home.heroImage", "home.idTranslationStatus"] } } });
    const content = new Map(legacy.map(row => [row.key, row.value]));
    const first = document.slides[0];
    const title = String(content.get("home.heroTitle") ?? "");
    const subtitle = String(content.get("home.heroSubtitle") ?? "");
    const customTitle = title && !["Explore the Collection", "Jelajahi Koleksi"].includes(title);
    const customSubtitle = subtitle && subtitle !== defaults.slides[0].en.description;
    if (customTitle) first.en.title = title;
    if (customSubtitle) first.en.description = subtitle;
    first.imageUrl = String(content.get("home.heroImage") || first.imageUrl);
    if (customTitle || customSubtitle) {
      first.translationStatus = content.get("home.idTranslationStatus") === "Ready" && content.get("home.heroTitleId") && content.get("home.heroSubtitleId") ? "Ready" : "Review";
      if (content.get("home.heroTitleId")) first.idCopy.title = String(content.get("home.heroTitleId"));
      if (content.get("home.heroSubtitleId")) first.idCopy.description = String(content.get("home.heroSubtitleId"));
    }
    const featured = await db.product.findFirst({ where: { status: "Published", sellOnWeb: true, category: { isActive: true } }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], select: { id: true } });
    first.productId = featured?.id ?? "";
    for (const row of rows) {
      document.slides.push({ ...structuredClone(first), id: row.id, name: `Legacy: ${row.title}`.slice(0, 100), isActive: false,
        translationStatus: "Missing", imageUrl: row.imageUrl ?? "", ctaHref: row.ctaHref ?? "", cardType: "none", productId: "",
        en: { ...first.en, title: row.title, description: row.subtitle ?? "", ctaLabel: row.ctaLabel ?? "" }, idCopy: { ...first.idCopy, title: "", description: "" } });
    }
    return document;
  }

  getAdmin() { return this.read(this.prisma); }

  async getPublic() {
    const document = await this.getAdmin();
    const active = document.slides.filter(slide => slide.isActive).slice(0, 5);
    const ids = active.filter(slide => slide.cardType === "product" && slide.productId).map(slide => slide.productId);
    const products = ids.length ? await this.prisma.product.findMany({
      where: { id: { in: ids }, status: "Published", sellOnWeb: true, category: { isActive: true } },
      select: { id: true, name: true, nameId: true, idTranslationStatus: true, price: true, stoneType: true, origin: true, slug: true, category: { select: { slug: true } } },
    }) : [];
    return { ...document, slides: active.map(slide => {
      const product = products.find(item => item.id === slide.productId);
      return { ...slide, idCopy: slide.translationStatus === "Ready" ? slide.idCopy : slide.en, product: product ? {
        name: product.name, nameId: product.idTranslationStatus === "Ready" ? product.nameId || product.name : product.name,
        price: Number(product.price), detail: [product.stoneType, product.origin.split(",")[0]].filter(Boolean).join(" · "),
        href: `/shop/${product.category.slug}/${product.slug}`,
      } : null };
    }) };
  }

  async save(input: SaveHeroSlidesDto, context: AuditContext) {
    if (!input.settings || input.slides.some(slide => !slide.en || !slide.idCopy)) throw new BadRequestException("Slide content and settings are required");
    const active = input.slides.filter(slide => slide.isActive);
    if (active.length < 1 || active.length > 5) throw new BadRequestException("Publish between 1 and 5 active slides");
    if (new Set(input.slides.map(slide => slide.id)).size !== input.slides.length) throw new BadRequestException("Slide IDs must be unique");
    for (const slide of input.slides) {
      if (![slide.imageUrl, slide.mobileImageUrl].every(url => safeUrl(url, true))) throw new BadRequestException(`Invalid image URL for ${slide.name}`);
      if (![slide.ctaHref, slide.secondaryHref, slide.cardHref].every(url => safeUrl(url))) throw new BadRequestException(`Use a site path or HTTPS link for ${slide.name}`);
      if (slide.isActive && (!slide.imageUrl || !slide.en.label.trim() || !slide.en.title.trim() || !slide.en.description.trim() || !slide.en.ctaLabel.trim() || !slide.ctaHref)) {
        throw new BadRequestException(`Complete the image, navigation label, heading, description and main button for ${slide.name}`);
      }
      if (slide.translationStatus === "Ready") {
        const missing = Object.keys(slide.en).some(key => Boolean(slide.en[key as keyof typeof slide.en].trim()) && !slide.idCopy[key as keyof typeof slide.idCopy].trim());
        if (missing) throw new BadRequestException(`Complete the Indonesian translation before marking ${slide.name} Ready`);
      }
    }
    try {
      await this.prisma.$transaction(async tx => {
        const current = await tx.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
        if ((current?.updatedAt.toISOString() ?? "initial") !== input.version) throw new ConflictException("These slides changed in another session. Reload before publishing.");
        const conflicting = await tx.banner.findFirst({ where: { id: { in: input.slides.map(slide => slide.id) }, placement: { not: "HomeHero" } } });
        if (conflicting) throw new BadRequestException("A slide ID belongs to a different banner placement");
        await tx.banner.deleteMany({ where: { placement: "HomeHero", id: { notIn: input.slides.map(slide => slide.id) } } });
        for (const [sortOrder, slide] of input.slides.entries()) {
          const data = { title: slide.en.title || slide.name, subtitle: slide.en.description, imageUrl: slide.imageUrl, ctaLabel: slide.en.ctaLabel, ctaHref: slide.ctaHref,
            focalX: slide.focalX, focalY: slide.focalY, isActive: slide.isActive, sortOrder, heroContent: slide as unknown as Prisma.InputJsonValue };
          await tx.banner.upsert({ where: { id: slide.id }, create: { id: slide.id, placement: "HomeHero", ...data }, update: data });
        }
        await tx.siteSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: { settings: input.settings } as unknown as Prisma.InputJsonValue }, update: { value: { settings: input.settings } as unknown as Prisma.InputJsonValue } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new ConflictException("Another editor published changes. Reload before publishing.");
      throw error;
    }
    await this.audit.log({ adminId: context.adminId, action: "hero_slides.publish", entityType: "Banner", summary: `Published ${active.length} home hero slides`, metadata: { slideIds: input.slides.map(slide => slide.id) }, ip: context.ip, userAgent: context.userAgent });
    return this.getAdmin();
  }
}
