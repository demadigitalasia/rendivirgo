export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<unknown | null>,
  fallback = "item",
): Promise<string> {
  const root = base || fallback;
  let candidate = root;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 200) {
      candidate = `${root}-${Date.now()}`;
      break;
    }
  }
  return candidate;
}
