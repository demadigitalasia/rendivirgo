import { Prisma } from "../../generated/prisma";
import type { WholesaleCatalogQueryDto } from "./dto/wholesale-catalog-query.dto";

/** Match effective FROM prices in SQL, before filtering, sorting and pagination. */
export function wholesalePriceQuery(query: WholesaleCatalogQueryDto) {
  const filters = [Prisma.sql`p."status" = 'Published'`, Prisma.sql`p."sellInWholesale" = true`, Prisma.sql`p."isBulkMaterial" = false`, Prisma.sql`(p."stockModel" = 'Quantity' OR NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id))`];
  if (query.category) filters.push(Prisma.sql`c.slug = ${query.category}`);
  if (query.stoneType) filters.push(Prisma.sql`LOWER(p."stoneType") = LOWER(${query.stoneType})`);
  if (query.origin) filters.push(Prisma.sql`LOWER(p.origin) = LOWER(${query.origin})`);
  const search = query.search?.trim().slice(0, 100);
  if (search) {
    const term = `%${search}%`;
    filters.push(Prisma.sql`(p.name ILIKE ${term} OR p.sku ILIKE ${term} OR p."stoneType" ILIKE ${term} OR p.description ILIKE ${term} OR c.name ILIKE ${term})`);
  }
  const inStock = Prisma.sql`((p."stockModel" = 'Unique' AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id)) OR (p."stockModel" = 'Quantity' AND COALESCE(p."stockQuantity", 0) > 0 AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id)) OR EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."stockQuantity" > 0))`;
  if (query.availability === "in-stock") filters.push(inStock);
  if (query.availability === "out-of-stock") filters.push(Prisma.sql`NOT ${inStock}`);
  const range: Prisma.Sql[] = [];
  if (query.minPrice !== undefined) range.push(Prisma.sql`"fromPrice" >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) range.push(Prisma.sql`"fromPrice" <= ${query.maxPrice}`);
  const rows = Prisma.sql`WITH priced AS (
    SELECT p.id, p.name, p.featured, p."createdAt",
      CASE WHEN EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id)
        THEN (SELECT MIN(COALESCE(v."wholesalePrice", p."wholesalePrice")) FROM "ProductVariant" v WHERE v."productId" = p.id)
        ELSE p."wholesalePrice" END AS "fromPrice"
    FROM "Product" p JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${Prisma.join(filters, " AND ")}
  ) SELECT * FROM priced WHERE ${range.length ? Prisma.join(range, " AND ") : Prisma.sql`true`}`;
  const ordering = {
    "price-asc": Prisma.sql`"fromPrice" ASC NULLS LAST, name ASC, id ASC`,
    "price-desc": Prisma.sql`"fromPrice" DESC NULLS LAST, name ASC, id ASC`,
    "name-asc": Prisma.sql`name ASC, id ASC`,
    "name-desc": Prisma.sql`name DESC, id ASC`,
    newest: Prisma.sql`"createdAt" DESC, id ASC`,
    featured: Prisma.sql`featured DESC, "createdAt" DESC, id ASC`,
  }[query.sort];
  return { rows, ordering };
}
