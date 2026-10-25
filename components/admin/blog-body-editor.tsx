"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PageBody } from "@/components/page-body";
import { Icon, LinkIcon } from "@/components/icons";
import { Button, Field, TextInput } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/media";
import { blogBodyImageMarkdown } from "@/lib/blog-images";

type Alignment = "left" | "center" | "right" | "justify";
const alignmentIcons = { left: "alignLeft", center: "alignCenter", right: "alignRight", justify: "alignJustify" } as const;

function ToolButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button className="rv-rich-editor__tool" type="button" title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function BlogBodyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageCursorRef = useRef({ start: 0, end: 0 });
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [imageComposerOpen, setImageComposerOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");

  const commit = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    onChange(nextValue);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const rememberImageCursor = () => {
    const textarea = textareaRef.current;
    if (textarea) imageCursorRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
  };

  const openImageComposer = () => {
    rememberImageCursor();
    setImageError("");
    setImageComposerOpen(true);
  };

  const insertImage = () => {
    const markdown = blogBodyImageMarkdown({ url: imageUrl, alt: imageAlt, caption: imageCaption });
    if (!markdown || !imageAlt.trim()) {
      setImageError("Choose an image and add descriptive alt text before inserting it.");
      return;
    }

    const { start, end } = imageCursorRef.current;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const leading = before && !before.endsWith("\n\n") ? before.endsWith("\n") ? "\n" : "\n\n" : "";
    const trailing = !after.startsWith("\n\n") ? after.startsWith("\n") ? "" : "\n\n" : "";
    const nextValue = `${before}${leading}${markdown}${trailing}${after}`;
    const existingSeparator = after.startsWith("\n\n") ? 2 : after.startsWith("\n") ? 1 : 0;
    const cursor = start + leading.length + markdown.length + trailing.length + existingSeparator;
    commit(nextValue, cursor, cursor);
    setImageComposerOpen(false);
    setImageUrl("");
    setImageAlt("");
    setImageCaption("");
    setImageError("");
  };

  const toggleInline = (open: string, close: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
      const inner = selected.slice(open.length, selected.length - close.length);
      const nextValue = `${before}${inner}${after}`;
      commit(nextValue, start, start + inner.length);
      return;
    }

    const italicCollidesWithBold = open === "*" && (before.endsWith("**") || after.startsWith("**"));
    if (selected && before.endsWith(open) && after.startsWith(close) && !italicCollidesWithBold) {
      const nextValue = `${before.slice(0, -open.length)}${selected}${after.slice(close.length)}`;
      commit(nextValue, start - open.length, end - open.length);
      return;
    }

    const content = selected || placeholder;
    const nextValue = `${before}${open}${content}${close}${after}`;
    commit(nextValue, start + open.length, start + open.length + content.length);
  };

  const selectionRange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const start = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const endProbe = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
    const nextBreak = value.indexOf("\n", endProbe);
    const end = nextBreak === -1 ? value.length : nextBreak;
    return { start, end, selected: value.slice(start, end) };
  };

  const toggleHeading = (level: 2 | 3) => {
    const range = selectionRange();
    if (!range) return;
    const prefix = `${"#".repeat(level)} `;
    const selected = range.selected || "Judul artikel";
    const lines = selected.split("\n");
    const nonEmpty = lines.filter((line) => line.trim());
    const removeHeading = nonEmpty.length > 0 && nonEmpty.every((line) => line.startsWith(prefix));
    const nextSelected = lines
      .map((line) => {
        if (!line.trim()) return line;
        const clean = line.replace(/^#{1,3}\s+/, "");
        return removeHeading ? clean : `${prefix}${clean}`;
      })
      .join("\n");
    commit(`${value.slice(0, range.start)}${nextSelected}${value.slice(range.end)}`, range.start, range.start + nextSelected.length);
  };

  const toggleList = (ordered: boolean) => {
    const range = selectionRange();
    if (!range) return;
    const selected = range.selected || "Item daftar";
    const lines = selected.split("\n");
    const nonEmpty = lines.filter((line) => line.trim());
    const isCurrentList = (line: string) => ordered ? /^\d+\.\s/.test(line) : /^-\s/.test(line);
    const removeList = nonEmpty.length > 0 && nonEmpty.every(isCurrentList);
    let number = 1;
    const nextSelected = lines
      .map((line) => {
        if (!line.trim()) return line;
        const clean = line.replace(/^(?:-\s|\d+\.\s)/, "");
        if (removeList) return clean;
        return ordered ? `${number++}. ${clean}` : `- ${clean}`;
      })
      .join("\n");
    commit(`${value.slice(0, range.start)}${nextSelected}${value.slice(range.end)}`, range.start, range.start + nextSelected.length);
  };

  const toggleQuote = () => {
    const range = selectionRange();
    if (!range) return;
    const selected = range.selected || "Kutipan artikel";
    const lines = selected.split("\n");
    const nonEmpty = lines.filter((line) => line.trim());
    const removeQuote = nonEmpty.length > 0 && nonEmpty.every((line) => line.startsWith("> "));
    const nextSelected = lines.map((line) => {
      if (!line.trim()) return line;
      return removeQuote ? line.slice(2) : `> ${line.replace(/^>\s?/, "")}`;
    }).join("\n");
    commit(`${value.slice(0, range.start)}${nextSelected}${value.slice(range.end)}`, range.start, range.start + nextSelected.length);
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const label = value.slice(start, end) || "teks tautan";
    const markdown = `[${label}](https://)`;
    const nextValue = `${value.slice(0, start)}${markdown}${value.slice(end)}`;
    const urlStart = start + label.length + 3;
    commit(nextValue, urlStart, urlStart + "https://".length);
  };

  const insertDivider = () => {
    const range = selectionRange();
    if (!range) return;
    const before = value.slice(0, range.start);
    const after = value.slice(range.end);
    const leading = before && !before.endsWith("\n\n") ? before.endsWith("\n") ? "\n" : "\n\n" : "";
    const trailing = after && !after.startsWith("\n\n") ? after.startsWith("\n") ? "" : "\n\n" : "";
    const nextValue = `${before}${leading}---${trailing}${after}`;
    const cursor = range.start + leading.length + 3;
    commit(nextValue, cursor, cursor);
  };

  const applyAlignment = (alignment: Alignment) => {
    const range = selectionRange();
    if (!range) return;
    const before = value.slice(0, range.start);
    const openingMatches = [...before.matchAll(/(^|\n):::align (left|center|right|justify)\n/g)];
    const currentOpening = openingMatches.at(-1);
    const openingStart = currentOpening
      ? currentOpening.index! + (currentOpening[0].startsWith("\n") ? 1 : 0)
      : -1;
    const lastClosing = before.lastIndexOf("\n:::");
    const closingStart = value.indexOf("\n:::", range.end);

    if (currentOpening && openingStart > lastClosing && closingStart >= range.end) {
      const openingEnd = value.indexOf("\n", openingStart);
      const nextOpening = `:::align ${alignment}`;
      const previousLength = openingEnd - openingStart;
      const shift = nextOpening.length - previousLength;
      const nextValue = `${value.slice(0, openingStart)}${nextOpening}${value.slice(openingEnd)}`;
      commit(nextValue, range.start + shift, range.end + shift);
      return;
    }

    const content = range.selected || "Tulis paragraf di sini";
    const opening = `:::align ${alignment}\n`;
    const block = `${opening}${content}\n:::`;
    const nextValue = `${value.slice(0, range.start)}${block}${value.slice(range.end)}`;
    commit(nextValue, range.start + opening.length, range.start + opening.length + content.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      toggleInline("**", "**", "teks tebal");
    } else if (key === "i") {
      event.preventDefault();
      toggleInline("*", "*", "teks miring");
    } else if (key === "u") {
      event.preventDefault();
      toggleInline("<u>", "</u>", "teks bergaris bawah");
    } else if (key === "k") {
      event.preventDefault();
      insertLink();
    }
  };

  return (
    <div className="rv-rich-editor">
      <div className="rv-rich-editor__header">
        {mode === "write" ? (
          <div className="rv-rich-editor__toolbar" role="toolbar" aria-label="Article formatting">
            <div className="rv-rich-editor__group" aria-label="Inline formatting">
              <ToolButton title="Bold (⌘/Ctrl+B)" onClick={() => toggleInline("**", "**", "teks tebal")}><strong>B</strong></ToolButton>
              <ToolButton title="Italic (⌘/Ctrl+I)" onClick={() => toggleInline("*", "*", "teks miring")}><em>I</em></ToolButton>
              <ToolButton title="Underline (⌘/Ctrl+U)" onClick={() => toggleInline("<u>", "</u>", "teks bergaris bawah")}><u>U</u></ToolButton>
              <ToolButton title="Strikethrough" onClick={() => toggleInline("~~", "~~", "teks dicoret")}><s>S</s></ToolButton>
              <ToolButton title="Insert link (⌘/Ctrl+K)" onClick={insertLink}><LinkIcon size={16} /></ToolButton>
            </div>
            <div className="rv-rich-editor__group" aria-label="Blocks and lists">
              <ToolButton title="Heading 2" onClick={() => toggleHeading(2)}>H2</ToolButton>
              <ToolButton title="Heading 3" onClick={() => toggleHeading(3)}>H3</ToolButton>
              <ToolButton title="Bulleted list" onClick={() => toggleList(false)}><Icon name="list" size={17} /></ToolButton>
              <ToolButton title="Numbered list" onClick={() => toggleList(true)}><Icon name="listOrdered" size={17} /></ToolButton>
              <ToolButton title="Block quote" onClick={toggleQuote}><Icon name="quote" size={17} /></ToolButton>
              <ToolButton title="Horizontal divider" onClick={insertDivider}><Icon name="divider" size={17} /></ToolButton>
              <ToolButton title="Insert image" onClick={openImageComposer}><Icon name="image" size={17} /></ToolButton>
            </div>
            <div className="rv-rich-editor__group rv-rich-editor__group--last" aria-label="Paragraph alignment">
              {(["left", "center", "right", "justify"] as const).map((alignment) => (
                <ToolButton
                  key={alignment}
                  title={`Align ${alignment}`}
                  onClick={() => applyAlignment(alignment)}
                >
                  <Icon name={alignmentIcons[alignment]} size={17} />
                </ToolButton>
              ))}
            </div>
          </div>
        ) : <span className="rv-rich-editor__preview-label">Article preview</span>}
        <div className="rv-rich-editor__modes" role="group" aria-label="Editor mode">
          <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")}>Write</button>
          <button type="button" aria-pressed={mode === "preview"} onClick={() => { setMode("preview"); setImageComposerOpen(false); }}>Preview</button>
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          className="rv-textarea rv-textarea--code rv-rich-editor__textarea"
          aria-label="Article body in Markdown"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={rememberImageCursor}
          onKeyUp={rememberImageCursor}
          onClick={rememberImageCursor}
          rows={18}
        />
      ) : (
        <div className="rv-rich-editor__preview">
          {value.trim() ? <PageBody body={value} className="article__body rv-rich-editor__preview-body" /> : <p className="rv-rich-editor__empty">Nothing to preview yet.</p>}
        </div>
      )}
      {mode === "write" && imageComposerOpen ? (
        <div className="rv-rich-editor__image-composer">
          <div className="rv-rich-editor__image-composer-heading">
            <strong>Insert an article image</strong>
            <span className="rv-hint">The image will be placed at the current cursor position.</span>
          </div>
          <MediaPicker
            label="Choose or upload image"
            folder="blog"
            multiple={false}
            value={imageUrl ? [imageUrl] : []}
            onChange={(urls) => { setImageUrl(urls[0] ?? ""); setImageError(""); }}
            onBusyChange={setImageUploading}
          />
          <div className="rv-rich-editor__image-fields">
            <Field label="Alt text" hint="Describe what the image shows. Required for accessibility.">
              <TextInput value={imageAlt} onChange={setImageAlt} required maxLength={300} placeholder="A polished moss agate cabochon" />
            </Field>
            <Field label="Caption" hint="Optional text shown below the image.">
              <TextInput value={imageCaption} onChange={setImageCaption} maxLength={300} placeholder="Stone photographed in natural light" />
            </Field>
          </div>
          {imageError ? <p className="rv-error-text" role="alert">{imageError}</p> : null}
          <div className="rv-inline rv-rich-editor__image-actions">
            <Button onClick={insertImage} variant="primary" disabled={!imageUrl || !imageAlt.trim() || imageUploading}>Insert image</Button>
            <Button onClick={() => { setImageComposerOpen(false); setImageError(""); }}>Cancel</Button>
          </div>
        </div>
      ) : null}
      <p className="rv-rich-editor__hint">
        Select text for inline styles. Block tools apply to the current paragraph or selected lines. Insert an image between paragraphs, then preview before saving.
      </p>
    </div>
  );
}
