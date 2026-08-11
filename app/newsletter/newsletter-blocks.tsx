"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_BLOCK_IMAGE_TRANSFORM,
  DEFAULT_BLOCK_TEXT_STYLE,
  DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET,
  DEFAULT_TEXT_BOX_STYLE,
  type NewsletterBlock,
  type NewsletterBlockImageTransform,
  type NewsletterBlockKind,
  type NewsletterBlockTextStyle,
  type NewsletterCtaBlock,
  type NewsletterDecorativeLineBlock,
  type NewsletterDividerBlock,
  type NewsletterHeadingBlock,
  type NewsletterImageBlock,
  type NewsletterSpacerBlock,
  type NewsletterStoryBlock,
  type NewsletterTextBlock,
  type NewsletterTextBoxBlock,
  type NewsletterTextBoxStyle
} from "../../lib/story-types";
import { formatStoryDate } from "../../lib/story-format";
import { hideNewsletterExcerptBecauseBodyCoversIt } from "../../lib/newsletter-story-display";
import { storySingleImageFrameStyles } from "../../lib/story-image-frame";

/** Move `len` consecutive blocks from `from` so they start at `insertBefore` (0…length). */
function moveBlockSegment(blocks: NewsletterBlock[], from: number, len: number, insertBefore: number): NewsletterBlock[] {
  const n = blocks.length;
  if (len < 1 || from < 0 || from + len > n || insertBefore < 0 || insertBefore > n) return blocks;
  if (insertBefore === from) return blocks;
  if (insertBefore > from && insertBefore < from + len) return blocks;
  const copy = [...blocks];
  const seg = copy.splice(from, len);
  let dest = insertBefore;
  if (from < insertBefore) dest -= len;
  dest = Math.max(0, Math.min(dest, copy.length));
  copy.splice(dest, 0, ...seg);
  return copy;
}

/* ---------------------------------- ids ---------------------------------- */

const newId = (prefix: string): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

/* ------------------------------- factories ------------------------------- */

export function createBlock(kind: NewsletterBlockKind): NewsletterBlock {
  const id = newId("blk");
  switch (kind) {
    case "heading":
      return {
        id,
        kind: "heading",
        level: 2,
        text: "New heading",
        style: { ...DEFAULT_BLOCK_TEXT_STYLE, fontWeight: 700, fontSizeRem: 1.6, lineHeight: 1.2 }
      };
    case "text":
      return {
        id,
        kind: "text",
        html: "<p>Click to edit this text. Paste from Word, Docs, or the web to keep formatting.</p>",
        style: { ...DEFAULT_BLOCK_TEXT_STYLE }
      };
    case "text-box":
      return {
        id,
        kind: "text-box",
        html: "<p>Click inside this box to edit text. Paste from Word, Docs, or the web to keep formatting.</p>",
        textStyle: {
          ...DEFAULT_BLOCK_TEXT_STYLE,
          textAlign: "left",
          marginTopRem: 0,
          marginBottomRem: 0,
          maxWidthRem: 0
        },
        boxStyle: { ...DEFAULT_TEXT_BOX_STYLE }
      };
    case "image":
      return {
        id,
        kind: "image",
        images: [],
        alt: "",
        caption: "",
        transform: { ...DEFAULT_BLOCK_IMAGE_TRANSFORM },
        captionStyle: {
          ...DEFAULT_BLOCK_TEXT_STYLE,
          fontSizeRem: 0.84,
          marginTopRem: 0.4,
          marginBottomRem: 0.4
        }
      };
    case "cta":
      return {
        id,
        kind: "cta",
        label: "Read more",
        url: "",
        variant: "primary",
        textAlign: "center",
        marginTopRem: 0.8,
        marginBottomRem: 0.8
      };
    case "divider":
      return { id, kind: "divider", marginTopRem: 1.2, marginBottomRem: 1.2 };
    case "decorative-line":
      return { id, kind: "decorative-line", preset: { ...DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET } };
    case "spacer":
      return { id, kind: "spacer", heightRem: 1.5 };
    case "story":
      return {
        id,
        kind: "story",
        storyId: "",
        snapshot: {
          title: "",
          excerpt: "",
          body: "",
          images: [],
          alt: "",
          publishedAt: new Date().toISOString(),
          source: "manual",
          sourceUrl: "",
          ctaLabel: "Read more",
          ctaUrl: "",
          slug: ""
        }
      };
  }
}

/* ----------------------------- sanitisation ----------------------------- */

const sanitizeRichHtml = (html: string): string => {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    if (el.hasAttribute("color")) el.removeAttribute("color");
    if (el.style?.color) el.style.removeProperty("color");
    const styleAttr = el.getAttribute("style");
    if (styleAttr?.trim()) {
      const next = styleAttr
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !part.toLowerCase().startsWith("color:"))
        .join("; ");
      if (next) el.setAttribute("style", next);
      else el.removeAttribute("style");
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && value.startsWith("javascript:"))) {
        node.removeAttribute(attr.name);
      }
    }
  });
  return template.innerHTML;
};

/* --------------------------- read file → data url ------------------------ */

const readFileAsDataUrl = async (file: File): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("invalid_file_data"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

/* ------------------------------ block style ------------------------------ */

function textStyleToCss(style: NewsletterBlockTextStyle, inheritColor?: string): React.CSSProperties {
  const css: React.CSSProperties = {
    fontFamily: style.fontFamily && style.fontFamily !== "inherit" ? style.fontFamily : undefined,
    fontSize: `${style.fontSizeRem}rem`,
    fontWeight: style.fontWeight,
    color: style.color || inheritColor || undefined,
    textAlign: style.textAlign,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacingEm}em`,
    marginTop: `${style.marginTopRem}rem`,
    marginBottom: `${style.marginBottomRem}rem`
  };
  if (style.maxWidthRem > 0) {
    css.maxWidth = `${style.maxWidthRem}rem`;
    css.marginLeft = "auto";
    css.marginRight = "auto";
  }
  return css;
}

function textBoxStyleToCss(style: NewsletterTextBoxStyle): React.CSSProperties {
  const hasShadow = style.shadowColor.trim() && style.shadowBlurPx > 0;
  return {
    width: `${style.widthPercent}%`,
    transform: `translate(${style.offsetX}px, ${style.offsetY}px)`,
    marginTop: `${style.marginTopRem}rem`,
    marginBottom: `${style.marginBottomRem}rem`,
    marginLeft: "auto",
    marginRight: "auto",
    padding: `${style.paddingRem}rem`,
    background: style.backgroundColor || "transparent",
    border: `${style.outlineWidthPx}px solid ${style.outlineColor || "transparent"}`,
    borderRadius: `${style.borderRadiusPx}px`,
    boxShadow: hasShadow
      ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlurPx}px ${style.shadowColor}`
      : undefined,
    boxSizing: "border-box"
  };
}

/* ---------------- inline single-line contentEditable helper -------------- */

function InlineEditableText({
  value,
  onChange,
  as,
  style,
  placeholder,
  className,
  onFocus
}: {
  value: string;
  onChange: (next: string) => void;
  as: "h1" | "h2" | "h3" | "h4";
  style?: React.CSSProperties;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);
  const sharedProps = {
    ref,
    className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    style,
    onFocus,
    onMouseDown: (e: React.MouseEvent<HTMLHeadingElement>) => e.stopPropagation(),
    onClick: (e: React.MouseEvent<HTMLHeadingElement>) => e.stopPropagation(),
    onInput: (e: React.FormEvent<HTMLHeadingElement>) =>
      onChange((e.currentTarget as HTMLElement).innerText.replace(/\n/g, " ")),
    onBlur: (e: React.FocusEvent<HTMLHeadingElement>) =>
      onChange((e.currentTarget as HTMLElement).innerText.replace(/\n/g, " ")),
    onKeyDown: (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
    }
  } as const;
  switch (as) {
    case "h1":
      return <h1 {...sharedProps} />;
    case "h2":
      return <h2 {...sharedProps} />;
    case "h3":
      return <h3 {...sharedProps} />;
    case "h4":
      return <h4 {...sharedProps} />;
  }
}

