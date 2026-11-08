// MCP tools for the RENDI VIRGO admin API. Each tool calls the internal Nest API
// (API_ORIGIN) with the caller's own API key, so Nest-side scopes and audit
// logging apply unchanged.

import { apiOrigin } from "@/lib/api-proxy";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, token: string) => Promise<unknown>;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UPLOAD_FOLDERS = ["products", "rough-materials", "lapidary", "blog", "banners", "pages", "brand", "misc"];
const ADMIN_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

export class McpToolError extends Error {}

async function apiFetch<T = unknown>(token: string, path: string, init?: RequestInit): Promise<T> {
  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}/api${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new McpToolError(`Store API unreachable: ${(error as Error).message}`);
  }

  const text = await upstream.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON body (e.g. CSV export)
    if (upstream.ok) return text as unknown as T;
    throw new McpToolError(`Store API returned ${upstream.status} with a non-JSON body`);
  }

  if (!upstream.ok) {
    const detail = parsed as { message?: string | string[] } | undefined;
    const message = Array.isArray(detail?.message) ? detail?.message.join("; ") : detail?.message;
    throw new McpToolError(`HTTP ${upstream.status}: ${message ?? text.slice(0, 500)}`);
  }
  return parsed as T;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

const str = (args: Record<string, unknown>, key: string): string => {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new McpToolError(`"${key}" must be a non-empty string`);
  return value;
};

const optStr = (args: Record<string, unknown>, key: string): string | undefined => {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
};

const optNum = (args: Record<string, unknown>, key: string): number | undefined => {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const pageQuery = (args: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const key of ["page", "pageSize", "status", "paymentStatus", "source", "tag", "q"]) {
    const value = optStr(args, key);
    if (value) params.set(key, value);
  }
  return params.toString();
};

