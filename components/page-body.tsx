import type { ReactNode } from "react";
import { formatPageBody } from "@/lib/storefront";

type ListBlock = { kind: "list"; ordered: boolean; items: string[] };
type TextBlock = { kind: "heading" | "subheading" | "paragraph"; text: string };
type Block = ListBlock | TextBlock;

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
    );
}

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let list: ListBlock | null = null;

  for (const line of formatPageBody(body)) {
    if (line.startsWith("### ")) {
      blocks.push({ kind: "subheading", text: line.slice(4) });
      list = null;
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3) });
      list = null;
    } else if (line.startsWith("- ")) {
      if (!list || list.ordered) {
        list = { kind: "list", ordered: false, items: [] };
        blocks.push(list);
      }
      list.items.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      if (!list || !list.ordered) {
        list = { kind: "list", ordered: true, items: [] };
        blocks.push(list);
      }
      list.items.push(line.replace(/^\d+\.\s/, ""));
    } else {
      blocks.push({ kind: "paragraph", text: line });
      list = null;
    }
  }

  return blocks;
}

export function formatContentDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function PageBody({ body, className = "article" }: { body: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(body).map((block, index) => {
        if (block.kind === "list") {
          const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>);
          return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
        }
        if (block.kind === "heading") return <h2 key={index}>{renderInline(block.text)}</h2>;
        if (block.kind === "subheading") return <h3 key={index}>{renderInline(block.text)}</h3>;
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
