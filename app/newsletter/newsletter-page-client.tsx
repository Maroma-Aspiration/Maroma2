"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatStoryDate } from "../../lib/story-format";
import type { StoriesState, StoryRecord, StorySource } from "../../lib/story-types";
import type { NewsletterCampaignSummary } from "../../lib/newsletter-audience-types";

type StoryFieldKey = "title" | "excerpt" | "body" | "ctaLabel" | "ctaUrl" | "sourceUrl" | "imageUrl";

const normalizePourKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseMailingListCsv(text: string): { email: string; name?: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = (line: string) =>
    line.split(delim).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const headerCells = split(lines[0]);
  const hasHeader = headerCells.some((h) => /email/i.test(h));
  let startRow = 0;
  let emailCol = 0;
  let nameCol = -1;
  if (hasHeader) {
    startRow = 1;
    emailCol = headerCells.findIndex((h) => /^email$/i.test(h));
    if (emailCol < 0) {
      emailCol = 0;
    }
    nameCol = headerCells.findIndex((h) => /^(name|full\s*name)$/i.test(h));
  }
  const out: { email: string; name?: string }[] = [];
  for (let i = startRow; i < lines.length; i++) {
    const cols = split(lines[i]);
    const email = cols[emailCol]?.trim();
    if (!email || email.startsWith("#")) {
      continue;
    }
    const name = nameCol >= 0 ? cols[nameCol]?.trim() : "";
    out.push(name ? { email, name } : { email });
  }
  return out;
}

function applyTextPourToState(text: string, prev: StoriesState): { next: StoriesState; summary: string } {
  const rawLines = text.replace(/\r/g, "").split("\n");
  const blocks: Record<string, string> = {};
  let currentKey = "";
  const pushLine = (line: string) => {
    if (!currentKey) return;
    blocks[currentKey] = blocks[currentKey] ? `${blocks[currentKey]}\n${line}` : line;
  };
  for (const raw of rawLines) {
    const line = raw.trimEnd();
    const match = line.match(/^([A-Za-z0-9 _-]{2,80}):\s*(.*)$/);
    if (match) {
      currentKey = normalizePourKey(match[1] ?? "");
      if (!currentKey) continue;
      blocks[currentKey] = (match[2] ?? "").trim();
      continue;
    }
    pushLine(line);
  }
  const topMap: Record<string, keyof StoriesState> = {
    newslettertitle: "newsletterTitle",
    issuetitle: "newsletterTitle",
    title: "newsletterTitle",
    maromamission: "newsletterMission",
    mission: "newsletterMission",
    greetingfromceo: "newsletterWelcomeLaura",
    welcomefromceo: "newsletterWelcomeLaura",
    welcomelaura: "newsletterWelcomeLaura",
    greeting: "newsletterWelcomeLaura",
    welcome: "newsletterWelcomeLaura",
    intro: "newsletterIntro",
    fallbackintro: "newsletterIntro"
  };
  const storyFieldMap: Record<string, StoryFieldKey> = {
    title: "title",
    headline: "title",
    excerpt: "excerpt",
    summary: "excerpt",
    body: "body",
    text: "body",
    ctalabel: "ctaLabel",
    cta: "ctaLabel",
    ctaurl: "ctaUrl",
    sourceurl: "sourceUrl",
    imageurl: "imageUrl"
  };
  const next: StoriesState = structuredClone(prev);
  let topApplied = 0;
  let storyApplied = 0;
  for (const [key, valueRaw] of Object.entries(blocks)) {
    const value = valueRaw.trim();
    if (!value) continue;
    const topField = topMap[key];
    if (topField) {
      (next[topField] as string) = value;
      if (topField === "newsletterMission") next.newsletterMissionHtml = "";
      if (topField === "newsletterWelcomeLaura") next.newsletterWelcomeLauraHtml = "";
      topApplied += 1;
      continue;
    }
    const storyMatch = key.match(/^story(\d+)([a-z]+)$/);
    if (!storyMatch) continue;
    const storyIndex = Number(storyMatch[1]) - 1;
    const rawField = storyMatch[2] ?? "";
    const storyField = storyFieldMap[rawField];
    if (!Number.isFinite(storyIndex) || storyIndex < 0 || !storyField) continue;
    while (next.stories.length <= storyIndex) {
      next.stories.push({
        id: crypto.randomUUID(),
        kind: "story",
        slug: "",
        title: "",
        excerpt: "",
        body: "",
        imageUrl: "",
        sourceUrl: "",
        source: "manual",
        ctaLabel: "Read more",
        ctaUrl: "",
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        featured: false
      });
    }
    next.stories[storyIndex] = {
      ...next.stories[storyIndex],
      [storyField]: value,
      updatedAt: new Date().toISOString()
    };
    storyApplied += 1;
  }
  return {
    next,
    summary: `Text pour applied: ${topApplied} header field(s), ${storyApplied} story field(s).`
  };
}

type ToolDrawer = "settings" | "tools" | "delivery" | null;

type Props = {
  initialState: StoriesState;
  editMode: boolean;
};

type EditableTarget = "issueHeading" | "missionHeading" | "missionBody" | "greetingHeading" | "greetingBody" | "topImage" | "logoImage" | "portraitImage" | "heroImage";

type StoryEditField = "title" | "excerpt" | "body" | "meta" | "cta" | "image";

const toDatetimeLocalValue = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDatetimeLocalValue = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const emptyStory = (): StoryRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind: "story",
    slug: "",
    title: "",
    excerpt: "",
    body: "",
    imageUrl: "",
    sourceUrl: "",
    source: "manual",
    ctaLabel: "Read more",
    ctaUrl: "",
    publishedAt: now,
    updatedAt: now,
    featured: false
  };
};

const emptyDivider = (): StoryRecord => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    kind: "divider",
    slug: `divider-${id}`,
    title: "Divider",
    excerpt: "",
    body: "",
    imageUrl: "",
    sourceUrl: "",
    source: "manual",
    ctaLabel: "",
    ctaUrl: "",
    publishedAt: now,
    updatedAt: now,
    featured: false
  };
};

const readFileAsDataUrl = async (file: File): Promise<string> => {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("invalid_file_data"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
};

const loadImage = async (src: string): Promise<HTMLImageElement> =>
  await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = src;
  });

type ImageEncodeOptions = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  forceJpeg?: boolean;
};

const canvasHasTransparency = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  try {
    const pixels = ctx.getImageData(0, 0, width, height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
};

const fileToDataUrl = async (file: File, options?: ImageEncodeOptions): Promise<string> => {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) {
    return rawDataUrl;
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(rawDataUrl);
  } catch {
    throw new Error("unsupported_image_format");
  }

  const maxWidth = options?.maxWidth ?? 1400;
  const maxHeight = options?.maxHeight ?? 1400;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas_not_available");
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const canHaveAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  const keepAlpha = canHaveAlpha && canvasHasTransparency(ctx, canvas.width, canvas.height);
  return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", options?.quality ?? 0.78);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const textToHtml = (value: string) =>
  value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");

const sanitizeRichHtml = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
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

type RichTextEditorProps = {
  value: string;
  placeholder: string;
  onChange: (html: string, text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: () => void;
};

function RichTextEditor({ value, placeholder, onChange, className, style, onFocus }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleCommand = (command: "bold" | "italic" | "removeFormat") => {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) {
      const html = sanitizeRichHtml(editorRef.current.innerHTML);
      onChange(html, editorRef.current.innerText);
    }
  };

  const handleEditorChange = (element: HTMLDivElement) => {
    const html = sanitizeRichHtml(element.innerHTML);
    if (html !== element.innerHTML) {
      element.innerHTML = html;
    }
    onChange(html, element.innerText);
  };

  return (
    <div className="newsletter-rich-editor-wrap">
      <div className="newsletter-rich-editor-toolbar" aria-label="Rich text controls">
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("bold")}>
          Bold
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("italic")}>
          Italic
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("removeFormat")}>
          Clear formatting
        </button>
      </div>
      <div
        ref={editorRef}
        className={className ? `newsletter-rich-editor ${className}` : "newsletter-rich-editor"}
        style={style}
        contentEditable
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onFocus={onFocus}
        onInput={(event) => handleEditorChange(event.currentTarget)}
      />
    </div>
  );
}