export function buildMcpTools(): McpTool[] {
  const tools: McpTool[] = [
    // ---------------------------------------------------------------- products
    {
      name: "rv_list_products",
      description:
        "List admin products (RENDI VIRGO catalog). Returns id, name, sku, status, price, stock. Filter by status (Draft|Published|Reserved|Sold|Archived) or search text.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search text (name/sku)" },
          status: { type: "string", enum: ["Draft", "Published", "Reserved", "Sold", "Archived"] },
          page: { type: "number" },
          pageSize: { type: "number", maximum: 100 },
        },
      },
      handler: async (args, token) => apiFetch(token, `/admin/products?${pageQuery(args)}`),
    },
    {
      name: "rv_get_product",
      description: "Get one product by id, including images, variants, SEO fields and price history.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      handler: async (args, token) => apiFetch(token, `/admin/products/${str(args, "id")}`),
    },
    {
      name: "rv_create_product",
      description:
        "Create a product. REQUIRED: name, categoryId, stoneType, origin, price (USD number), weightGram (integer). " +
        "Get categoryId from rv_list_categories. Optional: description, images: [{url, alt?, sortOrder?}] (upload first with rv_upload_image), " +
        "variants: [{sku, name, price, stockQuantity, weightGram}], status (default Draft). New products should stay Draft until reviewed.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          categoryId: { type: "string" },
          stoneType: { type: "string" },
          origin: { type: "string" },
          price: { type: "number" },
          weightGram: { type: "integer" },
          description: { type: "string" },
          status: { type: "string", enum: ["Draft", "Published", "Reserved", "Sold", "Archived"] },
          images: { type: "array", items: { type: "object", properties: { url: { type: "string" }, alt: { type: "string" }, sortOrder: { type: "integer" } }, required: ["url"] } },
          variants: { type: "array", items: { type: "object", properties: { sku: { type: "string" }, name: { type: "string" }, price: { type: "number" }, stockQuantity: { type: "integer" }, weightGram: { type: "integer" } }, required: ["sku", "name", "price", "stockQuantity", "weightGram"] } },
        },
        required: ["name", "categoryId", "stoneType", "origin", "price", "weightGram"],
      },
      handler: async (args, token) => apiFetch(token, "/admin/products", { method: "POST", body: JSON.stringify(args) }),
    },
    {
      name: "rv_update_product",
      description: "Update product fields by id (partial). Use rv_get_product first to see current values.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          fields: { type: "object", description: "Partial product payload, same shape as rv_create_product minus required-only rules (all keys optional)" },
        },
        required: ["id", "fields"],
      },
      handler: async (args, token) =>
        apiFetch(token, `/admin/products/${str(args, "id")}`, {
          method: "PATCH",
          body: JSON.stringify(args.fields ?? {}),
        }),
    },
    {
      name: "rv_bulk_products",
      description: 'Bulk action on products: Publish, Unpublish, Archive, Restore or Delete (soft) a list of ids.',
      inputSchema: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, minItems: 1 },
          action: { type: "string", enum: ["Publish", "Unpublish", "Archive", "Restore", "Delete"] },
        },
        required: ["ids", "action"],
      },
      handler: async (args, token) =>
        apiFetch(token, "/admin/products/bulk", {
          method: "PATCH",
          body: JSON.stringify({ ids: args.ids, action: str(args, "action") }),
        }),
    },
    {
      name: "rv_list_categories",
      description: "List product categories (id, name, slug).",
      inputSchema: { type: "object", properties: {} },
      handler: async (_args, token) => apiFetch(token, "/admin/categories"),
    },
    {
      name: "rv_create_category",
      description: "Create a product category. REQUIRED: name. Optional: slug, description, imageUrl.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          imageUrl: { type: "string" },
        },
        required: ["name"],
      },
      handler: async (args, token) => apiFetch(token, "/admin/categories", { method: "POST", body: JSON.stringify(args) }),
    },

    // ---------------------------------------------------------------- content
    {
      name: "rv_list_blog_posts",
      description: "List blog posts (all statuses). Filter by status Draft|Published|Scheduled|Archived or tag.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["Draft", "Published", "Scheduled", "Archived"] },
          tag: { type: "string" },
          page: { type: "number" },
          pageSize: { type: "number", maximum: 100 },
        },
      },
      handler: async (args, token) => apiFetch(token, `/admin/blog?${pageQuery(args)}`),
    },
    {
      name: "rv_create_blog_post",
      description:
        "Create a blog post. REQUIRED: title. Optional: slug, excerpt, body (markdown), coverImage (upload with rv_upload_image to folder 'blog' first), tags: string[], " +
        "status (Draft|Published|Scheduled|Archived), publishedAt (ISO date, required when Published/Scheduled), metaTitle, metaDescription.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          excerpt: { type: "string" },
          body: { type: "string" },
          coverImage: { type: "string" },
          coverAlt: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["Draft", "Published", "Scheduled", "Archived"] },
          publishedAt: { type: "string", description: "ISO 8601 date" },
          metaTitle: { type: "string" },
          metaDescription: { type: "string" },
        },
        required: ["title"],
      },
      handler: async (args, token) => apiFetch(token, "/admin/blog", { method: "POST", body: JSON.stringify(args) }),
    },
    {
      name: "rv_update_blog_post",
      description: "Update a blog post by id (partial, same fields as rv_create_blog_post).",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, fields: { type: "object" } },
        required: ["id", "fields"],
      },
      handler: async (args, token) =>
        apiFetch(token, `/admin/blog/${str(args, "id")}`, { method: "PATCH", body: JSON.stringify(args.fields ?? {}) }),
    },
    {
      name: "rv_list_pages",
      description: "List static pages (about, policies, etc.).",
      inputSchema: { type: "object", properties: {} },
      handler: async (_args, token) => apiFetch(token, "/admin/pages"),
    },
    {
      name: "rv_create_page",
      description:
        "Create a static page. REQUIRED: title. Optional: slug, body (markdown), status (Draft|Published|Scheduled|Archived), showInFooter, sortOrder.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          body: { type: "string" },
          status: { type: "string", enum: ["Draft", "Published", "Scheduled", "Archived"] },
          showInFooter: { type: "boolean" },
          sortOrder: { type: "integer" },
        },
        required: ["title"],
      },
      handler: async (args, token) => apiFetch(token, "/admin/pages", { method: "POST", body: JSON.stringify(args) }),
    },
    {
      name: "rv_update_page",
      description: "Update a static page by id (partial, same fields as rv_create_page).",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, fields: { type: "object" } },
        required: ["id", "fields"],
      },
      handler: async (args, token) =>
        apiFetch(token, `/admin/pages/${str(args, "id")}`, { method: "PATCH", body: JSON.stringify(args.fields ?? {}) }),
    },
    {
      name: "rv_list_banners",
      description: "List banners. Placement: HomeHero|HomeOwner|Promo.",
      inputSchema: { type: "object", properties: {} },
      handler: async (_args, token) => apiFetch(token, "/admin/banners"),
    },
    {
      name: "rv_update_banner",
      description:
        "Update a banner by id. Get ids from rv_list_banners. Optional: title, subtitle, imageUrl, ctaLabel, ctaHref, placement, isActive, sortOrder, focalX/focalY (0-1).",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, fields: { type: "object" } },
        required: ["id", "fields"],
      },
      handler: async (args, token) =>
        apiFetch(token, `/admin/banners/${str(args, "id")}`, { method: "PATCH", body: JSON.stringify(args.fields ?? {}) }),
    },
    {
      name: "rv_get_hero_slides",
      description: "Read the homepage hero slider document (read-only; edits are done in the admin UI because saving replaces the whole document).",
      inputSchema: { type: "object", properties: {} },
      handler: async (_args, token) => apiFetch(token, "/admin/hero-slides"),
    },

    // ---------------------------------------------------------------- media
    {
      name: "rv_upload_image",
      description:
        `Upload an image (jpeg/png/webp/gif/avif, max 8 MB, base64-encoded) and return its public URL. ` +
        `folder must be one of: ${UPLOAD_FOLDERS.join(", ")}. Put the returned url into product images, blog coverImage or banner imageUrl.`,
      inputSchema: {
        type: "object",
        properties: {
          folder: { type: "string", enum: UPLOAD_FOLDERS },
          filename: { type: "string", description: "Original file name, used for the extension" },
          dataBase64: { type: "string", description: "Base64-encoded image bytes" },
        },
        required: ["folder", "filename", "dataBase64"],
      },
      handler: async (args, token) => {
        const folder = str(args, "folder");
        if (!UPLOAD_FOLDERS.includes(folder)) throw new McpToolError(`folder must be one of: ${UPLOAD_FOLDERS.join(", ")}`);
        const dataBase64 = str(args, "dataBase64").replace(/^data:[^;]+;base64,/, "");
        const bytes = Buffer.from(dataBase64, "base64");
        if (!bytes.length) throw new McpToolError("dataBase64 is empty or not valid base64");
        if (bytes.length > MAX_IMAGE_BYTES) throw new McpToolError("Image exceeds the 8 MB limit");

        const filename = str(args, "filename").replace(/[^\w.\-]+/g, "_") || "image";
        const extension = filename.split(".").pop()?.toLowerCase() ?? "";
        const mimeByExtension: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          gif: "image/gif",
          avif: "image/avif",
        };
        const mime = mimeByExtension[extension];
        if (!mime) throw new McpToolError("filename must end in .jpg, .jpeg, .png, .webp, .gif or .avif");
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
        return apiFetch(token, `/admin/uploads?folder=${encodeURIComponent(folder)}`, { method: "POST", body: form });
      },
    },
    {
      name: "rv_list_uploads",
      description: "List recently uploaded media assets (id, url, folder). Filter by folder.",
      inputSchema: {
        type: "object",
        properties: { folder: { type: "string", enum: UPLOAD_FOLDERS } },
      },
      handler: async (args, token) => {
        const folder = optStr(args, "folder");
        return apiFetch(token, `/admin/uploads${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`);
      },
    },

    // ---------------------------------------------------------------- orders
    {
      name: "rv_list_orders",
      description:
        "List orders. Optional filters: status (New|Processing|Packed|Shipped|Completed|Cancelled|Returned), paymentStatus (Pending|Paid|Failed|Refunded|PartiallyRefunded), source (Online|POS|Wholesale), page, pageSize.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["New", "Processing", "Packed", "Shipped", "Completed", "Cancelled", "Returned"] },
          paymentStatus: { type: "string", enum: ["Pending", "Paid", "Failed", "Refunded", "PartiallyRefunded"] },
          source: { type: "string", enum: ["Online", "POS", "Wholesale"] },
          page: { type: "number" },
          pageSize: { type: "number", maximum: 100 },
        },
      },
      handler: async (args, token) => apiFetch(token, `/admin/orders?${pageQuery(args)}`),
    },
    {
      name: "rv_get_order",
      description: "Get one order by id with items, payment and event history.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      handler: async (args, token) => apiFetch(token, `/admin/orders/${str(args, "id")}`),
    },
    {
      name: "rv_update_order",
      description: "Update shipping/note fields of an order. Optional: carrier, trackingNumber, trackingUrl, internalNote, customerNote. Fulfilment status changes and refunds are not exposed here.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          carrier: { type: "string" },
          trackingNumber: { type: "string" },
          trackingUrl: { type: "string" },
          internalNote: { type: "string" },
          customerNote: { type: "string" },
        },
        required: ["id"],
      },
      handler: async (args, token) => {
        const fields = { ...args };
        delete fields.id;
        return apiFetch(token, `/admin/orders/${str(args, "id")}`, { method: "PATCH", body: JSON.stringify(fields) });
      },
    },
    {
      name: "rv_add_order_event",
      description: "Append a note/event to an order's timeline.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, message: { type: "string" } },
        required: ["id", "message"],
      },
      handler: async (args, token) =>
        apiFetch(token, `/admin/orders/${str(args, "id")}/events`, {
          method: "POST",
          body: JSON.stringify({ message: str(args, "message") }),
        }),
    },

    // ---------------------------------------------------------------- escape hatch
    {
      name: "rv_api",
      description:
        "Generic call to any admin endpoint of the RENDI VIRGO API, for actions not covered by other tools (discounts, reviews, newsletter, shipping, settings...). " +
        "path must start with 'admin/' (no leading slash), e.g. 'admin/discounts'. body is the JSON payload (omit for GET).",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ADMIN_METHODS },
          path: { type: "string", pattern: "^admin/" },
          body: { type: "object", description: "JSON request body (POST/PATCH/PUT only)" },
        },
        required: ["method", "path"],
      },
      handler: async (args, token) => {
        const method = str(args, "method").toUpperCase();
        if (!ADMIN_METHODS.includes(method)) throw new McpToolError(`method must be one of ${ADMIN_METHODS.join(", ")}`);
        let path = str(args, "path");
        if (!path.startsWith("admin/")) throw new McpToolError("path must start with 'admin/'");
        if (!path.startsWith("/")) path = `/${path}`;
        const hasBody = args.body !== undefined && method !== "GET" && method !== "DELETE";
        return apiFetch(token, path, {
          method,
          ...(hasBody ? { body: JSON.stringify(args.body) } : {}),
        });
      },
    },
  ];
  return tools.map((tool) => ({
    ...tool,
    // Result payloads are stringified once, at the MCP boundary.
    handler: async (args: Record<string, unknown>, token: string): Promise<string> => json(await tool.handler(args, token)),
  }));
}

export { json as stringifyToolResult };
