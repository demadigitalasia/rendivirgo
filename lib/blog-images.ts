export type BlogBodyImage = {
  url: string;
  alt: string;
  caption?: string;
};

function unescapeMarkdown(value: string) {
  return value.replace(/\\([\\\]"])/g, "$1");
}

function escapeMarkdown(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function escapeMarkdownTitle(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

export function isSafeBlogImageUrl(value: string) {
  return /^(https?:\/\/|\/)/i.test(value) && !value.startsWith("//");
}

/** Parse the supported Markdown image form, including an optional caption title. */
export function parseBlogBodyImage(line: string): BlogBodyImage | null {
  const match = line.trim().match(/^!\[((?:\\.|[^\]])*)\]\((\S+?)(?:\s+"((?:\\.|[^"])*)")?\)$/u);
  if (!match || !isSafeBlogImageUrl(match[2])) return null;

  const caption = match[3] ? unescapeMarkdown(match[3]).trim() : "";
  return {
    url: match[2],
    alt: unescapeMarkdown(match[1]),
    ...(caption ? { caption } : {}),
  };
}

export function blogBodyImageMarkdown(image: BlogBodyImage) {
  const url = image.url.trim();
  if (!isSafeBlogImageUrl(url)) return "";
  const alt = escapeMarkdown(image.alt.trim());
  const caption = image.caption?.trim();
  return `![${alt}](${url}${caption ? ` "${escapeMarkdownTitle(caption)}"` : ""})`;
}

export function extractBlogBodyImages(body: string): BlogBodyImage[] {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(parseBlogBodyImage)
    .filter((image): image is BlogBodyImage => image !== null);
}