/* ------------- inline rich-text contentEditable helper (for text) -------- */

function InlineEditableRichText({
  value,
  onChange,
  style,
  className,
  onFocus
}: {
  value: string;
  onChange: (htmlNext: string) => void;
  style?: React.CSSProperties;
  className?: string;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      style={style}
      onFocus={onFocus}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onInput={(e) => onChange(sanitizeRichHtml((e.currentTarget as HTMLDivElement).innerHTML))}
      onBlur={(e) => onChange(sanitizeRichHtml((e.currentTarget as HTMLDivElement).innerHTML))}
    />
  );
}

/* ------------------------------ block render ----------------------------- */

type RenderProps = {
  block: NewsletterBlock;
  canEdit: boolean;
  isSelected: boolean;
  inheritColor?: string;
  duplicateDisabled?: boolean;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  onSelect: () => void;
  onChange: (next: NewsletterBlock) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function HoverToolbar({
  canEdit,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: {
  canEdit: boolean;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateDisabled?: boolean;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
}) {
  if (!canEdit) return null;
  return (
    <div className="newsletter-block-toolbar" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="button secondary"
        onClick={() => onMove(-1)}
        disabled={moveUpDisabled}
        aria-label="Move block up"
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => onMove(1)}
        disabled={moveDownDisabled}
        aria-label="Move block down"
        title="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={onDuplicate}
        disabled={duplicateDisabled}
        aria-label="Duplicate block"
        title={duplicateDisabled ? "Duplicate is not available for story blocks" : "Duplicate"}
      >
        ⧉
      </button>
      <button
        type="button"
        className="button secondary newsletter-block-delete-btn"
        onClick={onDelete}
        aria-label="Delete this element"
        title="Delete this element (same as Delete element in the edit panel)"
      >
        Delete
      </button>
    </div>
  );
}

function HeadingBlockView({
  block,
  canEdit,
  isSelected,
  inheritColor,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterHeadingBlock }) {
  const css = textStyleToCss(block.style, inheritColor);
  const tag = (`h${block.level}` as "h1" | "h2" | "h3" | "h4");
  const className = `newsletter-block newsletter-block-heading${isSelected ? " is-selected" : ""}`;
  return (
    <div className={className} onClick={canEdit ? onSelect : undefined} role={canEdit ? "button" : undefined}>
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      {canEdit ? (
        <InlineEditableText
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          as={tag}
          style={css}
          placeholder="Heading"
          className={`newsletter-block-heading-text level-${block.level} newsletter-inline-edit`}
          onFocus={onSelect}
        />
      ) : block.text.trim() ? (
        tag === "h1" ? <h1 style={css} className={`newsletter-block-heading-text level-${block.level}`}>{block.text}</h1>
        : tag === "h2" ? <h2 style={css} className={`newsletter-block-heading-text level-${block.level}`}>{block.text}</h2>
        : tag === "h3" ? <h3 style={css} className={`newsletter-block-heading-text level-${block.level}`}>{block.text}</h3>
        : <h4 style={css} className={`newsletter-block-heading-text level-${block.level}`}>{block.text}</h4>
      ) : null}
    </div>
  );
}

function TextBlockView({
  block,
  canEdit,
  isSelected,
  inheritColor,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterTextBlock }) {
  const css = textStyleToCss(block.style, inheritColor);
  const className = `newsletter-block newsletter-block-text${isSelected ? " is-selected" : ""}`;
  return (
    <div className={className} onClick={canEdit ? onSelect : undefined} role={canEdit ? "button" : undefined}>
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      {canEdit ? (
        <InlineEditableRichText
          value={block.html}
          onChange={(html) => onChange({ ...block, html })}
          style={css}
          className="newsletter-block-text-body newsletter-rich-text newsletter-inline-edit"
          onFocus={onSelect}
        />
      ) : (
        <div
          className="newsletter-block-text-body newsletter-rich-text"
          style={css}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(block.html) }}
        />
      )}
    </div>
  );
}

function TextBoxBlockView({
  block,
  canEdit,
  isSelected,
  inheritColor,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterTextBoxBlock }) {
  const boxCss = textBoxStyleToCss(block.boxStyle);
  const textCss = textStyleToCss(block.textStyle, inheritColor);
  const className = `newsletter-block newsletter-block-text-box${isSelected ? " is-selected" : ""}`;
  return (
    <div className={className} onClick={canEdit ? onSelect : undefined} role={canEdit ? "button" : undefined}>
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      <div className="newsletter-block-text-box-shell" style={boxCss}>
        {canEdit ? (
          <InlineEditableRichText
            value={block.html}
            onChange={(html) => onChange({ ...block, html })}
            style={textCss}
            className="newsletter-block-text-box-body newsletter-rich-text newsletter-inline-edit"
            onFocus={onSelect}
          />
        ) : (
          <div
            className="newsletter-block-text-box-body newsletter-rich-text"
            style={textCss}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(block.html) }}
          />
        )}
      </div>
    </div>
  );
}

