import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";

type ListBlock = { kind: "list"; ordered: boolean; items: string[] };
type Alignment = "left" | "center" | "right" | "justify";
type TextBlock = { kind: "heading" | "subheading" | "paragraph"; text: string; align?: Alignment };
type Block =
  | ListBlock
  | TextBlock
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "aligned"; align: Alignment; blocks: Block[] };

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|~~[^~]+~~|<u>[^<]+<\/u>|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("~~") && part.endsWith("~~")) return <s key={index}>{part.slice(2, -2)}</s>;
      if (part.startsWith("<u>") && part.endsWith("</u>")) return <u key={index}>{part.slice(3, -4)}</u>;
      if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2].trim();
        const safeHref = /^(https?:\/\/|mailto:|tel:)/i.test(href) || (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#");
        if (safeHref) return <a key={index} href={href}>{link[1]}</a>;
      }
      return part;
    });
}

function parseBlocks(body: string, allowAlignment = true): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const alignment = allowAlignment ? line.match(/^:::align (left|center|right|justify)$/)?.[1] as Alignment | undefined : undefined;
    if (alignment) {
      const closingIndex = lines.indexOf(":::", index + 1);
      if (closingIndex !== -1) {
        const content = lines.slice(index + 1, closingIndex).join("\n");
        if (content.trim()) blocks.push({ kind: "aligned", align: alignment, blocks: parseBlocks(content, false) });
        index = closingIndex + 1;
        continue;
      }
    }

    if (!line) {
      index += 1;
      continue;
    }
    if (/^---+$/.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "subheading", text: line.slice(4) });
      index += 1;
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3) });
      index += 1;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: false, items });
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: true, items });
    } else {
      blocks.push({ kind: "paragraph", text: line });
      index += 1;
    }
  }

  return blocks;
}

export function formatContentDate(value: string | null | undefined, language: Language = "en") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function slugifyHeading(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function PageBody({ body, className = "article", numberParagraphsAfterFirst = false, numberAllParagraphs = false }: { body: string; className?: string; numberParagraphsAfterFirst?: boolean; numberAllParagraphs?: boolean }) {
  let paragraphNumber = 0;
  const renderBlocks = (blocks: Block[]): ReactNode[] => blocks.map((block, index) => {
    if (block.kind === "list") {
      const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>);
      return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
    }
    if (block.kind === "rule") return <hr key={index} />;
    if (block.kind === "quote") return <blockquote key={index}><p>{renderInline(block.text)}</p></blockquote>;
    if (block.kind === "aligned") return <div key={index} style={{ textAlign: block.align }}>{renderBlocks(block.blocks)}</div>;
    if (block.kind === "heading")
      return (
        <h2 key={index} id={slugifyHeading(block.text)} style={block.align ? { textAlign: block.align } : undefined}>
          {renderInline(block.text)}
        </h2>
      );
    if (block.kind === "subheading")
      return (
        <h3 key={index} id={slugifyHeading(block.text)} style={block.align ? { textAlign: block.align } : undefined}>
          {renderInline(block.text)}
        </h3>
      );
    paragraphNumber += 1;
    const clauseNumber = paragraphNumber - 1;
    const displayedNumber = numberAllParagraphs ? paragraphNumber : clauseNumber;
    return (
      <p key={index} style={block.align ? { textAlign: block.align } : undefined}>
        {(numberAllParagraphs || (numberParagraphsAfterFirst && clauseNumber > 0)) ? <span className="article__clause-number" aria-hidden="true">{String(displayedNumber).padStart(2, "0")}</span> : null}
        {renderInline(block.text)}
      </p>
    );
  });

  return (
    <div className={className}>
      {renderBlocks(parseBlocks(body))}
    </div>
  );
}