type SingleLineEditableProps = {
  value: string;
  onChange: (text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onFocus?: () => void;
  as?: "h1" | "h2";
};

function SingleLineEditable({ value, onChange, className, style, placeholder, onFocus, as = "h2" }: SingleLineEditableProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && document.activeElement !== ref.current) {
      ref.current.innerText = value;
    }
  }, [value]);

  const handleInput = (el: HTMLHeadingElement) => {
    onChange(el.innerText.replace(/\n/g, " "));
  };

  const props = {
    ref,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    onFocus,
    onKeyDown: (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        ref.current?.blur();
      }
    },
    onInput: (e: React.FormEvent<HTMLHeadingElement>) => handleInput(e.currentTarget)
  } as const;

  return as === "h1" ? <h1 {...props} /> : <h2 {...props} />;
}

export default function NewsletterPageClient({ initialState, editMode }: Props) {
  const [state, setState] = useState<StoriesState>(initialState);
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [selectedEditorTarget, setSelectedEditorTarget] = useState<EditableTarget | null>(null);
  const [selectedStoryEdit, setSelectedStoryEdit] = useState<{ storyId: string; field: StoryEditField } | null>(null);
  const [openDrawer, setOpenDrawer] = useState<ToolDrawer>(null);
  const [importUrls, setImportUrls] = useState("");
  const [webSearchQuery, setWebSearchQuery] = useState("Maroma Auroville");
  const [webSearchMax, setWebSearchMax] = useState(12);
  const [textPourStatus, setTextPourStatus] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("Maroma newsletter");
  const [audienceInfo, setAudienceInfo] = useState<{
    activeSubscribers: number;
    totalSubscribers: number;
    campaigns: NewsletterCampaignSummary[];
    envHints: {
      resendConfigured: boolean;
      trackingSecretConfigured: boolean;
      siteUrlConfigured: boolean;
    };
  } | null>(null);
  const topImageUploadRef = useRef<HTMLInputElement | null>(null);
  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const portraitUploadRef = useRef<HTMLInputElement | null>(null);
  const heroUploadRef = useRef<HTMLInputElement | null>(null);
  const storyImageUploadRef = useRef<HTMLInputElement | null>(null);
  const textPourRef = useRef<HTMLInputElement | null>(null);
  const mailingListRef = useRef<HTMLInputElement | null>(null);
  const canEdit = editMode;
  const canTransformImages = editMode;
  const isImageTarget = (target: EditableTarget) =>
    target === "topImage" || target === "logoImage" || target === "portraitImage" || target === "heroImage";

  const clearEditors = () => {
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
  };

  const selectBlock = (target: EditableTarget) => {
    setSelectedStoryEdit(null);
    setSelectedEditorTarget(target);
  };

  const selectStoryField = (storyId: string, field: StoryEditField) => {
    setSelectedEditorTarget(null);
    setSelectedStoryEdit({ storyId, field });
  };

  const isStoryFieldSelected = (storyId: string, field: StoryEditField) =>
    selectedStoryEdit?.storyId === storyId && selectedStoryEdit.field === field;

  const featured = state.stories.slice(0, 6);
  const issueDate = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
    []
  );
  const topImageSrc = state.newsletterTopImageUrl.trim();
  const logoSrc = state.newsletterLogoUrl.trim() || "/maroma-logo.png";
  const portraitSrc = state.newsletterPortraitUrl.trim();
  const heroSrc = state.newsletterHeroImageUrl.trim();
  const mission = state.newsletterMission.trim();
  const missionHtml = state.newsletterMissionHtml.trim();
  const welcomeLine = state.newsletterWelcomeLaura.trim() || state.newsletterIntro.trim();
  const welcomeHtml = state.newsletterWelcomeLauraHtml.trim();
  const hasMission = Boolean(missionHtml || mission);
  const hasWelcome = Boolean(welcomeHtml || welcomeLine);
  const getStyleForTarget = (target: EditableTarget) => {
    if (
      target === "issueHeading" ||
      target === "missionHeading" ||
      target === "missionBody" ||
      target === "greetingHeading" ||
      target === "greetingBody"
    ) {
      return state.newsletterElementStyles[target];
    }
    return null;
  };

  const getTransformForTarget = (target: EditableTarget) => {
    if (target === "topImage") return state.newsletterImageTransforms.topImage;
    if (target === "logoImage") return state.newsletterImageTransforms.logo;
    if (target === "portraitImage") return state.newsletterImageTransforms.portrait;
    if (target === "heroImage") return state.newsletterImageTransforms.hero;
    return null;
  };

  const setTargetStyle = (
    target: EditableTarget,
    patch: Partial<(typeof state.newsletterElementStyles)["issueHeading"]>
  ) => {
    const current = getStyleForTarget(target);
    if (!current) return;
    setState((prev) => ({
      ...prev,
      newsletterElementStyles: {
        ...prev.newsletterElementStyles,
        [target]: {
          ...prev.newsletterElementStyles[target],
          ...patch
        }
      }
    }));
  };

  const setAllTextStyles = (
    patch: Partial<(typeof state.newsletterElementStyles)["issueHeading"]>
  ) => {
    setState((prev) => ({
      ...prev,
      newsletterElementStyles: Object.fromEntries(
        Object.entries(prev.newsletterElementStyles).map(([key, value]) => [
          key,
          { ...value, ...patch }
        ])
      ) as typeof prev.newsletterElementStyles
    }));
  };

  const setTargetImageTransform = (
    target: EditableTarget,
    patch: Partial<{ x: number; y: number; zoom: number; borderRadius: number }>
  ) => {
    const current = getTransformForTarget(target);
    if (!current) return;
    const key =
      target === "topImage"
        ? "topImage"
        : target === "logoImage"
          ? "logo"
          : target === "portraitImage"
            ? "portrait"
            : "hero";
    setState((prev) => ({
      ...prev,
      newsletterImageTransforms: {
        ...prev.newsletterImageTransforms,
        [key]: {
          ...prev.newsletterImageTransforms[key],
          ...patch,
          ...(typeof patch.zoom === "number"
            ? { zoom: Math.min(3, Math.max(0.01, patch.zoom)) }
            : {}),
          ...(typeof patch.borderRadius === "number"
            ? { borderRadius: Math.min(9999, Math.max(0, patch.borderRadius)) }
            : {})
        }
      }
    }));
  };

  const renderInlineControls = (target: EditableTarget) => {
    if (selectedEditorTarget !== target) return null;
    if (!canEdit && !(isImageTarget(target) && canTransformImages)) return null;
    const style = getStyleForTarget(target);
    const transform = getTransformForTarget(target);
    const isFloating = canEdit;
    const triggerUpload = () => {
      if (target === "topImage") topImageUploadRef.current?.click();
      else if (target === "logoImage") logoUploadRef.current?.click();
      else if (target === "portraitImage") portraitUploadRef.current?.click();
      else if (target === "heroImage") heroUploadRef.current?.click();
    };
    const targetLabel = target
      .replace("Image", " image")
      .replace("issueHeading", "issue heading")
      .replace("missionHeading", "mission heading")
      .replace("missionBody", "mission body")
      .replace("greetingHeading", "greeting heading")
      .replace("greetingBody", "greeting body");
    const inlineNode = (
      <aside className={`newsletter-element-controls${isFloating ? " is-floating" : ""}`}>
        {isFloating ? (
          <div className="newsletter-floating-controls-head">
            <strong>Adjust {targetLabel}</strong>
            <div className="newsletter-floating-controls-actions">
              {isImageTarget(target) ? (
                <>
                  <button type="button" className="button secondary" onClick={triggerUpload}>
                    Upload image
                  </button>
                  {(() => {
                    const removeField =
                      target === "topImage"
                        ? "newsletterTopImageUrl"
                        : target === "portraitImage"
                          ? "newsletterPortraitUrl"
                          : target === "heroImage"
                            ? "newsletterHeroImageUrl"
                            : null;
                    const hasValue = removeField ? Boolean((state as Record<string, unknown>)[removeField]) : false;
                    return removeField && hasValue ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setState((prev) => ({ ...prev, [removeField]: "" }))}
                      >
                        Remove
                      </button>
                    ) : null;
                  })()}
                </>
              ) : null}
              <button
                type="button"
                className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : ""}`}
                onClick={saveStories}
                disabled={saveState === "saving"}
              >
                {saveState === "saved" ? "Saved!" : saveState === "saving" ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={clearEditors}
                aria-label="Close adjust panel"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
        {target === "issueHeading" || target === "missionHeading" || target === "greetingHeading" ? (
          <p className="newsletter-inline-edit-hint">Click the heading on the page to edit it directly.</p>
        ) : null}
        {target === "missionBody" || target === "greetingBody" ? (
          <p className="newsletter-inline-edit-hint">Click the text on the page to edit it directly. Use this panel to change font, size, and color.</p>
        ) : null}
        {style ? (
          <>
            <label>
              Font
              <input
                value={style.fontFamily}
                onChange={(e) => setTargetStyle(target, { fontFamily: e.target.value })}
                placeholder="inherit, Georgia, Inter..."
              />
            </label>
            <label>
              Font size ({style.fontSizeRem.toFixed(2)}rem)
              <input
                type="range"
                min={0.6}
                max={5}
                step={0.02}
                value={style.fontSizeRem}
                onChange={(e) => setTargetStyle(target, { fontSizeRem: Number(e.target.value) })}
              />
            </label>
            <label>
              Alignment
              <select
                value={style.textAlign}
                onChange={(e) => setTargetStyle(target, { textAlign: e.target.value === "left" ? "left" : "center" })}
              >
                <option value="center">Center</option>
                <option value="left">Left</option>
              </select>
            </label>
            <label>
              Bold
              <input
                type="checkbox"
                checked={style.fontWeight >= 600}
                onChange={(e) => setTargetStyle(target, { fontWeight: e.target.checked ? 700 : 400 })}
              />
            </label>
            <label>
              Text color
              <span className="newsletter-text-color-row">
                <input
                  type="color"
                  value={style.color || "#f3f7f6"}
                  onChange={(e) => setTargetStyle(target, { color: e.target.value })}
                  aria-label="Text color"
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllTextStyles({ color: style.color || "#f3f7f6" })}
                  title="Apply this color to every text element in the newsletter"
                >
                  Apply to all
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setTargetStyle(target, { color: "" })}
                  title="Use default theme color for this element only"
                >
                  Default
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAllTextStyles({ color: "" })}
                  title="Reset color on every text element"
                >
                  Default all
                </button>
              </span>
            </label>
            <label>
              Quote breakout box
              <input
                type="checkbox"
                checked={style.isQuoteBox}
                onChange={(e) => setTargetStyle(target, { isQuoteBox: e.target.checked })}
              />
            </label>
            {style.isQuoteBox ? (
              <label>
                Quote box color
                <input
                  type="color"
                  value={style.quoteBoxColor}
                  onChange={(e) => setTargetStyle(target, { quoteBoxColor: e.target.value })}
                />
              </label>
            ) : null}
          </>
        ) : null}
        {transform ? (
          <>
            <label>
              Position X ({transform.x}%)
              <input
                type="range"
                min={-500}
                max={500}
                step={1}
                value={transform.x}
                onChange={(e) => setTargetImageTransform(target, { x: Number(e.target.value) })}
              />
            </label>
            <label>
              Position Y ({transform.y}%)
              <input
                type="range"
                min={-500}
                max={500}
                step={1}
                value={transform.y}
                onChange={(e) => setTargetImageTransform(target, { y: Number(e.target.value) })}
              />
            </label>
            <label>
              Zoom ({transform.zoom.toFixed(2)}x)
              <input
                type="range"
                min={0.01}
                max={3}
                step={0.01}
                value={transform.zoom}
                onChange={(e) => setTargetImageTransform(target, { zoom: Number(e.target.value) })}
              />
            </label>
            <label>
              Corner radius ({transform.borderRadius >= 9999 ? "Full" : `${transform.borderRadius}px`})
              <div className="newsletter-radius-row">
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={0.5}
                  value={Math.min(80, transform.borderRadius)}
                  onChange={(e) => setTargetImageTransform(target, { borderRadius: Number(e.target.value) })}
                  aria-label="Corner radius (fine)"
                />
                <input
                  type="number"
                  min={0}
                  max={9999}
                  step={0.5}
                  value={transform.borderRadius >= 9999 ? 9999 : Number(transform.borderRadius.toFixed(1))}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw.trim()) return;
                    const next = Number.parseFloat(raw);
                    if (!Number.isFinite(next)) return;
                    setTargetImageTransform(target, { borderRadius: next });
                  }}
                  className="newsletter-radius-number"
                  aria-label="Corner radius value (px)"
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setTargetImageTransform(target, { borderRadius: 0 })}
                  title="Reset to 0px"
                >
                  Reset
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={400}
                step={1}
                value={Math.min(400, transform.borderRadius)}
                onChange={(e) => setTargetImageTransform(target, { borderRadius: Number(e.target.value) })}
                aria-label="Corner radius (coarse)"
              />
            </label>
            <div className="newsletter-radius-presets">
              <button
                type="button"
                className="button secondary"
                onClick={() => setTargetImageTransform(target, { borderRadius: 0 })}
              >
                Square
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setTargetImageTransform(target, { borderRadius: 14 })}
              >
                Soft
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setTargetImageTransform(target, { borderRadius: 9999 })}
              >
                Pill / Circle
              </button>
            </div>
          </>
        ) : null}
      </aside>
    );
    if (isFloating && typeof document !== "undefined") {
      return createPortal(inlineNode, document.body);
    }
    return inlineNode;
  };

  const renderStoryEditPortal = () => {
    if (!canEdit || !selectedStoryEdit) return null;
    const story = state.stories.find((s) => s.id === selectedStoryEdit.storyId);
    if (!story || story.kind === "divider") return null;
    const { field } = selectedStoryEdit;
    const fieldLabels: Record<StoryEditField, string> = {
      title: "Title",
      excerpt: "Excerpt",
      body: "Full body",
      meta: "Date & source",
      cta: "Buttons & links",
      image: "Image"
    };
    const storySources: StorySource[] = ["manual", "instagram", "facebook", "web", "rss"];
    const node = (
      <aside className="newsletter-element-controls is-floating">
        <div className="newsletter-floating-controls-head">
          <strong>Edit story — {fieldLabels[field]}</strong>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : ""}`}
              onClick={saveStories}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? "Saved!" : saveState === "saving" ? "Saving..." : "Save"}
            </button>
            <button type="button" className="button secondary" onClick={clearEditors} aria-label="Close story editor">
              Close
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setState((prev) => ({ ...prev, stories: prev.stories.filter((s) => s.id !== story.id) }));
                clearEditors();
              }}
            >
              Delete story
            </button>
          </div>
        </div>
        {field === "title" ? (
          <label>
            Title
            <input value={story.title} onChange={(e) => updateStory(story.id, { title: e.target.value })} placeholder="Story title" />
          </label>
        ) : null}
        {field === "excerpt" ? (
          <label>
            Excerpt
            <textarea rows={4} value={story.excerpt} onChange={(e) => updateStory(story.id, { excerpt: e.target.value })} placeholder="Story excerpt" />
          </label>
        ) : null}
        {field === "body" ? (
          <label>
            Body (not shown in compact newsletter layout; kept for CMS / future use)
            <textarea rows={10} value={story.body} onChange={(e) => updateStory(story.id, { body: e.target.value })} placeholder="Story body" />
          </label>
        ) : null}
        {field === "meta" ? (
          <>
            <label>
              Published
              <input
                type="datetime-local"
                value={toDatetimeLocalValue(story.publishedAt)}
                onChange={(e) => updateStory(story.id, { publishedAt: fromDatetimeLocalValue(e.target.value) })}
              />
            </label>
            <label>
              Source label
              <select
                value={story.source}
                onChange={(e) => updateStory(story.id, { source: e.target.value as StorySource })}
              >
                {storySources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Slug (optional URL slug for blog page)
              <input
                value={story.slug}
                onChange={(e) => updateStory(story.id, { slug: e.target.value })}
                placeholder="auto from title if blank"
              />
            </label>
            <label className="newsletter-checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(story.featured)}
                onChange={(e) => updateStory(story.id, { featured: e.target.checked })}
              />
              <span>Feature story (pin to top of blog)</span>
            </label>
          </>
        ) : null}
        {field === "cta" ? (
          <>
            <label>
              CTA button text
              <input value={story.ctaLabel} onChange={(e) => updateStory(story.id, { ctaLabel: e.target.value })} placeholder="Read more" />
            </label>
            <label>
              CTA link
              <input value={story.ctaUrl} onChange={(e) => updateStory(story.id, { ctaUrl: e.target.value })} placeholder="https://..." />
            </label>
            <label>
              Source URL
              <input value={story.sourceUrl} onChange={(e) => updateStory(story.id, { sourceUrl: e.target.value })} placeholder="https://..." />
            </label>
          </>
        ) : null}
        {field === "image" ? (
          <>
            <label>
              Image URL
              <input value={story.imageUrl} onChange={(e) => updateStory(story.id, { imageUrl: e.target.value })} placeholder="Story image URL" />
            </label>
            <div className="newsletter-story-image-panel-actions">
              <button type="button" className="button secondary" onClick={() => storyImageUploadRef.current?.click()}>
                Upload image
              </button>
              <button type="button" className="button secondary" onClick={() => updateStory(story.id, { imageUrl: "" })}>
                Clear image
              </button>
            </div>
          </>
        ) : null}
      </aside>
    );
    if (typeof document === "undefined") return null;
    return createPortal(node, document.body);
  };

  const saveStories = async () => {
    setStatus("Saving...");
    setSaveState("saving");
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorMsg = payload?.error ? `Save failed: ${payload.error}` : `Save failed (${response.status}).`;
        throw new Error(errorMsg);
      }
      setStatus("Saved!");
      setSaveState("saved");
      setTimeout(() => {
        setStatus("");
        setSaveState("idle");
      }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setStatus(message);
      setSaveState("idle");
    }
  };

  const refreshAudience = useCallback(async () => {
    if (!canEdit) return;
    try {
      const response = await fetch("/api/newsletter/audience", { cache: "no-store" });
      if (!response.ok) throw new Error("audience");
      const payload = (await response.json()) as {
        activeSubscribers: number;
        totalSubscribers: number;
        campaigns: NewsletterCampaignSummary[];
        envHints: {
          resendConfigured: boolean;
          trackingSecretConfigured: boolean;
          siteUrlConfigured: boolean;
        };
      };
      setAudienceInfo(payload);
    } catch {
      setAudienceInfo(null);
    }
  }, [canEdit]);

  useEffect(() => {
    void refreshAudience();
  }, [refreshAudience]);

  const importStoriesFromUrls = async () => {
    const urls = importUrls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setStatus("Paste Instagram/Facebook post URLs first.");
      return;
    }
    setStatus("Importing social links...");
    try {
      const response = await fetch("/api/stories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls })
      });
      if (!response.ok) throw new Error("Import failed.");
      const payload = (await response.json()) as { state: StoriesState; importedCount: number };
      setState(payload.state);
      setStatus(`Imported ${payload.importedCount} stories.`);
    } catch {
      setStatus("Unable to import from those links.");
    }
  };

  const searchWebAndImport = async () => {
    setStatus("Searching the web and importing stories...");
    try {
      const response = await fetch("/api/stories/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: webSearchQuery, maxResults: webSearchMax })
      });
      if (!response.ok) throw new Error("Search import failed.");
      const payload = (await response.json()) as {
        state: StoriesState;
        importedCount: number;
        discoveredCount: number;
        provider: string;
        hint?: string;
      };
      setState(payload.state);
      const tail = payload.hint && payload.importedCount === 0 ? ` ${payload.hint}` : "";
      setStatus(
        `Web search (${payload.provider}): found ${payload.discoveredCount}, imported ${payload.importedCount} drafts.${tail}`
      );
    } catch {
      setStatus("Web search import failed.");
    }
  };

  const pullRssFeeds = async () => {
    const feeds = state.rssFeedUrls;
    if (feeds.length === 0) {
      setStatus("RSS pull skipped: paste one or more feed URLs first, then Pull again.");
      return;
    }
    setStatus("Pulling RSS / Atom feeds...");
    try {
      const response = await fetch("/api/stories/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUrls: feeds })
      });
      if (!response.ok) throw new Error("RSS import failed.");
      const payload = (await response.json()) as { state: StoriesState; importedCount: number };
      setState(payload.state);
      setStatus(`RSS pull complete: ${payload.importedCount} item(s) merged.`);
    } catch {
      setStatus("Unable to pull RSS feeds (check URLs and server reachability).");
    }
  };

  const handleTextPourFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTextPourStatus("Parsing text pour file...");
    try {
      const text = await file.text();
      const { next, summary } = applyTextPourToState(text, state);
      setState(next);
      setTextPourStatus(summary);
      setStatus("Text pour loaded. Review fields and click Save newsletter.");
    } catch {
      setTextPourStatus("Could not parse text file.");
    }
    event.target.value = "";
  };

  const handleMailingListFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDeliveryStatus("Parsing mailing list...");
    try {
      const text = await file.text();
      const rows = parseMailingListCsv(text);
      if (rows.length === 0) {
        setDeliveryStatus("No emails found. Use a column named email or put emails in column 1.");
        event.target.value = "";
        return;
      }
      const response = await fetch("/api/newsletter/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribers: rows })
      });
      if (!response.ok) throw new Error("merge failed");
      const payload = (await response.json()) as {
        added: number;
        updated: number;
        activeSubscribers: number;
      };
      await refreshAudience();
      setDeliveryStatus(
        `Imported ${rows.length} row(s): ${payload.added} new, ${payload.updated} updated. Active: ${payload.activeSubscribers}.`
      );
    } catch {
      setDeliveryStatus("Could not upload mailing list.");
    }
    event.target.value = "";
  };

  const sendNewsletterCampaign = async () => {
    setDeliveryStatus("Sending campaign...");
    try {
      const response = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: campaignSubject })
      });
      const payload = (await response.json()) as {
        error?: string;
        campaignId?: string;
        attempted?: number;
        sentOk?: number;
        failures?: { email: string; message: string }[];
      };
      if (!response.ok) {
        setDeliveryStatus(payload.error ?? "Send failed.");
        return;
      }
      await refreshAudience();
      const fails = payload.failures?.length ? ` Failures: ${payload.failures.length}.` : "";
      setDeliveryStatus(
        `Campaign ${payload.campaignId?.slice(0, 8) ?? ""}... sent ${payload.sentOk ?? 0} / ${payload.attempted ?? 0}.${fails}`
      );
    } catch {
      setDeliveryStatus("Send request failed.");
    }
  };

  const handleAssetUpload =
    (field: "newsletterTopImageUrl" | "newsletterLogoUrl" | "newsletterPortraitUrl" | "newsletterHeroImageUrl") =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(
          file,
          field === "newsletterPortraitUrl"
            ? { maxWidth: 700, maxHeight: 700, quality: 0.76, forceJpeg: true }
            : field === "newsletterHeroImageUrl"
              ? { maxWidth: 1400, maxHeight: 900, quality: 0.78, forceJpeg: true }
              : field === "newsletterTopImageUrl"
                ? { maxWidth: 1200, maxHeight: 600, quality: 0.78, forceJpeg: true }
                : { maxWidth: 900, maxHeight: 300, quality: 0.78, forceJpeg: true }
        );
        setState((prev) => ({ ...prev, [field]: dataUrl }));
        setStatus("Image loaded. Click Save newsletter.");
      } catch {
        setStatus("Could not load image. Try JPG or PNG.");
      }
      event.target.value = "";
    };

  const updateStory = (id: string, patch: Partial<StoryRecord>) => {
    setState((prev) => ({
      ...prev,
      stories: prev.stories.map((story) =>
        story.id === id ? { ...story, ...patch, updatedAt: new Date().toISOString() } : story
      )
    }));
  };

  const handleStoryImageUpload = (storyId: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.78,
        forceJpeg: true
      });
      updateStory(storyId, { imageUrl: dataUrl });
      setStatus("Story image loaded. Click Save newsletter.");
    } catch {
      setStatus("Could not load story image. Try JPG or PNG.");
    }
    event.target.value = "";
  };

  return (
    <main className="newsletter-page">
      {renderStoryEditPortal()}
      <section
        className={`newsletter-shell ${state.newsletterTextAlign === "left" ? "is-align-left" : "is-align-center"}${canEdit ? " is-preview" : ""}`}
        style={
          {
            "--newsletter-section-heading-size": `${state.newsletterSectionHeadingSizeRem ?? 0.86}rem`,
            "--newsletter-issue-heading-size": `${state.newsletterIssueHeadingSizeRem ?? 3}rem`,
            "--newsletter-body-font-size": `${state.newsletterBodyFontSizeRem ?? 1.04}rem`,
            "--newsletter-bg": state.newsletterBackgroundColor || "#10151c",
            background: state.newsletterBackgroundColor || undefined
          } as Record<string, string>
        }
      >
        {canEdit ? (
          <div className="newsletter-inline-toolbar">
            <button
              type="button"
              className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : ""}`}
              onClick={saveStories}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? "Saved!" : saveState === "saving" ? "Saving..." : "Save newsletter"}
            </button>
            <button
              type="button"
              className={`button secondary${openDrawer === "settings" ? " is-active" : ""}`}
              onClick={() => setOpenDrawer((prev) => (prev === "settings" ? null : "settings"))}
            >
              Settings
            </button>
            <button
              type="button"
              className={`button secondary${openDrawer === "tools" ? " is-active" : ""}`}
              onClick={() => setOpenDrawer((prev) => (prev === "tools" ? null : "tools"))}
            >
              Imports
            </button>
            <button
              type="button"
              className={`button secondary${openDrawer === "delivery" ? " is-active" : ""}`}
              onClick={() => setOpenDrawer((prev) => (prev === "delivery" ? null : "delivery"))}
            >
              Delivery
            </button>
            <label className="newsletter-bg-color-control" title="Background color">
              <span>Background</span>
              <input
                type="color"
                value={state.newsletterBackgroundColor || "#10151c"}
                onChange={(e) => setState((prev) => ({ ...prev, newsletterBackgroundColor: e.target.value }))}
                aria-label="Newsletter background color"
              />
              <button
                type="button"
                className="button secondary"
                onClick={() => setState((prev) => ({ ...prev, newsletterBackgroundColor: "#10151c" }))}
              >
                Reset
              </button>
            </label>
            {status ? <p className="admin-status">{status}</p> : null}
          </div>
        ) : null}

        {canEdit && openDrawer ? (
          <div className="newsletter-tool-drawer">
            <div className="newsletter-tool-drawer-head">
              <strong>
                {openDrawer === "settings" ? "Newsletter settings" : null}
                {openDrawer === "tools" ? "Story imports" : null}
                {openDrawer === "delivery" ? "Delivery & metrics" : null}
              </strong>
              <button type="button" className="button secondary" onClick={() => setOpenDrawer(null)}>
                Close
              </button>
            </div>

            {openDrawer === "settings" ? (
              <div className="newsletter-tool-drawer-body">
                <label>
                  Text alignment
                  <select
                    value={state.newsletterTextAlign}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        newsletterTextAlign: e.target.value === "left" ? "left" : "center"
                      }))
                    }
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                  </select>
                </label>
                <label>
                  Section heading size ({state.newsletterSectionHeadingSizeRem.toFixed(2)}rem)
                  <input
                    type="range"
                    min={0.6}
                    max={2}
                    step={0.02}
                    value={state.newsletterSectionHeadingSizeRem}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, newsletterSectionHeadingSizeRem: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Issue heading size ({state.newsletterIssueHeadingSizeRem.toFixed(2)}rem)
                  <input
                    type="range"
                    min={1.5}
                    max={5}
                    step={0.05}
                    value={state.newsletterIssueHeadingSizeRem}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, newsletterIssueHeadingSizeRem: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Body font size ({(state.newsletterBodyFontSizeRem ?? 1.04).toFixed(2)}rem)
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.01}
                    value={state.newsletterBodyFontSizeRem ?? 1.04}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, newsletterBodyFontSizeRem: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Fallback intro (legacy — used only when greeting is empty)
                  <textarea
                    rows={2}
                    value={state.newsletterIntro}
                    onChange={(e) => setState((prev) => ({ ...prev, newsletterIntro: e.target.value }))}
                    placeholder="Used only if greeting is empty."
                  />
                </label>
              </div>
            ) : null}

            {openDrawer === "tools" ? (
              <div className="newsletter-tool-drawer-body">
                <section>
                  <h3>Import from social URLs</h3>
                  <p className="admin-rss-hint">Paste Instagram/Facebook post URLs (one per line). No Meta API required.</p>
                  <textarea
                    value={importUrls}
                    onChange={(e) => setImportUrls(e.target.value)}
                    rows={3}
                    placeholder="https://www.instagram.com/p/...&#10;https://www.facebook.com/.../posts/..."
                  />
                  <button type="button" className="button secondary" onClick={importStoriesFromUrls}>
                    Import from pasted links
                  </button>
                </section>

                <section>
                  <h3>Web mentions → draft stories</h3>
                  <p className="admin-rss-hint">
                    Set <code>BRAVE_SEARCH_API_KEY</code> or Google CSE env vars for reliable results on Vercel.
                  </p>
                  <label>
                    Search query
                    <input value={webSearchQuery} onChange={(e) => setWebSearchQuery(e.target.value)} />
                  </label>
                  <label>
                    Max URLs (1–20)
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={webSearchMax}
                      onChange={(e) => setWebSearchMax(Number(e.target.value) || 12)}
                    />
                  </label>
                  <button type="button" className="button secondary" onClick={searchWebAndImport}>
                    Search web &amp; import drafts
                  </button>
                </section>

                <section>
                  <h3>RSS / Atom feeds</h3>
                  <textarea
                    value={state.rssFeedUrls.join("\n")}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        rssFeedUrls: e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                      }))
                    }
                    rows={3}
                    placeholder={"https://example.com/your-feed.xml\nhttps://example.com/atom.xml"}
                  />
                  <div className="admin-story-rss-actions">
                    <button type="button" className="button secondary" onClick={pullRssFeeds}>
                      Pull from RSS feeds now
                    </button>
                  </div>
                </section>

                <section>
                  <h3>Text pour</h3>
                  <p className="admin-rss-hint">
                    Upload a <code>.txt</code> with labeled sections (<code>Newsletter Title:</code>, <code>Mission:</code>,
                    <code>Greeting from CEO:</code>, <code>Story1Title:</code>, etc.).
                  </p>
                  <input
                    ref={textPourRef}
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleTextPourFile}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="button secondary" onClick={() => textPourRef.current?.click()}>
                    Upload text pour file
                  </button>
                  {textPourStatus ? <p className="admin-status">{textPourStatus}</p> : null}
                </section>
              </div>
            ) : null}

            {openDrawer === "delivery" ? (
              <div className="newsletter-tool-drawer-body">
                <section>
                  <h3>Audience</h3>
                  {audienceInfo ? (
                    <p className="admin-rss-hint">
                      <strong>{audienceInfo.activeSubscribers}</strong> active / {audienceInfo.totalSubscribers} total contacts.
                      {!audienceInfo.envHints.resendConfigured ? <span> Resend API key missing.</span> : null}
                      {!audienceInfo.envHints.trackingSecretConfigured ? <span> Tracking secret missing.</span> : null}
                      {!audienceInfo.envHints.siteUrlConfigured ? (
                        <span> Set NEXT_PUBLIC_SITE_URL for correct tracking URLs behind proxies.</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="admin-rss-hint">Loading audience…</p>
                  )}
                  <input
                    ref={mailingListRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleMailingListFile}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="button secondary" onClick={() => mailingListRef.current?.click()}>
                    Upload mailing list (CSV / TSV)
                  </button>
                </section>

                <section>
                  <h3>Send campaign</h3>
                  <label>
                    Email subject
                    <input value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} />
                  </label>
                  <button type="button" className="button primary" onClick={sendNewsletterCampaign}>
                    Send campaign now
                  </button>
                  {deliveryStatus ? <p className="admin-status">{deliveryStatus}</p> : null}
                </section>

                <section>
                  <h3>Recent campaigns</h3>
                  <div className="admin-newsletter-delivery-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Sent</th>
                          <th>Subject</th>
                          <th>Recipients</th>
                          <th>Opens</th>
                          <th>Clicks</th>
                          <th>Unsubs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(audienceInfo?.campaigns ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={6}>No sends yet.</td>
                          </tr>
                        ) : (
                          audienceInfo!.campaigns.map((c) => (
                            <tr key={c.id}>
                              <td>{new Date(c.sentAt).toLocaleString()}</td>
                              <td>{c.subject}</td>
                              <td>{c.recipientCount}</td>
                              <td>{c.uniqueOpens}</td>
                              <td>
                                {c.totalClicks}
                                {c.uniqueClickers > 0 ? ` (${c.uniqueClickers} recipients)` : ""}
                              </td>
                              <td>{c.unsubscribes}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="newsletter-editable-row">
          <div className="newsletter-asset-row newsletter-logo-row">
          <div
            className={`newsletter-logo-wrap${canTransformImages && selectedEditorTarget === "logoImage" ? " newsletter-edit-selected" : ""}`}
            onClick={canTransformImages ? () => selectBlock("logoImage") : undefined}
            style={{
              borderRadius: state.newsletterImageTransforms.logo.borderRadius
                ? `${state.newsletterImageTransforms.logo.borderRadius}px`
                : undefined,
              overflow: state.newsletterImageTransforms.logo.borderRadius ? "hidden" : undefined,
              isolation: state.newsletterImageTransforms.logo.borderRadius ? "isolate" : undefined
            }}
          >
            <div
              className="newsletter-image-transform"
              style={{
                transform: `translate(${state.newsletterImageTransforms.logo.x}%, ${state.newsletterImageTransforms.logo.y}%) scale(${state.newsletterImageTransforms.logo.zoom})`,
                transformOrigin: "center center"
              }}
            >
              <img
                src={logoSrc}
                alt="Maroma"
                className="newsletter-logo"
                style={{
                  borderRadius: state.newsletterImageTransforms.logo.borderRadius
                    ? `${state.newsletterImageTransforms.logo.borderRadius}px`
                    : undefined
                }}
              />
            </div>
          </div>
          </div>
          {renderInlineControls("logoImage")}
        </div>

        {topImageSrc || canEdit ? (
          <div className="newsletter-editable-row">
            <div className="newsletter-asset-row newsletter-top-image-row">
              <div
                className={`newsletter-top-image-wrap${topImageSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "topImage" ? " newsletter-edit-selected" : ""}`}
                onClick={canTransformImages ? () => selectBlock("topImage") : undefined}
                style={
                  topImageSrc
                    ? {
                        borderRadius: `${state.newsletterImageTransforms.topImage.borderRadius}px`,
                        overflow: "hidden",
                        isolation: "isolate"
                      }
                    : undefined
                }
              >
                {topImageSrc ? (
                  <div
                    className="newsletter-image-transform"
                    style={{
                      transform: `translate(${state.newsletterImageTransforms.topImage.x}%, ${state.newsletterImageTransforms.topImage.y}%) scale(${state.newsletterImageTransforms.topImage.zoom})`,
                      transformOrigin: "center center",
                      width: "100%",
                      lineHeight: 0
                    }}
                  >
                    <img
                      src={topImageSrc}
                      alt=""
                      className="newsletter-top-image"
                      style={{
                        borderRadius: `${state.newsletterImageTransforms.topImage.borderRadius}px`,
                        display: "block",
                        width: "100%",
                        height: "auto"
                      }}
                    />
                  </div>
                ) : (
                  <span className="newsletter-placeholder-label">Top image</span>
                )}
              </div>
            </div>
            {renderInlineControls("topImage")}
          </div>
        ) : null}
        <hr className="newsletter-rule" />

        <section className="newsletter-top-block" aria-label="Newsletter opening message">
          <div className="newsletter-top-grid">
            <div className="newsletter-editable-row">
              <div className="newsletter-asset-row newsletter-portrait-row">
              <div
                className={`newsletter-portrait-wrap${portraitSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "portraitImage" ? " newsletter-edit-selected" : ""}`}
                onClick={canTransformImages ? () => selectBlock("portraitImage") : undefined}
                style={
                  portraitSrc
                    ? {
                        borderRadius: `${state.newsletterImageTransforms.portrait.borderRadius}px`,
                        overflow: "hidden",
                        isolation: "isolate"
                      }
                    : undefined
                }
              >
                {portraitSrc ? (
                  <div
                    className="newsletter-image-transform"
                    style={{
                      transform: `translate(${state.newsletterImageTransforms.portrait.x}%, ${state.newsletterImageTransforms.portrait.y}%) scale(${state.newsletterImageTransforms.portrait.zoom})`,
                      transformOrigin: "center center",
                      width: "100%",
                      height: "100%",
                      lineHeight: 0
                    }}
                  >
                    <img
                      src={portraitSrc}
                      alt="CEO portrait"
                      className="newsletter-portrait-img"
                      style={{ borderRadius: `${state.newsletterImageTransforms.portrait.borderRadius}px` }}
                    />
                  </div>
                ) : (
                  <span className="newsletter-placeholder-label">CEO photo</span>
                )}
              </div>
              </div>
              {renderInlineControls("portraitImage")}
            </div>

            <div className="newsletter-editable-row">
              <div className="newsletter-asset-row newsletter-hero-row">
              <div
                className={`newsletter-hero-wrap${heroSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "heroImage" ? " newsletter-edit-selected" : ""}`}
                onClick={canTransformImages ? () => selectBlock("heroImage") : undefined}
                style={
                  heroSrc
                    ? {
                        borderRadius: `${state.newsletterImageTransforms.hero.borderRadius}px`,
                        overflow: "hidden",
                        isolation: "isolate"
                      }
                    : undefined
                }
              >
                {heroSrc ? (
                  <div
                    className="newsletter-image-transform"
                    style={{
                      transform: `translate(${state.newsletterImageTransforms.hero.x}%, ${state.newsletterImageTransforms.hero.y}%) scale(${state.newsletterImageTransforms.hero.zoom})`,
                      transformOrigin: "center center",
                      width: "100%",
                      lineHeight: 0
                    }}
                  >
                    <img
                      src={heroSrc}
                      alt=""
                      className="newsletter-hero-banner"
                      style={{ borderRadius: `${state.newsletterImageTransforms.hero.borderRadius}px` }}
                    />
                  </div>
                ) : (
                  <span className="newsletter-placeholder-label">Hero image</span>
                )}
              </div>
              </div>
              {renderInlineControls("heroImage")}
            </div>
          </div>

          {canTransformImages ? (
            <>
              <input
                ref={topImageUploadRef}
                type="file"
                accept="image/*"
                onChange={handleAssetUpload("newsletterTopImageUrl")}
                style={{ display: "none" }}
              />
              <input
                ref={logoUploadRef}
                type="file"
                accept="image/*"
                onChange={handleAssetUpload("newsletterLogoUrl")}
                style={{ display: "none" }}
              />
              <input
                ref={portraitUploadRef}
                type="file"
                accept="image/*"
                onChange={handleAssetUpload("newsletterPortraitUrl")}
                style={{ display: "none" }}
              />
              <input
                ref={heroUploadRef}
                type="file"
                accept="image/*"
                onChange={handleAssetUpload("newsletterHeroImageUrl")}
                style={{ display: "none" }}
              />
            </>
          ) : null}
          {canEdit ? (
            <input
              ref={storyImageUploadRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const sid = selectedStoryEdit?.storyId;
                if (!sid) return;
                void handleStoryImageUpload(sid)(e);
              }}
            />
          ) : null}

          <div className="newsletter-editable-row">
            {canEdit ? (
              <SingleLineEditable
                as="h1"
                value={state.newsletterTitle}
                onChange={(text) => setState((prev) => ({ ...prev, newsletterTitle: text }))}
                placeholder="Newsletter title"
                onFocus={() => selectBlock("issueHeading")}
                className={`newsletter-issue-heading newsletter-inline-edit${selectedEditorTarget === "issueHeading" ? " newsletter-edit-selected" : ""}`}
                style={{
                  fontFamily: state.newsletterElementStyles.issueHeading.fontFamily,
                  fontSize: `${state.newsletterElementStyles.issueHeading.fontSizeRem}rem`,
                  textAlign: state.newsletterElementStyles.issueHeading.textAlign,
                  fontWeight: state.newsletterElementStyles.issueHeading.fontWeight,
                  color: state.newsletterElementStyles.issueHeading.color || undefined
                }}
              />
            ) : (
              <h1
                className="newsletter-issue-heading"
                style={{
                  fontFamily: state.newsletterElementStyles.issueHeading.fontFamily,
                  fontSize: `${state.newsletterElementStyles.issueHeading.fontSizeRem}rem`,
                  textAlign: state.newsletterElementStyles.issueHeading.textAlign,
                  fontWeight: state.newsletterElementStyles.issueHeading.fontWeight,
                  color: state.newsletterElementStyles.issueHeading.color || undefined
                }}
              >
                {state.newsletterTitle} | {issueDate}
              </h1>
            )}
            {canEdit ? <p className="newsletter-issue-date-hint">| {issueDate}</p> : null}
            {renderInlineControls("issueHeading")}
          </div>
          <hr className="newsletter-rule" />

          <div className={`newsletter-mission-block${hasMission || canEdit ? "" : " is-placeholder"}`}>
            <div className="newsletter-editable-row">
              {canEdit ? (
                <RichTextEditor
                  value={missionHtml || textToHtml(mission)}
                  onChange={(html, text) =>
                    setState((prev) => ({ ...prev, newsletterMissionHtml: html, newsletterMission: text }))
                  }
                  placeholder="Maroma mission statement"
                  onFocus={() => selectBlock("missionBody")}
                  className={`newsletter-mission newsletter-rich-text newsletter-inline-edit${selectedEditorTarget === "missionBody" ? " newsletter-edit-selected" : ""}${state.newsletterElementStyles.missionBody.isQuoteBox ? " newsletter-quote-box" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.missionBody.fontFamily,
                    fontSize: `${state.newsletterElementStyles.missionBody.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.missionBody.textAlign,
                    fontWeight: state.newsletterElementStyles.missionBody.fontWeight,
                    color: state.newsletterElementStyles.missionBody.color || undefined,
                    ["--quote-box-color" as string]: state.newsletterElementStyles.missionBody.quoteBoxColor
                  }}
                />
              ) : hasMission ? (
                <div
                  className={`newsletter-mission newsletter-rich-text${state.newsletterElementStyles.missionBody.isQuoteBox ? " newsletter-quote-box" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.missionBody.fontFamily,
                    fontSize: `${state.newsletterElementStyles.missionBody.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.missionBody.textAlign,
                    fontWeight: state.newsletterElementStyles.missionBody.fontWeight,
                    color: state.newsletterElementStyles.missionBody.color || undefined,
                    ["--quote-box-color" as string]: state.newsletterElementStyles.missionBody.quoteBoxColor
                  }}
                  dangerouslySetInnerHTML={{ __html: missionHtml || textToHtml(mission) }}
                />
              ) : null}
              {renderInlineControls("missionBody")}
            </div>
          </div>
          <hr className="newsletter-rule" />

          <div className={`newsletter-greeting-block${hasWelcome || canEdit ? "" : " is-placeholder"}`}>
            <div className="newsletter-editable-row">
              {canEdit ? (
                <SingleLineEditable
                  value={state.newsletterMissionHeading || ""}
                  onChange={(text) => setState((prev) => ({ ...prev, newsletterMissionHeading: text }))}
                  placeholder="Maroma mission heading"
                  onFocus={() => selectBlock("missionHeading")}
                  className={`newsletter-section-title newsletter-inline-edit${selectedEditorTarget === "missionHeading" ? " newsletter-edit-selected" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.missionHeading.fontFamily,
                    fontSize: `${state.newsletterElementStyles.missionHeading.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.missionHeading.textAlign,
                    fontWeight: state.newsletterElementStyles.missionHeading.fontWeight,
                    color: state.newsletterElementStyles.missionHeading.color || undefined
                  }}
                />
              ) : (
                <h2
                  className="newsletter-section-title"
                  style={{
                    fontFamily: state.newsletterElementStyles.missionHeading.fontFamily,
                    fontSize: `${state.newsletterElementStyles.missionHeading.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.missionHeading.textAlign,
                    fontWeight: state.newsletterElementStyles.missionHeading.fontWeight,
                    color: state.newsletterElementStyles.missionHeading.color || undefined
                  }}
                >
                  {state.newsletterMissionHeading?.trim() || "Maroma mission"}
                </h2>
              )}
              {renderInlineControls("missionHeading")}
            </div>
            <div className="newsletter-editable-row">
              {canEdit ? (
                <SingleLineEditable
                  value={state.newsletterGreetingHeading || ""}
                  onChange={(text) => setState((prev) => ({ ...prev, newsletterGreetingHeading: text }))}
                  placeholder="Greeting heading"
                  onFocus={() => selectBlock("greetingHeading")}
                  className={`newsletter-section-title newsletter-inline-edit${selectedEditorTarget === "greetingHeading" ? " newsletter-edit-selected" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.greetingHeading.fontFamily,
                    fontSize: `${state.newsletterElementStyles.greetingHeading.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.greetingHeading.textAlign,
                    fontWeight: state.newsletterElementStyles.greetingHeading.fontWeight,
                    color: state.newsletterElementStyles.greetingHeading.color || undefined
                  }}
                />
              ) : (
                <h2
                  className="newsletter-section-title"
                  style={{
                    fontFamily: state.newsletterElementStyles.greetingHeading.fontFamily,
                    fontSize: `${state.newsletterElementStyles.greetingHeading.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.greetingHeading.textAlign,
                    fontWeight: state.newsletterElementStyles.greetingHeading.fontWeight,
                    color: state.newsletterElementStyles.greetingHeading.color || undefined
                  }}
                >
                  {state.newsletterGreetingHeading?.trim() || "Greeting"}
                </h2>
              )}
              {renderInlineControls("greetingHeading")}
            </div>
            <div className="newsletter-editable-row">
              {canEdit ? (
                <RichTextEditor
                  value={welcomeHtml || textToHtml(welcomeLine)}
                  onChange={(html, text) =>
                    setState((prev) => ({ ...prev, newsletterWelcomeLauraHtml: html, newsletterWelcomeLaura: text }))
                  }
                  placeholder="Greeting from CEO"
                  onFocus={() => selectBlock("greetingBody")}
                  className={`newsletter-intro newsletter-rich-text newsletter-inline-edit${selectedEditorTarget === "greetingBody" ? " newsletter-edit-selected" : ""}${state.newsletterElementStyles.greetingBody.isQuoteBox ? " newsletter-quote-box" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.greetingBody.fontFamily,
                    fontSize: `${state.newsletterElementStyles.greetingBody.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.greetingBody.textAlign,
                    fontWeight: state.newsletterElementStyles.greetingBody.fontWeight,
                    color: state.newsletterElementStyles.greetingBody.color || undefined,
                    ["--quote-box-color" as string]: state.newsletterElementStyles.greetingBody.quoteBoxColor
                  }}
                />
              ) : hasWelcome ? (
                <div
                  className={`newsletter-intro newsletter-rich-text${state.newsletterElementStyles.greetingBody.isQuoteBox ? " newsletter-quote-box" : ""}`}
                  style={{
                    fontFamily: state.newsletterElementStyles.greetingBody.fontFamily,
                    fontSize: `${state.newsletterElementStyles.greetingBody.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.greetingBody.textAlign,
                    fontWeight: state.newsletterElementStyles.greetingBody.fontWeight,
                    color: state.newsletterElementStyles.greetingBody.color || undefined,
                    ["--quote-box-color" as string]: state.newsletterElementStyles.greetingBody.quoteBoxColor
                  }}
                  dangerouslySetInnerHTML={{ __html: welcomeHtml || textToHtml(welcomeLine) }}
                />
              ) : null}
              {renderInlineControls("greetingBody")}
            </div>
          </div>
          <hr className="newsletter-rule" />
        </section>

        <div className="newsletter-list">
          {featured.length === 0 ? (
            <article className="newsletter-story">
              <h2>No stories yet</h2>
              <p>Use the <strong>Imports</strong> drawer above (or click <strong>Add story</strong> below) to add stories.</p>
            </article>
          ) : (
            featured.map((story) => (
              story.kind === "divider" ? (
                <div key={story.id} className="newsletter-divider-item">
                  <hr className="newsletter-rule" />
                  {canEdit ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setState((prev) => ({ ...prev, stories: prev.stories.filter((s) => s.id !== story.id) }))
                      }
                    >
                      Delete divider
                    </button>
                  ) : null}
                </div>
              ) : (
              <article key={story.id} className="newsletter-story">
                {story.imageUrl ? (
                  <img
                    src={story.imageUrl}
                    alt={story.title}
                    className={
                      canEdit
                        ? `newsletter-story-img-editable${isStoryFieldSelected(story.id, "image") ? " newsletter-edit-selected" : ""}`
                        : undefined
                    }
                    onClick={canEdit ? () => selectStoryField(story.id, "image") : undefined}
                  />
                ) : canEdit ? (
                  <button
                    type="button"
                    className={`newsletter-story-image-placeholder${isStoryFieldSelected(story.id, "image") ? " newsletter-edit-selected" : ""}`}
                    onClick={() => selectStoryField(story.id, "image")}
                  >
                    Add story image
                  </button>
                ) : null}

                <p
                  className={`newsletter-story-meta${canEdit ? " newsletter-story-text-editable" : ""}${canEdit && isStoryFieldSelected(story.id, "meta") ? " newsletter-edit-selected" : ""}`}
                  onClick={canEdit ? () => selectStoryField(story.id, "meta") : undefined}
                  role={canEdit ? "button" : undefined}
                >
                  {formatStoryDate(story.publishedAt)} - {story.source}
                </p>
                <h2
                  className={
                    canEdit
                      ? `newsletter-story-title${isStoryFieldSelected(story.id, "title") ? " newsletter-edit-selected" : ""}`
                      : undefined
                  }
                  onClick={canEdit ? () => selectStoryField(story.id, "title") : undefined}
                  role={canEdit ? "button" : undefined}
                >
                  {story.title.trim() || (canEdit ? "Click to edit title" : "")}
                </h2>
                <p
                  className={
                    canEdit
                      ? `newsletter-story-excerpt${isStoryFieldSelected(story.id, "excerpt") ? " newsletter-edit-selected" : ""}`
                      : undefined
                  }
                  onClick={canEdit ? () => selectStoryField(story.id, "excerpt") : undefined}
                  role={canEdit ? "button" : undefined}
                >
                  {story.excerpt.trim() || (canEdit ? "Click to edit excerpt" : "")}
                </p>
                {canEdit ? (
                  <button type="button" className="button secondary newsletter-story-edit-body-btn" onClick={() => selectStoryField(story.id, "body")}>
                    Edit full body…
                  </button>
                ) : null}

                <div className="newsletter-story-cta">
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className={`button primary button-sage${isStoryFieldSelected(story.id, "cta") ? " newsletter-edit-selected" : ""}`}
                        onClick={() => selectStoryField(story.id, "cta")}
                      >
                        {story.ctaLabel?.trim() || (story.ctaUrl ? "Read more" : "Set CTA")}
                      </button>
                      <button
                        type="button"
                        className={`button secondary${isStoryFieldSelected(story.id, "cta") ? " newsletter-edit-selected" : ""}`}
                        onClick={() => selectStoryField(story.id, "cta")}
                      >
                        Source link
                      </button>
                    </>
                  ) : (
                    <>
                      {story.ctaUrl ? (
                        <a href={story.ctaUrl} target="_blank" rel="noopener noreferrer" className="button primary button-sage">
                          {story.ctaLabel || "Read more"}
                        </a>
                      ) : null}
                      {story.sourceUrl ? (
                        <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer" className="button secondary">
                          Source
                        </a>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
              )
            ))
          )}
        </div>

        {canEdit ? (
          <div className="newsletter-inline-toolbar">
            <button
              type="button"
              className="button secondary"
              onClick={() => setState((prev) => ({ ...prev, stories: [...prev.stories, emptyStory()] }))}
            >
              Add story
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setState((prev) => ({ ...prev, stories: [...prev.stories, emptyDivider()] }))}
            >
              Add divider
            </button>
            <button
              type="button"
              className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : ""}`}
              onClick={saveStories}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? "Saved!" : saveState === "saving" ? "Saving..." : "Save newsletter"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