function ImageBlockView({
  block,
  canEdit,
  isSelected,
  inheritColor,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterImageBlock }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const css: React.CSSProperties = {
    width: `${block.transform.widthPercent}%`,
    marginTop: `${block.transform.marginTopRem}rem`,
    marginBottom: `${block.transform.marginBottomRem}rem`,
    aspectRatio: block.transform.aspectRatio || undefined,
    borderRadius: `${block.transform.borderRadius}px`
  };
  const captionCss = textStyleToCss(block.captionStyle, inheritColor);
  const className = `newsletter-block newsletter-block-image${isSelected ? " is-selected" : ""}`;
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    if (files.length === 0) return;
    try {
      const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
      onChange({ ...block, images: [...block.images, ...dataUrls].slice(0, 12) });
    } catch {
      /* swallow */
    }
    event.target.value = "";
  };
  const showPlaceholder = block.images.length === 0;
  return (
    <figure
      className={className}
      onClick={canEdit ? onSelect : undefined}
      role={canEdit ? "button" : undefined}
      style={{ position: "relative", zIndex: block.transform.zIndex ?? 0 }}
    >
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      {canEdit ? (
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleUpload} />
      ) : null}
      {showPlaceholder ? (
        canEdit ? (
          <button
            type="button"
            className="newsletter-block-image-placeholder"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              fileRef.current?.click();
            }}
            style={{ width: `${block.transform.widthPercent}%` }}
            title="Click to upload one or more images"
          >
            <span className="newsletter-block-image-placeholder-title">Click to add image(s)</span>
            <span className="newsletter-block-image-placeholder-hint">
              Pick one for a single image, or several to render a montage.
            </span>
          </button>
        ) : null
      ) : block.images.length > 1 ? (
        <div
          className={`newsletter-block-image-montage count-${Math.min(block.images.length, 9)}${canEdit ? " is-clickable" : ""}`}
          style={canEdit ? { ...css, cursor: "pointer" } : css}
          {...(canEdit
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": "Click to add another image",
                title: "Click to add another image",
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSelect();
                  fileRef.current?.click();
                },
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect();
                    fileRef.current?.click();
                  }
                }
              }
            : {})}
        >
          {block.images.slice(0, 9).map((src, idx) => (
            <img
              key={`${idx}-${src.slice(0, 24)}`}
              src={src}
              alt={`${block.alt || "Newsletter image"} ${idx + 1}`}
              loading="lazy"
              style={{
                transform: `translate(${block.transform.x}%, ${block.transform.y}%) scale(${block.transform.zoom})`
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className={`newsletter-block-image-single-frame${canEdit ? " is-clickable" : ""}`}
          style={{
            width: `${block.transform.widthPercent}%`,
            marginTop: `${block.transform.marginTopRem}rem`,
            marginBottom: `${block.transform.marginBottomRem}rem`,
            marginLeft: "auto",
            marginRight: "auto",
            aspectRatio: block.transform.aspectRatio || undefined,
            maxHeight: block.transform.maxFrameHeightPx > 0 ? `${block.transform.maxFrameHeightPx}px` : undefined,
            borderRadius: `${block.transform.borderRadius}px`,
            overflow: "hidden",
            position: "relative",
            display: "block",
            cursor: canEdit ? "pointer" : undefined,
            zIndex: block.transform.zIndex ?? 0
          }}
          {...(canEdit
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": "Click to upload or replace image",
                title: "Click to upload or replace image",
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSelect();
                  fileRef.current?.click();
                },
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect();
                    fileRef.current?.click();
                  }
                }
              }
            : {})}
        >
          <img
            src={block.images[0]}
            alt={block.alt}
            loading="lazy"
            style={{
              width: "100%",
              height: block.transform.aspectRatio || block.transform.maxFrameHeightPx > 0 ? "100%" : "auto",
              maxHeight:
                block.transform.maxFrameHeightPx > 0 && !block.transform.aspectRatio
                  ? `${block.transform.maxFrameHeightPx}px`
                  : undefined,
              display: "block",
              objectFit: block.transform.objectFit,
              objectPosition: "center",
              margin: 0,
              transform: `translate(${block.transform.x}%, ${block.transform.y}%) scale(${block.transform.zoom})`,
              transformOrigin: "center center"
            }}
          />
        </div>
      )}
      {block.caption.trim() || canEdit ? (
        <figcaption style={captionCss}>
          {canEdit ? (
            <InlineEditableText
              value={block.caption}
              onChange={(caption) => onChange({ ...block, caption })}
              as="h4"
              style={captionCss}
              placeholder="Optional caption"
              className="newsletter-block-image-caption"
            />
          ) : (
            <span className="newsletter-block-image-caption">{block.caption}</span>
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}

function DividerBlockView({
  block,
  canEdit,
  isSelected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterDividerBlock }) {
  const css: React.CSSProperties = {
    marginTop: `${block.marginTopRem}rem`,
    marginBottom: `${block.marginBottomRem}rem`
  };
  const className = `newsletter-block newsletter-block-divider${isSelected ? " is-selected" : ""}`;
  return (
    <div className={className} style={css} onClick={canEdit ? onSelect : undefined} role={canEdit ? "button" : undefined}>
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      <hr className="newsletter-rule" />
    </div>
  );
}

function DecorativeLineBlockView({
  block,
  canEdit,
  isSelected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterDecorativeLineBlock }) {
  const p = block.preset;
  const lineWidth = p.lineStyle === "double" ? Math.max(3, p.thickness * 3) : p.thickness;
  const borderTop = p.lineStyle === "double" ? `${lineWidth}px double ${p.color}` : `${lineWidth}px ${p.lineStyle} ${p.color}`;
  const className = `newsletter-block newsletter-block-decorative-line${isSelected ? " is-selected" : ""}`;
  return (
    <div
      className={className}
      style={{
        marginTop: `${p.marginTop}px`,
        marginBottom: `${p.marginBottom}px`,
        transform: `translate(${p.offsetX}px, ${p.offsetY}px)`,
        display: "flex",
        justifyContent: "center"
      }}
      onClick={canEdit ? onSelect : undefined}
      role={canEdit ? "button" : undefined}
    >
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      <span style={{ width: `${p.widthPercent}%`, borderTop, display: "block" }} />
    </div>
  );
}

function SpacerBlockView({
  block,
  canEdit,
  isSelected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled
}: RenderProps & { block: NewsletterSpacerBlock }) {
  const className = `newsletter-block newsletter-block-spacer${isSelected ? " is-selected" : ""}`;
  return (
    <div
      className={className}
      style={{ height: `${block.heightRem}rem` }}
      onClick={canEdit ? onSelect : undefined}
      role={canEdit ? "button" : undefined}
    >
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
    </div>
  );
}

function StoryBlockView({
  block,
  canEdit,
  isSelected,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  moveUpDisabled,
  moveDownDisabled,
  storyTextStyle
}: RenderProps & {
  block: NewsletterStoryBlock;
  storyTextStyle?: React.CSSProperties;
}) {
  const snap = block.snapshot;
  const gallery = snap.images?.filter(Boolean) ?? [];
  const className = `newsletter-block newsletter-block-story newsletter-story${isSelected ? " is-selected" : ""}`;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const openImagePicker = () => fileRef.current?.click();
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    event.target.value = "";
    if (files.length === 0) return;
    try {
      const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
      const next = [...gallery, ...dataUrls].slice(0, 12);
      onChange({ ...block, snapshot: { ...snap, images: next } });
    } catch {
      /* swallow */
    }
  };

  return (
    <article id={block.storyId ? `story-${block.storyId}` : undefined} className={className} style={storyTextStyle} onClick={canEdit ? onSelect : undefined} role={canEdit ? "button" : undefined}>
      <HoverToolbar canEdit={canEdit && isSelected} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} duplicateDisabled={duplicateDisabled} moveUpDisabled={moveUpDisabled} moveDownDisabled={moveDownDisabled} />
      {canEdit ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
      ) : null}

      {canEdit ? (
        <>
          <InlineEditableText
            value={snap.title}
            onChange={(text) => onChange({ ...block, snapshot: { ...snap, title: text } })}
            as="h2"
            style={storyTextStyle}
            placeholder="Story title"
            className="newsletter-story-title newsletter-inline-edit"
            onFocus={onSelect}
          />
        </>
      ) : (
        <h2 className="newsletter-story-title" style={storyTextStyle}>
          {snap.title.trim() || ""}
        </h2>
      )}

      {(() => {
        const t = snap.imageTransform;
        const wrapperStyle: React.CSSProperties = t
          ? {
              width: `${t.widthPercent}%`,
              marginInline: t.widthPercent < 100 ? "auto" : undefined,
              marginTop: `${t.marginTopRem}rem`,
              marginBottom: `${t.marginBottomRem}rem`,
              aspectRatio: t.aspectRatio || undefined,
              maxHeight: t.maxFrameHeightPx > 0 ? `${t.maxFrameHeightPx}px` : undefined,
              borderRadius: `${t.borderRadius}px`,
              overflow: "hidden",
              position: "relative",
              display: "block",
              zIndex: t.zIndex ?? 0
            }
          : {};
        const imgStyle: React.CSSProperties = t
          ? {
              width: "100%",
              height: t.aspectRatio || t.maxFrameHeightPx > 0 ? "100%" : "auto",
              maxHeight: t.maxFrameHeightPx > 0 ? `${t.maxFrameHeightPx}px` : undefined,
              objectFit: t.objectFit,
              objectPosition: "center",
              display: "block",
              borderRadius: 0,
              transform: `translate(${t.x}%, ${t.y}%) scale(${t.zoom})`,
              transformOrigin: "center"
            }
          : {};
        const editableImageProps = canEdit
          ? {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                onSelect();
                openImagePicker();
              },
              role: "button" as const,
              tabIndex: 0,
              "aria-label": gallery.length === 0 ? "Click to upload an image" : "Click to add another image",
              title: gallery.length === 0 ? "Click to upload an image" : "Click to add another image",
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect();
                  openImagePicker();
                }
              },
              style: { cursor: "pointer" as const }
            }
          : {};
        if (gallery.length > 1) {
          const count = Math.min(gallery.length, 9);
          const montageStyle: React.CSSProperties | undefined = t
            ? {
                width: `${t.widthPercent}%`,
                marginInline: t.widthPercent < 100 ? "auto" : undefined,
                marginTop: `${t.marginTopRem}rem`,
                marginBottom: `${t.marginBottomRem}rem`,
                borderRadius: `${t.borderRadius}px`,
                zIndex: t.zIndex ?? 0
              }
            : undefined;
          return (
            <div
              className={`newsletter-story-montage newsletter-story-montage-${count}${canEdit ? " is-clickable" : ""}`}
              style={canEdit ? { ...(montageStyle ?? {}), cursor: "pointer" } : montageStyle}
              {...(canEdit
                ? {
                    onClick: editableImageProps.onClick,
                    onKeyDown: editableImageProps.onKeyDown,
                    role: editableImageProps.role,
                    tabIndex: editableImageProps.tabIndex,
                    "aria-label": editableImageProps["aria-label"],
                    title: editableImageProps.title
                  }
                : {})}
            >
              {gallery.slice(0, 9).map((src, idx) => (
                <img key={`${idx}-${src.slice(0, 24)}`} src={src} alt={`${snap.alt || snap.title} ${idx + 1}`} loading="lazy" />
              ))}
            </div>
          );
        }
        if (gallery.length === 1) {
          if (t) {
            return (
              <div
                className={`newsletter-story-image-frame${canEdit ? " is-clickable" : ""}`}
                style={canEdit ? { ...wrapperStyle, cursor: "pointer" } : wrapperStyle}
                {...(canEdit
                  ? {
                      onClick: editableImageProps.onClick,
                      onKeyDown: editableImageProps.onKeyDown,
                      role: editableImageProps.role,
                      tabIndex: editableImageProps.tabIndex,
                      "aria-label": editableImageProps["aria-label"],
                      title: editableImageProps.title
                    }
                  : {})}
              >
                <img src={gallery[0]} alt={snap.alt || snap.title} loading="lazy" style={imgStyle} />
              </div>
            );
          }
          const { wrapper: fw, img: iw } = storySingleImageFrameStyles(snap.imageFrame);
          return (
            <div
              className={`newsletter-story-single-frame${canEdit ? " is-clickable" : ""}`}
              style={{ ...fw, ...(canEdit ? { cursor: "pointer" } : {}) }}
              {...(canEdit
                ? {
                    onClick: editableImageProps.onClick,
                    onKeyDown: editableImageProps.onKeyDown,
                    role: editableImageProps.role,
                    tabIndex: editableImageProps.tabIndex,
                    "aria-label": editableImageProps["aria-label"],
                    title: editableImageProps.title
                  }
                : {})}
            >
              <img src={gallery[0]} alt={snap.alt || snap.title} loading="lazy" style={iw} />
            </div>
          );
        }
        return canEdit ? (
          <button
            type="button"
            className="newsletter-story-image-placeholder"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              openImagePicker();
            }}
            title="Click to upload one or more images"
          >
            <span className="newsletter-story-image-placeholder-title">Click to add image(s)</span>
            <span className="newsletter-story-image-placeholder-hint">
              Pick one for a single hero, or several to render a montage.
            </span>
          </button>
        ) : null;
      })()}

      {(() => {
        const hideExcerpt =
          hideNewsletterExcerptBecauseBodyCoversIt(snap.excerpt, snap.body ?? "") && !(canEdit && isSelected);
        if (hideExcerpt) return null;
        return canEdit ? (
        <>
          <InlineEditableText
            value={snap.excerpt}
            onChange={(text) => onChange({ ...block, snapshot: { ...snap, excerpt: text } })}
            as="h3"
            style={storyTextStyle}
            placeholder="Excerpt"
            className="newsletter-story-excerpt newsletter-inline-edit"
            onFocus={onSelect}
          />
        </>
      ) : (
        <p className="newsletter-story-excerpt" style={storyTextStyle}>
          {snap.excerpt}
        </p>
      );
      })()}

      {snap.body && /[<>]/.test(snap.body) ? (
        canEdit ? (
          <>
            <InlineEditableRichText
              value={snap.body}
              onChange={(html) => onChange({ ...block, snapshot: { ...snap, body: html } })}
              style={storyTextStyle}
              className="newsletter-story-body newsletter-rich-text newsletter-inline-edit"
              onFocus={onSelect}
            />
          </>
        ) : (
          <div className="newsletter-story-body newsletter-rich-text" style={storyTextStyle} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(snap.body) }} />
        )
      ) : canEdit ? (
        <>
          <InlineEditableRichText
            value={snap.body || "<p><em>Optional body…</em></p>"}
            onChange={(html) => onChange({ ...block, snapshot: { ...snap, body: html } })}
            style={storyTextStyle}
            className="newsletter-story-body newsletter-rich-text newsletter-inline-edit"
            onFocus={onSelect}
          />
        </>
      ) : null}

    </article>
  );
}

/* ----------------------------- main renderer ----------------------------- */

function mergeVisibleBlockOrder(
  allBlocks: NewsletterBlock[],
  visibleIds: Set<string>,
  reorderedVisible: NewsletterBlock[]
): NewsletterBlock[] {
  const visibleIndices: number[] = [];
  for (let i = 0; i < allBlocks.length; i++) {
    if (visibleIds.has(allBlocks[i].id)) visibleIndices.push(i);
  }
  if (visibleIndices.length !== reorderedVisible.length) return allBlocks;
  const next = [...allBlocks];
  for (let i = 0; i < reorderedVisible.length; i++) {
    next[visibleIndices[i]] = reorderedVisible[i];
  }
  return next;
}

export function NewsletterBlocksRenderer({
  blocks,
  visibleBlockIds,
  canEdit,
  selectedId,
  onSelect,
  onChange,
  inheritColor,
  storyTextStyle
}: {
  blocks: NewsletterBlock[];
  visibleBlockIds?: string[];
  canEdit: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: NewsletterBlock[]) => void;
  inheritColor?: string;
  storyTextStyle?: React.CSSProperties;
}) {
  const [dragOverInsertBefore, setDragOverInsertBefore] = useState<number | null>(null);
  const dragPayloadRef = useRef<{ from: number; len: number } | null>(null);
  const visibleSet = useMemo(
    () => new Set(visibleBlockIds ?? blocks.map((b) => b.id)),
    [visibleBlockIds, blocks]
  );
  const displayBlocks = useMemo(
    () => blocks.filter((b) => visibleSet.has(b.id)),
    [blocks, visibleSet]
  );

  const updateBlock = (id: string, next: NewsletterBlock) => {
    onChange(blocks.map((b) => (b.id === id ? next : b)));
  };
  const moveBlock = (id: string, delta: -1 | 1) => {
    const idx = displayBlocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= displayBlocks.length) return;
    const reordered = [...displayBlocks];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(target, 0, item);
    onChange(mergeVisibleBlockOrder(blocks, visibleSet, reordered));
  };
  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    if (blocks[idx]?.kind === "story") return;
    const cloned = { ...blocks[idx], id: newId("blk") };
    const next = [...blocks];
    next.splice(idx + 1, 0, cloned);
    onChange(next);
    onSelect(cloned.id);
  };
  const deleteBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) onSelect(null);
  };

  const renderBlock = (block: NewsletterBlock, blockIndex: number): React.ReactNode => {
    const isSelected = canEdit && selectedId === block.id;
    const props: RenderProps = {
      block,
      canEdit,
      isSelected,
      inheritColor,
      duplicateDisabled: block.kind === "story",
      moveUpDisabled: blockIndex <= 0,
      moveDownDisabled: blockIndex >= displayBlocks.length - 1,
      onSelect: () => onSelect(block.id),
      onChange: (next) => updateBlock(block.id, next),
      onMove: (delta) => moveBlock(block.id, delta),
      onDuplicate: () => duplicateBlock(block.id),
      onDelete: () => deleteBlock(block.id)
    };
    switch (block.kind) {
      case "heading":
        return <HeadingBlockView key={block.id} {...props} block={block} />;
      case "text":
        return <TextBlockView key={block.id} {...props} block={block} />;
      case "text-box":
        return <TextBoxBlockView key={block.id} {...props} block={block} />;
      case "image":
        return <ImageBlockView key={block.id} {...props} block={block} />;
      case "cta":
        return null;
      case "divider":
        return <DividerBlockView key={block.id} {...props} block={block} />;
      case "decorative-line":
        return <DecorativeLineBlockView key={block.id} {...props} block={block} />;
      case "spacer":
        return <SpacerBlockView key={block.id} {...props} block={block} />;
      case "story":
        return <StoryBlockView key={block.id} {...props} block={block} storyTextStyle={storyTextStyle} />;
      default:
        return null;
    }
  };

  type FlowRow =
    | { kind: "single"; start: number; block: NewsletterBlock }
    | { kind: "pair"; start: number; left: NewsletterImageBlock; right: NewsletterImageBlock };

  const flowRows: FlowRow[] = [];
  for (let i = 0; i < displayBlocks.length; i++) {
    const block = displayBlocks[i];
    if (block.kind === "image" && block.pairRole === "portraitHeroLeft") {
      const right = displayBlocks[i + 1];
      if (right?.kind === "image" && right.pairRole === "portraitHeroRight") {
        flowRows.push({ kind: "pair", start: i, left: block, right });
        i += 1;
        continue;
      }
    }
    flowRows.push({ kind: "single", start: i, block });
  }

  const applyDragReorder = (from: number, len: number, insertBefore: number) => {
    const n = displayBlocks.length;
    if (len < 1 || from < 0 || from + len > n || insertBefore < 0 || insertBefore > n) return;
    if (insertBefore === from) return;
    if (insertBefore > from && insertBefore < from + len) return;
    const reordered = moveBlockSegment(displayBlocks, from, len, insertBefore);
    onChange(mergeVisibleBlockOrder(blocks, visibleSet, reordered));
  };

  const handleDragStart = (e: React.DragEvent, from: number, len: number) => {
    dragPayloadRef.current = { from, len };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify({ from, len }));
    try {
      e.dataTransfer.setDragImage(e.currentTarget as Element, 0, 0);
    } catch {
      /* ignore */
    }
  };

  const handleDropAt = (e: React.DragEvent, insertBefore: number) => {
    e.preventDefault();
    e.stopPropagation();
    let parsed: { from: number; len: number };
    try {
      parsed = JSON.parse(e.dataTransfer.getData("application/json")) as { from: number; len: number };
    } catch {
      dragPayloadRef.current = null;
      setDragOverInsertBefore(null);
      return;
    }
    applyDragReorder(parsed.from, parsed.len, insertBefore);
    dragPayloadRef.current = null;
    setDragOverInsertBefore(null);
  };

  const clearDragUi = () => {
    dragPayloadRef.current = null;
    setDragOverInsertBefore(null);
  };

  return (
    <div className="newsletter-blocks-flow">
      {flowRows.map((row) => {
        const rowKey = row.kind === "pair" ? `pair-${row.left.id}-${row.right.id}` : row.block.id;
        const len = row.kind === "pair" ? 2 : 1;
        const content =
          row.kind === "pair" ? (
            <div className="newsletter-top-grid">
              <div className="newsletter-editable-row">{renderBlock(row.left, row.start)}</div>
              <div className="newsletter-editable-row">{renderBlock(row.right, row.start + 1)}</div>
            </div>
          ) : (
            renderBlock(row.block, row.start)
          );

        if (!canEdit) {
          return <div key={rowKey}>{content}</div>;
        }

        return (
          <div
            key={rowKey}
            className={`newsletter-block-drag-row${dragOverInsertBefore === row.start ? " is-drop-before" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverInsertBefore(row.start);
            }}
            onDragLeave={() => setDragOverInsertBefore(null)}
            onDrop={(e) => handleDropAt(e, row.start)}
          >
            <span
              className="newsletter-drag-handle"
              draggable
              title="Drag to reorder"
              aria-label="Drag to reorder"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => handleDragStart(e, row.start, len)}
              onDragEnd={clearDragUi}
            >
              ⣿
            </span>
            <div className="newsletter-block-drag-body">{content}</div>
          </div>
        );
      })}
      {canEdit ? (
        <div
          className={`newsletter-block-drop-tail${dragOverInsertBefore === displayBlocks.length ? " is-drop-before" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverInsertBefore(displayBlocks.length);
          }}
          onDragLeave={() => setDragOverInsertBefore(null)}
          onDrop={(e) => handleDropAt(e, displayBlocks.length)}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/* ------------------------------- edit pane ------------------------------- */

type EditPaneProps = {
  block: NewsletterBlock | null;
  onChange: (next: NewsletterBlock) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
  saveState: "idle" | "saving" | "saved";
};

function TextStyleControls({
  style,
  onChange,
  title
}: {
  style: NewsletterBlockTextStyle;
  onChange: (next: NewsletterBlockTextStyle) => void;
  title?: string;
}) {
  const set = (patch: Partial<NewsletterBlockTextStyle>) => onChange({ ...style, ...patch });
  return (
    <>
      {title ? (
        <div className="newsletter-position-block">
          <strong>{title}</strong>
        </div>
      ) : null}
      <label>
        Font family
        <input value={style.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} placeholder="inherit, Georgia, Inter…" />
      </label>
      <label>
        Font size ({style.fontSizeRem.toFixed(2)}rem)
        <input
          type="range"
          min={0.5}
          max={6}
          step={0.02}
          value={style.fontSizeRem}
          onChange={(e) => set({ fontSizeRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Weight
        <select value={style.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
          <option value={300}>Light (300)</option>
          <option value={400}>Regular (400)</option>
          <option value={500}>Medium (500)</option>
          <option value={600}>Semibold (600)</option>
          <option value={700}>Bold (700)</option>
          <option value={800}>Black (800)</option>
        </select>
      </label>
      <label>
        Alignment
        <select value={style.textAlign} onChange={(e) => set({ textAlign: e.target.value as "left" | "center" | "right" })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <div className="newsletter-style-row">
        <label className="newsletter-checkbox-row">
          <input type="checkbox" checked={style.italic} onChange={(e) => set({ italic: e.target.checked })} />
          <span>Italic</span>
        </label>
        <label className="newsletter-checkbox-row">
          <input type="checkbox" checked={style.underline} onChange={(e) => set({ underline: e.target.checked })} />
          <span>Underline</span>
        </label>
      </div>
      <label>
        Line spacing ({style.lineHeight.toFixed(2)})
        <input
          type="range"
          min={0.7}
          max={3}
          step={0.02}
          value={style.lineHeight}
          onChange={(e) => set({ lineHeight: Number(e.target.value) })}
        />
      </label>
      <label>
        Letter spacing ({style.letterSpacingEm.toFixed(3)}em)
        <input
          type="range"
          min={-0.05}
          max={0.4}
          step={0.005}
          value={style.letterSpacingEm}
          onChange={(e) => set({ letterSpacingEm: Number(e.target.value) })}
        />
      </label>
      <label>
        Text color
        <span className="newsletter-text-color-row">
          <input type="color" value={style.color || "#f3f7f6"} onChange={(e) => set({ color: e.target.value })} aria-label="Text color" />
          <button type="button" className="button secondary" onClick={() => set({ color: "" })} title="Use inherited theme color">
            Default
          </button>
        </span>
      </label>
      <label>
        Top margin ({style.marginTopRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={style.marginTopRem}
          onChange={(e) => set({ marginTopRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Bottom margin ({style.marginBottomRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={style.marginBottomRem}
          onChange={(e) => set({ marginBottomRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Max readable width ({style.maxWidthRem === 0 ? "Full" : `${style.maxWidthRem.toFixed(0)}rem`})
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={style.maxWidthRem}
          onChange={(e) => set({ maxWidthRem: Number(e.target.value) })}
        />
      </label>
    </>
  );
}

function RichTextQuickControls() {
  const run = (command: string, value?: string) => {
    if (typeof document === "undefined") return;
    document.execCommand(command, false, value);
  };
  return (
    <div className="newsletter-position-block">
      <strong>Selected text formatting</strong>
      <p className="newsletter-inline-edit-hint">
        Select text inside the box, then use these buttons for local rich formatting.
      </p>
      <div className="newsletter-floating-controls-actions">
        <button type="button" className="button secondary" onMouseDown={(e) => { e.preventDefault(); run("bold"); }}>
          Bold
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => { e.preventDefault(); run("italic"); }}>
          Italic
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => { e.preventDefault(); run("underline"); }}>
          Underline
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => { e.preventDefault(); run("insertUnorderedList"); }}>
          Bullets
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => { e.preventDefault(); run("removeFormat"); }}>
          Clear formatting
        </button>
      </div>
    </div>
  );
}

function TextBoxStyleControls({
  style,
  onChange
}: {
  style: NewsletterTextBoxStyle;
  onChange: (next: NewsletterTextBoxStyle) => void;
}) {
  const set = (patch: Partial<NewsletterTextBoxStyle>) => onChange({ ...style, ...patch });
  const colorValue = (value: string, fallback: string) =>
    /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
  return (
    <div className="newsletter-position-block">
      <strong>Text box container</strong>
      <label>
        Position X ({Math.round(style.offsetX)}px)
        <input
          type="range"
          min={-800}
          max={800}
          step={1}
          value={style.offsetX}
          onChange={(e) => set({ offsetX: Number(e.target.value) })}
        />
      </label>
      <label>
        Position Y ({Math.round(style.offsetY)}px)
        <input
          type="range"
          min={-800}
          max={800}
          step={1}
          value={style.offsetY}
          onChange={(e) => set({ offsetY: Number(e.target.value) })}
        />
      </label>
      <label>
        Width ({style.widthPercent}%)
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={style.widthPercent}
          onChange={(e) => set({ widthPercent: Number(e.target.value) })}
        />
      </label>
      <label>
        Padding ({style.paddingRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={style.paddingRem}
          onChange={(e) => set({ paddingRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Background colour
        <span className="newsletter-text-color-row">
          <input
            type="color"
            value={colorValue(style.backgroundColor, "#12313a")}
            onChange={(e) => set({ backgroundColor: e.target.value })}
          />
          <button type="button" className="button secondary" onClick={() => set({ backgroundColor: "transparent" })}>
            Transparent
          </button>
        </span>
      </label>
      <label>
        Outline colour
        <span className="newsletter-text-color-row">
          <input
            type="color"
            value={colorValue(style.outlineColor, "#70c9d9")}
            onChange={(e) => set({ outlineColor: e.target.value })}
          />
          <button type="button" className="button secondary" onClick={() => set({ outlineColor: "transparent", outlineWidthPx: 0 })}>
            None
          </button>
        </span>
      </label>
      <label>
        Outline thickness ({style.outlineWidthPx.toFixed(1)}px)
        <input
          type="range"
          min={0}
          max={16}
          step={0.5}
          value={style.outlineWidthPx}
          onChange={(e) => set({ outlineWidthPx: Number(e.target.value) })}
        />
      </label>
      <label>
        Corner radius ({Math.round(style.borderRadiusPx)}px)
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={style.borderRadiusPx}
          onChange={(e) => set({ borderRadiusPx: Number(e.target.value) })}
        />
      </label>
      <label>
        Drop shadow colour
        <span className="newsletter-text-color-row">
          <input
            type="color"
            value={colorValue(style.shadowColor, "#000000")}
            onChange={(e) => set({ shadowColor: e.target.value })}
          />
          <button type="button" className="button secondary" onClick={() => set({ shadowColor: "transparent", shadowBlurPx: 0 })}>
            None
          </button>
        </span>
      </label>
      <label>
        Drop shadow blur ({Math.round(style.shadowBlurPx)}px)
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={style.shadowBlurPx}
          onChange={(e) => set({ shadowBlurPx: Number(e.target.value) })}
        />
      </label>
      <label>
        Drop shadow X ({Math.round(style.shadowOffsetX)}px)
        <input
          type="range"
          min={-80}
          max={80}
          step={1}
          value={style.shadowOffsetX}
          onChange={(e) => set({ shadowOffsetX: Number(e.target.value) })}
        />
      </label>
      <label>
        Drop shadow Y ({Math.round(style.shadowOffsetY)}px)
        <input
          type="range"
          min={-80}
          max={80}
          step={1}
          value={style.shadowOffsetY}
          onChange={(e) => set({ shadowOffsetY: Number(e.target.value) })}
        />
      </label>
      <label>
        Top margin ({style.marginTopRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={style.marginTopRem}
          onChange={(e) => set({ marginTopRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Bottom margin ({style.marginBottomRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={style.marginBottomRem}
          onChange={(e) => set({ marginBottomRem: Number(e.target.value) })}
        />
      </label>
      <div className="newsletter-floating-controls-actions">
        <button type="button" className="button secondary" onClick={() => onChange({ ...DEFAULT_TEXT_BOX_STYLE })}>
          Reset box style
        </button>
      </div>
    </div>
  );
}

export function NewsletterBlockEditPane({ block, onChange, onClose, onDelete, onSave, saveState }: EditPaneProps) {
  if (!block) return null;
  if (typeof document === "undefined") return null;
  const node = (
    <aside className="newsletter-element-controls is-floating">
      <div className="newsletter-floating-controls-head">
        <strong>Edit {block.kind === "decorative-line" ? "decorative line" : block.kind}</strong>
        <div className="newsletter-floating-controls-actions">
          <button
            type="button"
            className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : saveState === "saving" ? " is-saving" : ""}`}
            onClick={onSave}
            disabled={saveState === "saving"}
          >
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save"}
          </button>
          <button type="button" className="button secondary" onClick={onClose} aria-label="Close edit panel">
            Close
          </button>
        </div>
      </div>

      <p className="newsletter-inline-edit-hint">
        <strong>How do I delete this?</strong> Use the <strong>Delete</strong> button in the toolbar that appears on the selected block, or scroll down and use <strong>Delete element</strong> here.
      </p>

      {block.kind === "heading" ? (
        <>
          <label>
            Heading level
            <select
              value={block.level}
              onChange={(e) =>
                onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 | 4 })
              }
            >
              <option value={1}>H1 (use once)</option>
              <option value={2}>H2 (section)</option>
              <option value={3}>H3 (sub-section)</option>
              <option value={4}>H4 (eyebrow)</option>
            </select>
          </label>
          <label>
            Text
            <input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Heading" />
          </label>
          <TextStyleControls style={block.style} onChange={(style) => onChange({ ...block, style })} />
        </>
      ) : null}

      {block.kind === "text" ? (
        <>
          <label>
            Body (rich HTML; paste from Word/Docs/web to keep formatting)
            <textarea
              rows={10}
              value={block.html}
              onChange={(e) => onChange({ ...block, html: e.target.value })}
              placeholder="<p>Your text here…</p>"
            />
          </label>
          <p className="newsletter-inline-edit-hint">
            Tip: click the text on the page to edit inline. This box accepts raw HTML.
          </p>
          <TextStyleControls style={block.style} onChange={(style) => onChange({ ...block, style })} />
        </>
      ) : null}

      {block.kind === "text-box" ? (
        <>
          <label>
            Body (rich HTML; paste from Word/Docs/web to keep formatting)
            <textarea
              rows={10}
              value={block.html}
              onChange={(e) => onChange({ ...block, html: e.target.value })}
              placeholder="<p>Your text here…</p>"
            />
          </label>
          <p className="newsletter-inline-edit-hint">
            Click inside the text box on the page to edit inline. The controls below style the text and the box separately.
          </p>
          <RichTextQuickControls />
          <TextStyleControls title="Text inside box" style={block.textStyle} onChange={(textStyle) => onChange({ ...block, textStyle })} />
          <TextBoxStyleControls style={block.boxStyle} onChange={(boxStyle) => onChange({ ...block, boxStyle })} />
        </>
      ) : null}

      {block.kind === "image" ? (
        <ImageBlockControls block={block} onChange={onChange} />
      ) : null}

      {block.kind === "cta" ? (
        <>
          <label>
            Label
            <input value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} placeholder="Read more" />
          </label>
          <label>
            URL
            <input value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://…" />
          </label>
          <label>
            Style
            <select
              value={block.variant}
              onChange={(e) => onChange({ ...block, variant: e.target.value as NewsletterCtaBlock["variant"] })}
            >
              <option value="primary">Primary (filled)</option>
              <option value="secondary">Secondary (outlined)</option>
              <option value="ghost">Ghost (text only)</option>
            </select>
          </label>
          <label>
            Alignment
            <select
              value={block.textAlign}
              onChange={(e) => onChange({ ...block, textAlign: e.target.value as "left" | "center" | "right" })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            Top margin ({block.marginTopRem.toFixed(2)}rem)
            <input
              type="range"
              min={0}
              max={6}
              step={0.05}
              value={block.marginTopRem}
              onChange={(e) => onChange({ ...block, marginTopRem: Number(e.target.value) })}
            />
          </label>
          <label>
            Bottom margin ({block.marginBottomRem.toFixed(2)}rem)
            <input
              type="range"
              min={0}
              max={6}
              step={0.05}
              value={block.marginBottomRem}
              onChange={(e) => onChange({ ...block, marginBottomRem: Number(e.target.value) })}
            />
          </label>
        </>
      ) : null}

      {block.kind === "divider" ? (
        <>
          <label>
            Top margin ({block.marginTopRem.toFixed(2)}rem)
            <input
              type="range"
              min={0}
              max={6}
              step={0.05}
              value={block.marginTopRem}
              onChange={(e) => onChange({ ...block, marginTopRem: Number(e.target.value) })}
            />
          </label>
          <label>
            Bottom margin ({block.marginBottomRem.toFixed(2)}rem)
            <input
              type="range"
              min={0}
              max={6}
              step={0.05}
              value={block.marginBottomRem}
              onChange={(e) => onChange({ ...block, marginBottomRem: Number(e.target.value) })}
            />
          </label>
        </>
      ) : null}

      {block.kind === "decorative-line" ? (
        <DecorativeLineControls block={block} onChange={onChange} />
      ) : null}

      {block.kind === "spacer" ? (
        <label>
          Height ({block.heightRem.toFixed(2)}rem)
          <input
            type="range"
            min={0}
            max={12}
            step={0.05}
            value={block.heightRem}
            onChange={(e) => onChange({ ...block, heightRem: Number(e.target.value) })}
          />
        </label>
      ) : null}

      {block.kind === "story" ? (
        <>
          <p className="newsletter-inline-edit-hint">
            Edit the title, excerpt, body, and buttons directly on the page. Use <strong>Imports</strong> in the top bar for images and bulk story changes.
          </p>
          <label>
            Source page URL (optional)
            <input
              value={block.snapshot.sourceUrl}
              onChange={(e) =>
                onChange({ ...block, snapshot: { ...block.snapshot, sourceUrl: e.target.value } })
              }
              placeholder="https://…"
            />
          </label>
          <StoryImageFrameControls block={block} onChange={onChange} />
        </>
      ) : null}

      <div className="newsletter-position-block newsletter-delete-element-block">
        <strong>Delete element</strong>
        <p className="newsletter-inline-edit-hint">
          Removes this block from the newsletter. Same as the <strong>Delete</strong> control in the floating toolbar on the block.
        </p>
        <button type="button" className="button secondary" onClick={onDelete} aria-label="Delete this block from the newsletter">
          Delete element
        </button>
      </div>
    </aside>
  );
  return createPortal(node, document.body);
}

function ImageBlockControls({
  block,
  onChange
}: {
  block: NewsletterImageBlock;
  onChange: (next: NewsletterImageBlock) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const set = (patch: Partial<NewsletterImageBlock>) => onChange({ ...block, ...patch });
  const setTransform = (patch: Partial<NewsletterImageBlock["transform"]>) =>
    onChange({ ...block, transform: { ...block.transform, ...patch } });
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    if (files.length === 0) return;
    try {
      const urls = await Promise.all(files.map(readFileAsDataUrl));
      set({ images: [...block.images, ...urls].slice(0, 12) });
    } catch {
      /* swallow */
    }
    event.target.value = "";
  };
  const removeAt = (idx: number) => set({ images: block.images.filter((_, i) => i !== idx) });
  const moveAt = (idx: number, delta: -1 | 1) => {
    const next = [...block.images];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    set({ images: next });
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleUpload} />
      <div className="newsletter-floating-controls-actions">
        <button type="button" className="button primary" onClick={() => fileRef.current?.click()}>
          Upload image(s)
        </button>
        <button type="button" className="button secondary" onClick={() => set({ images: [] })}>
          Clear all
        </button>
      </div>
      <label>
        Alt text (SEO &amp; accessibility: describe the image)
        <input value={block.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Sunset over the Maroma fields" />
      </label>
      <label>
        Caption (optional)
        <input value={block.caption} onChange={(e) => set({ caption: e.target.value })} placeholder="Photographer · year" />
      </label>
      {block.images.length > 0 ? (
        <div className="newsletter-story-gallery-grid">
          {block.images.map((src, idx) => (
            <div key={`${idx}-${src.slice(0, 24)}`} className="newsletter-story-gallery-item">
              <img src={src} alt={block.alt || `Image ${idx + 1}`} />
              <div className="newsletter-story-gallery-actions">
                <button type="button" className="button secondary" disabled={idx === 0} onClick={() => moveAt(idx, -1)} title="Move left">←</button>
                <button type="button" className="button secondary" disabled={idx === block.images.length - 1} onClick={() => moveAt(idx, 1)} title="Move right">→</button>
                <button type="button" className="button secondary" onClick={() => removeAt(idx)} title="Remove">✕</button>
              </div>
              {idx === 0 ? <span className="newsletter-story-gallery-tag">Primary</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <ImageFrameControls transform={block.transform} onChange={(next) => set({ transform: next })} />
    </>
  );
}

function ImageFrameControls({
  transform,
  onChange
}: {
  transform: NewsletterBlockImageTransform;
  onChange: (next: NewsletterBlockImageTransform) => void;
}) {
  const set = (patch: Partial<NewsletterBlockImageTransform>) => onChange({ ...transform, ...patch });
  return (
    <>
      <p className="newsletter-inline-edit-hint">
        <strong>Image frame</strong>: set width, aspect ratio, and max height to crop the visible area.
        Use <strong>Pan X / Y</strong> and <strong>Zoom</strong> to reposition the image inside the frame.
      </p>
      <label>
        Width ({transform.widthPercent}%)
        <input
          type="range"
          min={20}
          max={100}
          step={1}
          value={transform.widthPercent}
          onChange={(e) => set({ widthPercent: Number(e.target.value) })}
        />
      </label>
      <label>
        Aspect ratio
        <select
          value={transform.aspectRatio}
          onChange={(e) => set({ aspectRatio: e.target.value })}
        >
          <option value="">Natural</option>
          <option value="21 / 9">21:9 (ultrawide)</option>
          <option value="16 / 9">16:9 (cinematic)</option>
          <option value="3 / 2">3:2 (photo)</option>
          <option value="4 / 3">4:3 (classic)</option>
          <option value="1 / 1">1:1 (square)</option>
          <option value="3 / 4">3:4 (portrait)</option>
          <option value="2 / 3">2:3 (poster)</option>
          <option value="9 / 16">9:16 (vertical)</option>
        </select>
      </label>
      <label>
        Max frame height ({transform.maxFrameHeightPx === 0 ? "Off" : `${transform.maxFrameHeightPx}px`})
        <input
          type="range"
          min={0}
          max={1200}
          step={10}
          value={transform.maxFrameHeightPx}
          onChange={(e) => set({ maxFrameHeightPx: Number(e.target.value) })}
        />
      </label>
      <label>
        Fit
        <select
          value={transform.objectFit}
          onChange={(e) => set({ objectFit: e.target.value === "contain" ? "contain" : "cover" })}
        >
          <option value="cover">Cover (fill frame, may crop)</option>
          <option value="contain">Contain (show full image, may letterbox)</option>
        </select>
      </label>
      <label>
        Pan X ({transform.x}%)
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={transform.x}
          onChange={(e) => set({ x: Number(e.target.value) })}
        />
      </label>
      <label>
        Pan Y ({transform.y}%)
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={transform.y}
          onChange={(e) => set({ y: Number(e.target.value) })}
        />
      </label>
      <label>
        Zoom ({transform.zoom.toFixed(2)}×)
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.01}
          value={transform.zoom}
          onChange={(e) => set({ zoom: Number(e.target.value) })}
        />
      </label>
      <label>
        Corner radius ({transform.borderRadius >= 9999 ? "Full" : `${transform.borderRadius}px`})
        <input
          type="range"
          min={0}
          max={400}
          step={1}
          value={Math.min(400, transform.borderRadius)}
          onChange={(e) => set({ borderRadius: Number(e.target.value) })}
        />
      </label>
      <label>
        Top margin ({transform.marginTopRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={transform.marginTopRem}
          onChange={(e) => set({ marginTopRem: Number(e.target.value) })}
        />
      </label>
      <label>
        Bottom margin ({transform.marginBottomRem.toFixed(2)}rem)
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={transform.marginBottomRem}
          onChange={(e) => set({ marginBottomRem: Number(e.target.value) })}
        />
      </label>
    </>
  );
}

function StoryImageFrameControls({
  block,
  onChange
}: {
  block: NewsletterStoryBlock;
  onChange: (next: NewsletterStoryBlock) => void;
}) {
  const transform = block.snapshot.imageTransform ?? { ...DEFAULT_BLOCK_IMAGE_TRANSFORM };
  const setTransform = (next: NewsletterBlockImageTransform) =>
    onChange({ ...block, snapshot: { ...block.snapshot, imageTransform: next } });
  const reset = () => {
    const { imageTransform: _drop, ...rest } = block.snapshot;
    void _drop;
    onChange({ ...block, snapshot: rest });
  };
  const isCustom = Boolean(block.snapshot.imageTransform);
  return (
    <div className="newsletter-position-block">
      <strong>Story image frame</strong>
      <p className="newsletter-inline-edit-hint">
        {isCustom
          ? "Custom frame applied. Use Reset to return to the default story image size."
          : "Default story frame is ~360px tall, cover fit. Adjust below to crop or resize."}
      </p>
      <ImageFrameControls transform={transform} onChange={setTransform} />
      <button
        type="button"
        className="button secondary"
        onClick={reset}
        disabled={!isCustom}
        title="Remove the custom frame and use the default story image size"
      >
        Reset frame to default
      </button>
    </div>
  );
}

function DecorativeLineControls({
  block,
  onChange
}: {
  block: NewsletterDecorativeLineBlock;
  onChange: (next: NewsletterDecorativeLineBlock) => void;
}) {
  const set = (patch: Partial<NewsletterDecorativeLineBlock["preset"]>) =>
    onChange({ ...block, preset: { ...block.preset, ...patch } });
  return (
    <>
      <label>
        Width ({Math.round(block.preset.widthPercent)}%)
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={block.preset.widthPercent}
          onChange={(e) => set({ widthPercent: Number(e.target.value) })}
        />
      </label>
      <label>
        Thickness ({block.preset.thickness}px)
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={block.preset.thickness}
          onChange={(e) => set({ thickness: Number(e.target.value) })}
        />
      </label>
      <label>
        Style
        <select
          value={block.preset.lineStyle}
          onChange={(e) =>
            set({
              lineStyle:
                e.target.value === "dashed" ? "dashed" : e.target.value === "double" ? "double" : "solid"
            })
          }
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="double">Double</option>
        </select>
      </label>
      <label>
        Color
        <span className="newsletter-text-color-row">
          <input
            type="color"
            value={(() => {
              const c = block.preset.color.trim();
              if (/^#[0-9a-f]{6}$/i.test(c)) return c;
              if (/^#[0-9a-f]{3}$/i.test(c)) return c;
              return "#e6f5ef";
            })()}
            onChange={(e) => set({ color: e.target.value })}
            aria-label="Line color"
          />
        </span>
      </label>
      <label>
        Top margin ({block.preset.marginTop}px)
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={block.preset.marginTop}
          onChange={(e) => set({ marginTop: Number(e.target.value) })}
        />
      </label>
      <label>
        Bottom margin ({block.preset.marginBottom}px)
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={block.preset.marginBottom}
          onChange={(e) => set({ marginBottom: Number(e.target.value) })}
        />
      </label>
    </>
  );
}

/* ----------------------------- Add menu hook ----------------------------- */

export function useAddBlockMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const toggle = () => setOpen((p) => !p);
  return useMemo(() => ({ open, close, toggle }), [open]);
}
