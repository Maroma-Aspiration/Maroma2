"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatStoryDate } from "../../lib/story-format";
import {
  DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET,
  type NewsletterBlock,
  type NewsletterBlockKind,
  type NewsletterStoryBlock,
  type StoriesState,
  type StoryRecord,
  type StorySource,
  type NewsletterLayoutDivider,
  type NewsletterLayoutDividerPreset,
  type NewsletterLayoutSectionId,
  type StoryImageFrame
} from "../../lib/story-types";
import type { NewsletterCampaignSummary, NewsletterMailingListSummary } from "../../lib/newsletter-audience-types";
import { applyBlockToLegacyState } from "../../lib/newsletter-block-legacy-sync";
import {
  captureFreshIssueTemplateState,
  clearPreviousNewsletterIssue,
  createFreshNewsletterIssueState,
  hasPreviousNewsletterIssueBackup,
  isLightInkColor,
  loadPreviousNewsletterIssue,
  resolveNewsletterInkColor,
  storePreviousNewsletterIssue,
} from "../../lib/newsletter-issue-reset";
import { preferServerCanvasOverLocalDraft } from "../../lib/newsletter-restore-issue";
import { reconcileNewsletterCanvasState } from "../../lib/canvas-reconcile-stories";
import type { NewsletterArchiveSummary } from "../../lib/newsletter-archive-types";
import { refreshStorySnapshotsInBlocks, storyToBlock } from "../../lib/newsletter-migrate-legacy-blocks";
import { hideNewsletterExcerptBecauseBodyCoversIt } from "../../lib/newsletter-story-display";
import { normalizeStoryImageFrame, storySingleImageFrameStyles } from "../../lib/story-image-frame";
import { NewsletterBlockEditPane, NewsletterBlocksRenderer, createBlock } from "./newsletter-blocks";
import { loadStorySpacingGaps, saveStorySpacingGaps, parseStorySpacingGaps, DEFAULT_STORY_SPACING_GAPS, STORY_BODY_TO_CTA_GAP, type StorySpacingGaps } from "../../lib/story-spacing-gaps";
import {
  formatEmailList,
  isValidEmail,
  loadTestMailingList,
  parseEmailList,
  saveTestMailingList,
} from "../../lib/test-mailing-list";
import { MASTHEAD_BANNER_W, MASTHEAD_PORTRAIT_SIZE, mastheadCenterX, estimateStoryGridHeight, ensureMastheadZOrder, measureElementHeight, GREETING_TO_NEXT_GAP, STORY_GRID_TO_SECTION_GAP } from "../../lib/canvas-layout";
import { NewsletterCanvas, makeTextEl, makeImageEl, makeDividerEl, makeStoryGridEl, makeCtaEl, type NewsletterCanvasHandle } from "./newsletter-canvas";
import StorySpacingControls from "./story-spacing-controls";
import { useAdminSession } from "../../lib/use-admin-session";

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
        featured: false,
        imageFrame: normalizeStoryImageFrame(undefined),
      });
    }
    next.stories[storyIndex] = {
      ...next.stories[storyIndex],
      [storyField]: value,
      updatedAt: new Date().toISOString()
    };
    storyApplied += 1;
  }
  if ((next.newsletterBlocksMigrationVersion ?? 0) >= 1) {
    return {
      next: refreshStorySnapshotsInBlocks(next),
      summary: `Text pour applied: ${topApplied} header field(s), ${storyApplied} story field(s).`
    };
  }
  return {
    next,
    summary: `Text pour applied: ${topApplied} header field(s), ${storyApplied} story field(s).`
  };
}

const RICH_POUR_ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "A", "UL", "OL", "LI", "BLOCKQUOTE", "SPAN"
]);

function sanitizeRichInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (tag === "BR") return "<br />";
  const inner = Array.from(el.childNodes).map((child) => sanitizeRichInline(child)).join("");
  if (!RICH_POUR_ALLOWED_TAGS.has(tag)) return inner;
  if (tag === "A") {
    const rawHref = (el.getAttribute("href") ?? "").trim();
    const safe = /^(https?:|mailto:|tel:|\/)/i.test(rawHref) ? rawHref : "";
    const escaped = safe.replace(/"/g, "&quot;");
    return safe ? `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
  }
  const remap: Record<string, string> = { B: "strong", I: "em" };
  const out = remap[tag] ?? tag.toLowerCase();
  return `<${out}>${inner}</${out}>`;
}

function blockNodeToHtml(node: Element): string {
  const tag = node.tagName.toUpperCase();
  if (tag === "P" || tag === "DIV") {
    const inner = Array.from(node.childNodes).map(sanitizeRichInline).join("").trim();
    return inner ? `<p>${inner}</p>` : "";
  }
  if (tag === "UL" || tag === "OL") {
    const items = Array.from(node.children)
      .filter((c) => c.tagName.toUpperCase() === "LI")
      .map((li) => {
        const inner = Array.from(li.childNodes).map(sanitizeRichInline).join("").trim();
        return inner ? `<li>${inner}</li>` : "";
      })
      .filter(Boolean)
      .join("");
    return items ? `<${tag.toLowerCase()}>${items}</${tag.toLowerCase()}>` : "";
  }
  if (tag === "BLOCKQUOTE") {
    const inner = Array.from(node.childNodes).map(sanitizeRichInline).join("").trim();
    return inner ? `<blockquote><p>${inner}</p></blockquote>` : "";
  }
  const inner = Array.from(node.childNodes).map(sanitizeRichInline).join("").trim();
  return inner ? `<p>${inner}</p>` : "";
}

const RICH_POUR_HEADING_ALIASES: Record<string, "title" | "mission" | "greeting" | "intro"> = {
  title: "title",
  newslettertitle: "title",
  issuetitle: "title",
  mission: "mission",
  ourmission: "mission",
  maromamission: "mission",
  missionstatement: "mission",
  greeting: "greeting",
  greetingfromceo: "greeting",
  welcomefromceo: "greeting",
  welcomelaura: "greeting",
  fromtheceo: "greeting",
  fromourceo: "greeting",
  letterfromtheceo: "greeting",
  ceoletter: "greeting",
  welcome: "greeting",
  intro: "intro",
  introduction: "intro"
};

function extractPourImageSrc(el: Element): string {
  const img =
    el.tagName.toUpperCase() === "IMG"
      ? el
      : el.querySelector("img");
  if (!img) return "";
  const candidates = [
    img.getAttribute("src") ?? "",
    img.getAttribute("data-src") ?? "",
    img.getAttribute("data-lazy-src") ?? "",
  ];
  for (const raw of candidates) {
    const src = raw.trim();
    if (!src || /^javascript:/i.test(src)) continue;
    if (/^(https?:|data:image\/|blob:)/i.test(src)) return src;
  }
  return "";
}

/** True for short headline-like lines; false for prose paragraphs (even if pasted as <h*> / bold). */
function looksLikeStoryTitle(raw: string): boolean {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return false;
  const unquoted = t.replace(/^[“”"']+|["'”’]+$/g, "").trim();
  if (unquoted.length < 3 || unquoted.length > 80) return false;
  if (/[.!?]\s/.test(unquoted)) return false;
  if (/[.!?]$/.test(unquoted)) return false;
  if (/:$/.test(unquoted)) return false;
  if ((unquoted.match(/[,;:]/g) ?? []).length >= 2) return false;
  const words = unquoted.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;
  return true;
}

const STORY_GRID_SUMMARY_LEN = 150;

/** Fixed-length blurb for TOP STORIES tiles so every card fills the same text block. */
function buildStoryGridSummary(
  story: { title?: string; excerpt?: string; body?: string },
  length = STORY_GRID_SUMMARY_LEN,
): string {
  const plain = `${story.excerpt || ""} ${story.body || ""}`
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const source = plain || (story.title || "").trim();
  if (!source) return "Read more in this month’s story…".slice(0, length);

  let summary = source;
  if (summary.length > length) {
    const slice = summary.slice(0, length - 1);
    const at = slice.lastIndexOf(" ");
    summary = `${(at > length * 0.55 ? slice.slice(0, at) : slice).trimEnd()}…`;
  } else if (summary.length < length - 1) {
    // Extend with following content already included; if still short, soft-pad with
    // a second pass from the title so short teasers still approach full length.
    const title = (story.title || "").replace(/\s+/g, " ").trim();
    if (title && !summary.toLowerCase().includes(title.toLowerCase().slice(0, 24))) {
      const extended = `${summary} ${title}`.replace(/\s+/g, " ").trim();
      if (extended.length <= length) summary = extended;
      else {
        const slice = extended.slice(0, length - 1);
        const at = slice.lastIndexOf(" ");
        summary = `${(at > length * 0.55 ? slice.slice(0, at) : slice).trimEnd()}…`;
      }
    }
    // Final equalize: if still short, truncate-style ellipsis only when we hit the cap;
    // CSS line-clamp + min-height keeps tile bottoms aligned regardless.
  }
  if (summary.length > length) {
    summary = `${summary.slice(0, length - 1).trimEnd()}…`;
  }
  return summary;
}

function applyRichTextPour(
  html: string,
  prev: StoriesState,
  options: { replaceStories: boolean }
): { next: StoriesState; summary: string } {
  const next: StoriesState = structuredClone(prev);
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta,head").forEach((n) => n.remove());

  const root = template.content;
  const blocks: {
    kind: "h" | "block" | "hr" | "image";
    level?: number;
    text?: string;
    html?: string;
    src?: string;
    node?: Element;
  }[] = [];

  const BLOCK_LIKE_TAGS = new Set([
    "P", "DIV", "UL", "OL", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "HR", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "ASIDE", "FIGURE", "PICTURE"
  ]);
  const containsBlockChild = (el: Element): boolean => {
    for (const child of Array.from(el.children)) {
      const t = child.tagName.toUpperCase();
      if (BLOCK_LIKE_TAGS.has(t)) return true;
      if (containsBlockChild(child)) return true;
    }
    return false;
  };
  // Returns true when a <p> is predominantly bold — used to detect story headlines
  // in pastes that use bold instead of <h> tags (Word, Google Docs, plain email).
  // Handles <strong>, <b>, and <span style="font-weight:700"> from real-world pastes.
  // Requires ≥75% of non-whitespace characters to be inside bold markup.
  // Keep this strict: long or multi-sentence bold paragraphs are body copy, not titles.
  const isEntirelyBold = (el: Element): boolean => {
    const text = (el.textContent ?? "").trim();
    if (!looksLikeStoryTitle(text)) return false;
    const isBoldEl = (node: Node): boolean => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      const e = node as HTMLElement;
      const tag = e.tagName.toUpperCase();
      if (tag === "STRONG" || tag === "B") return true;
      const fw = e.style?.fontWeight;
      return !!fw && (fw === "bold" || Number(fw) >= 600);
    };
    let boldChars = 0;
    const countBold = (node: Node) => {
      if (isBoldEl(node)) {
        boldChars += (node.textContent ?? "").replace(/\s/g, "").length;
        return; // don't descend — already counted all text inside
      }
      node.childNodes.forEach(countBold);
    };
    el.childNodes.forEach(countBold);
    const totalNonSpace = text.replace(/\s/g, "").length;
    return totalNonSpace > 0 && boldChars / totalNonSpace >= 0.75;
  };

  const pushImagesFrom = (el: Element) => {
    if (el.tagName.toUpperCase() === "IMG") {
      const src = extractPourImageSrc(el);
      if (src) blocks.push({ kind: "image", src });
      return;
    }
    el.querySelectorAll("img").forEach((img) => {
      const src = extractPourImageSrc(img);
      if (src) blocks.push({ kind: "image", src });
    });
  };

  let prevWasBlank = false;
  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
      prevWasBlank = false;
      const text = (el.textContent ?? "").trim();
      // Word/Docs/ChatGPT often paste body as <h*>; only keep real headline-shaped lines.
      if (looksLikeStoryTitle(text)) {
        blocks.push({ kind: "h", level: Number(tag.slice(1)), text, node: el });
      } else if (text) {
        pushImagesFrom(el);
        const out = blockNodeToHtml(el);
        if (out) blocks.push({ kind: "block", html: out, text });
      }
      return;
    }
    if (tag === "HR") {
      prevWasBlank = false;
      blocks.push({ kind: "hr" });
      return;
    }
    if (tag === "IMG" || tag === "FIGURE" || tag === "PICTURE") {
      prevWasBlank = false;
      pushImagesFrom(el);
      return;
    }
    if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "MAIN" || tag === "HEADER" || tag === "FOOTER" || tag === "ASIDE") {
      if (containsBlockChild(el)) {
        el.childNodes.forEach(walk);
        return;
      }
      pushImagesFrom(el);
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("img,figure,picture").forEach((n) => n.remove());
      const out = blockNodeToHtml(clone);
      if (out) blocks.push({ kind: "block", html: out, text: (clone.textContent ?? "").trim() });
      return;
    }
    if (tag === "P" || tag === "UL" || tag === "OL" || tag === "BLOCKQUOTE") {
      const text = (el.textContent ?? "").trim();
      // Bold-only paragraph on its own line → treat as a story headline
      if (tag === "P" && isEntirelyBold(el)) {
        prevWasBlank = false;
        blocks.push({ kind: "h", level: 2, text, node: el });
        return;
      }
      // Empty paragraph → remember so the NEXT paragraph can be promoted
      if (tag === "P" && !text) {
        // Still capture any images in "empty" wrappers
        if (el.querySelector("img")) {
          prevWasBlank = false;
          pushImagesFrom(el);
          return;
        }
        prevWasBlank = true;
        return;
      }
      // Short non-bold paragraph preceded by a blank → story headline
      if (tag === "P" && prevWasBlank && looksLikeStoryTitle(text)) {
        prevWasBlank = false;
        blocks.push({ kind: "h", level: 2, text, node: el });
        return;
      }
      prevWasBlank = false;
      pushImagesFrom(el);
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("img,figure,picture").forEach((n) => n.remove());
      const out = blockNodeToHtml(clone);
      const cleanedText = (clone.textContent ?? "").trim();
      if (out && cleanedText) blocks.push({ kind: "block", html: out, text: cleanedText });
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);

  // Plain-text fallback: if the document has no headings at all, treat the
  // first short text line as a story heading and the rest as its body. This
  // catches rich-pour pastes from plain-text sources (Notes, email body, etc.)
  // where there is no <h1>/<h2> markup.
  const hasAnyHeading = blocks.some((b) => b.kind === "h");
  if (!hasAnyHeading) {
    const firstBlockIdx = blocks.findIndex((b) => b.kind === "block" && (b.text ?? "").trim().length > 0);
    if (firstBlockIdx >= 0) {
      const candidate = blocks[firstBlockIdx];
      const candidateText = (candidate.text ?? "").trim();
      if (looksLikeStoryTitle(candidateText) && blocks.length > firstBlockIdx + 1) {
        blocks[firstBlockIdx] = { kind: "h", level: 2, text: candidateText };
      }
    }
  }

  // Promote remaining title-shaped plain lines that sit after a blank / prior story
  // break when the paste had no heading markup (common with Notes / plain email).
  if (!hasAnyHeading) {
    let prevBlankOrBreak = true;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "hr") {
        prevBlankOrBreak = true;
        continue;
      }
      if (b.kind !== "block") {
        prevBlankOrBreak = false;
        continue;
      }
      const t = (b.text ?? "").trim();
      if (prevBlankOrBreak && looksLikeStoryTitle(t)) {
        blocks[i] = { kind: "h", level: 2, text: t };
        prevBlankOrBreak = false;
        continue;
      }
      prevBlankOrBreak = false;
    }
  }

  let topApplied = 0;
  let storyApplied = 0;
  let imagesApplied = 0;
  let storiesAppendedOrReplaced: StoryRecord[] = [];
  if (options.replaceStories) storiesAppendedOrReplaced = [];

  let firstTitleSet = false;
  let currentSection: { kind: "title" | "mission" | "greeting" | "intro" | "story"; story?: StoryRecord } | null = null;
  let pendingImageSrc = "";

  const attachImageToStory = (story: StoryRecord, src: string) => {
    if (!src) return;
    if (!story.imageUrl) {
      story.imageUrl = src;
      story.images = [src];
      imagesApplied += 1;
      return;
    }
    const images = Array.isArray(story.images) ? [...story.images] : story.imageUrl ? [story.imageUrl] : [];
    if (!images.includes(src)) {
      images.push(src);
      story.images = images;
      imagesApplied += 1;
    }
  };

  const flushStory = () => {
    if (currentSection?.kind === "story" && currentSection.story && (currentSection.story.title || currentSection.story.excerpt)) {
      if (pendingImageSrc && !currentSection.story.imageUrl) {
        attachImageToStory(currentSection.story, pendingImageSrc);
        pendingImageSrc = "";
      }
      storiesAppendedOrReplaced.push(currentSection.story);
    }
  };

  for (const block of blocks) {
    if (block.kind === "hr") {
      flushStory();
      currentSection = null;
      continue;
    }
    if (block.kind === "image") {
      const src = (block.src ?? "").trim();
      if (!src) continue;
      if (currentSection?.kind === "story" && currentSection.story) {
        attachImageToStory(currentSection.story, src);
      } else {
        pendingImageSrc = src;
      }
      continue;
    }
    if (block.kind === "h") {
      flushStory();
      const aliasKey = normalizePourKey(block.text ?? "");
      const role = RICH_POUR_HEADING_ALIASES[aliasKey];
      // Only auto-promote the first H1 to the newsletter issue title when one
      // isn't already set; otherwise treat it like any other story heading.
      const existingTitle = (prev.newsletterTitle ?? "").trim();
      const titleAlreadySet = existingTitle.length > 0 && existingTitle.toLowerCase() !== "newsletter";
      if (block.level === 1 && !firstTitleSet && !titleAlreadySet && !role) {
        next.newsletterTitle = block.text ?? next.newsletterTitle;
        firstTitleSet = true;
        topApplied += 1;
        currentSection = { kind: "title" };
        continue;
      }
      if (role === "title") {
        next.newsletterTitle = block.text ?? next.newsletterTitle;
        firstTitleSet = true;
        topApplied += 1;
        currentSection = { kind: "title" };
        continue;
      }
      if (role === "mission") {
        next.newsletterMission = "";
        next.newsletterMissionHtml = "";
        currentSection = { kind: "mission" };
        continue;
      }
      if (role === "greeting") {
        next.newsletterWelcomeLaura = "";
        next.newsletterWelcomeLauraHtml = "";
        currentSection = { kind: "greeting" };
        continue;
      }
      if (role === "intro") {
        next.newsletterIntro = "";
        currentSection = { kind: "intro" };
        continue;
      }
      const now = new Date().toISOString();
      const story: StoryRecord = {
        id: crypto.randomUUID(),
        kind: "story",
        slug: "",
        title: block.text ?? "",
        excerpt: "",
        body: "",
        imageUrl: "",
        sourceUrl: "",
        source: "manual",
        ctaLabel: "Read more",
        ctaUrl: "",
        publishedAt: now,
        updatedAt: now,
        featured: false,
        imageFrame: normalizeStoryImageFrame(undefined),
      };
      if (pendingImageSrc) {
        attachImageToStory(story, pendingImageSrc);
        pendingImageSrc = "";
      }
      currentSection = { kind: "story", story };
      continue;
    }
    if (block.kind === "block") {
      const html = block.html ?? "";
      const text = (block.text ?? "").trim();
      if (!html || !text) continue;
      if (!currentSection) {
        if (!firstTitleSet) {
          next.newsletterIntro = text;
          topApplied += 1;
          currentSection = { kind: "intro" };
          continue;
        }
        currentSection = { kind: "intro" };
      }
      if (currentSection.kind === "title") {
        currentSection = { kind: "intro" };
      }
      if (currentSection.kind === "mission") {
        next.newsletterMissionHtml = next.newsletterMissionHtml ? `${next.newsletterMissionHtml}${html}` : html;
        next.newsletterMission = next.newsletterMission ? `${next.newsletterMission}\n\n${text}` : text;
        topApplied += 1;
        continue;
      }
      if (currentSection.kind === "greeting") {
        next.newsletterWelcomeLauraHtml = next.newsletterWelcomeLauraHtml ? `${next.newsletterWelcomeLauraHtml}${html}` : html;
        next.newsletterWelcomeLaura = next.newsletterWelcomeLaura ? `${next.newsletterWelcomeLaura}\n\n${text}` : text;
        topApplied += 1;
        continue;
      }
      if (currentSection.kind === "intro") {
        next.newsletterIntro = next.newsletterIntro ? `${next.newsletterIntro}\n\n${text}` : text;
        topApplied += 1;
        continue;
      }
      if (currentSection.kind === "story" && currentSection.story) {
        const s = currentSection.story;
        if (!s.excerpt) {
          s.excerpt = text;
        }
        s.body = s.body ? `${s.body}${html}` : html;
        storyApplied += 1;
      }
    }
  }
  flushStory();

  // Heal false story breaks: Word/Docs/ChatGPT often paste body paragraphs as <h*>,
  // which would otherwise become one story per paragraph (headline-sized body text).
  {
    const healed: StoryRecord[] = [];
    for (const story of storiesAppendedOrReplaced) {
      const title = (story.title ?? "").trim();
      if (healed.length > 0 && title && !looksLikeStoryTitle(title)) {
        const prevStory = healed[healed.length - 1];
        const titleHtml = `<p>${escapeHtml(title)}</p>`;
        prevStory.body = `${prevStory.body || ""}${titleHtml}${story.body || ""}`;
        if (!prevStory.excerpt) prevStory.excerpt = title;
        if (story.imageUrl) attachImageToStory(prevStory, story.imageUrl);
        if (Array.isArray(story.images)) {
          for (const src of story.images) attachImageToStory(prevStory, src);
        }
        continue;
      }
      healed.push(story);
    }
    storiesAppendedOrReplaced = healed;
  }

  if (options.replaceStories) {
    next.stories = storiesAppendedOrReplaced;
  } else {
    next.stories = [...next.stories, ...storiesAppendedOrReplaced];
  }

  const newCount = storiesAppendedOrReplaced.length;
  return {
    next,
    summary: `Rich text pour: ${topApplied} header field(s), ${newCount} story section(s)${imagesApplied ? `, ${imagesApplied} image(s)` : ""} ${options.replaceStories ? "(replaced existing)" : "(appended)"}.`
  };
}

type ToolDrawer = "settings" | "tools" | "delivery" | "spacing" | null;

type Props = {
  initialState: StoriesState;
  editMode: boolean;
  isAdmin?: boolean;
  /** Admin or newsletter-editor role — unlocks canvas editing when editMode is on. */
  canEditNewsletter?: boolean;
};

type EditableTarget =
  | "issueHeading"
  | "missionHeading"
  | "missionBody"
  | "greetingHeading"
  | "greetingBody"
  | "topImage"
  | "logoImage"
  | "portraitImage"
  | "heroImage"
  | "executiveBriefTitle"
  | "executiveBriefBody"
  | "executiveBriefLink"
  | "executiveBriefSection"
  | "executiveBriefImage0"
  | "executiveBriefImage1"
  | "executiveBriefImage2"
  | "storyTitle"
  | "storyExcerpt"
  | "storyBody"
  | "storyMeta"
  | "storyCta";

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

function snapshotToStoryRecord(prev: StoryRecord, snap: NewsletterStoryBlock["snapshot"]): StoryRecord {
  const imgs = (snap.images ?? []).filter((s) => s.trim());
  const imageUrl = imgs[0] ?? prev.imageUrl ?? "";
  return {
    ...prev,
    title: snap.title,
    excerpt: snap.excerpt,
    body: snap.body,
    images: imgs.length > 0 ? imgs : undefined,
    imageUrl,
    sourceUrl: snap.sourceUrl,
    source: snap.source,
    ctaLabel: snap.ctaLabel?.trim() ? snap.ctaLabel.trim() : "Read more",
    ctaUrl: snap.ctaUrl,
    slug: snap.slug?.trim() ? snap.slug.trim() : prev.slug,
    publishedAt: snap.publishedAt,
    updatedAt: new Date().toISOString(),
    imageFrame: snap.imageFrame ?? prev.imageFrame
  };
}

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

const emptyTextBlock = (): StoryRecord => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    kind: "text",
    slug: `text-${id}`,
    title: "",
    excerpt: "",
    body: "<p>Click to edit this text block. Bold, italic and links are preserved when you paste from Word, Google Docs or the web.</p>",
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

const briefLinkForStory = (story: StoryRecord): string => {
  if (story.slug?.trim()) return `/blog/${story.slug.trim()}`;
  return `#story-${story.id}`;
};

const briefImageForStory = (story: StoryRecord): string => {
  if (Array.isArray(story.images) && story.images.length > 0) {
    const first = story.images.find((s) => s && s.trim());
    if (first) return first;
  }
  return story.imageUrl?.trim() ?? "";
};

const textToHtml = (value: string) =>
  value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");

function clampStoryImageBlockOffset(value: number | undefined, axis: "x" | "y"): number {
  const fallback = 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const limit = axis === "x" ? 180 : 120;
  return Math.max(-limit, Math.min(limit, Math.round(value)));
}

const sanitizeRichHtml = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    if (el.hasAttribute("color")) el.removeAttribute("color");
    if (el.style?.color) el.style.removeProperty("color");
    if (el.style?.backgroundColor) el.style.removeProperty("background-color");
    if (el.style?.webkitTextFillColor) el.style.removeProperty("-webkit-text-fill-color");
    const styleAttr = el.getAttribute("style");
    if (styleAttr?.trim()) {
      const next = styleAttr
        .split(";")
        .map((part) => part.trim())
        .filter((part) => {
          const lower = part.toLowerCase();
          return lower
            && !lower.startsWith("color:")
            && !lower.startsWith("background:")
            && !lower.startsWith("background-color:")
            && !lower.startsWith("-webkit-text-fill-color:");
        })
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

const sanitizeRichPourHtml = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  template.content.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("dir");
    el.removeAttribute("lang");
    el.removeAttribute("face");
    el.removeAttribute("color");
    if (el.tagName.toUpperCase() !== "A") {
      el.removeAttribute("target");
      el.removeAttribute("rel");
    }
    el.removeAttribute("style");
  });
  return template.innerHTML;
};

const normalizeRichPourEditorContent = (editor: HTMLDivElement) => {
  editor.style.color = "#ecf5f2";
  editor.style.backgroundColor = "rgba(12, 18, 25, 0.65)";
  editor.style.webkitTextFillColor = "#ecf5f2";
  editor.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("style");
    el.removeAttribute("color");
    el.style.color = "#ecf5f2";
    el.style.backgroundColor = "transparent";
    el.style.webkitTextFillColor = "#ecf5f2";
  });
};

type RichTextEditorProps = {
  value: string;
  placeholder: string;
  onChange: (html: string, text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: () => void;
};

const rgbStringToHex = (rgb: string): string => {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "";
  const [r, g, b] = m.slice(0, 3).map((n) => Number(n));
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
};

const BREAKOUT_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Inherit", value: "" },
  { label: "Serif (Cormorant)", value: "var(--font-serif), 'Cormorant Garamond', Georgia, serif" },
  { label: "Sans (Montserrat)", value: "var(--font-sans), Montserrat, Helvetica, sans-serif" },
  { label: "Raleway", value: "var(--font-raleway), Raleway, sans-serif" },
  { label: "Josefin Sans", value: "var(--font-josefin), 'Josefin Sans', sans-serif" }
];

function RichTextEditor({ value, placeholder, onChange, className, style, onFocus }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastCommitRef = useRef<string>("");
  const [activeBreakoutId, setActiveBreakoutId] = useState<string | null>(null);
  const [selectionTick, setSelectionTick] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value === lastCommitRef.current) return;
    if (editor.innerHTML === value) return;
    if (document.activeElement === editor) return;
    editor.innerHTML = value;
    lastCommitRef.current = value;
  }, [value]);

  const findBreakoutAncestor = (node: Node | null): HTMLDivElement | null => {
    let n: Node | null = node;
    while (n && n !== editorRef.current) {
      if (n.nodeType === 1 && (n as HTMLElement).classList.contains("newsletter-breakout")) {
        return n as HTMLDivElement;
      }
      n = n.parentNode;
    }
    return null;
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      const sel = window.getSelection();
      const editor = editorRef.current;
      if (!sel || sel.rangeCount === 0 || !editor) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.startContainer)) return;
      const box = findBreakoutAncestor(range.startContainer);
      const id = box?.getAttribute("data-breakout-id") ?? null;
      setActiveBreakoutId(id);
      setSelectionTick((t) => t + 1);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const commit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeRichHtml(editor.innerHTML);
    lastCommitRef.current = html;
    onChange(html, editor.innerText);
  };

  const handleCommand = (command: "bold" | "italic" | "removeFormat") => {
    editorRef.current?.focus();
    document.execCommand(command);
    commit();
  };

  const ensureBreakoutId = (el: HTMLElement): string => {
    let id = el.getAttribute("data-breakout-id");
    if (!id) {
      id = `bk-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
      el.setAttribute("data-breakout-id", id);
    }
    return id;
  };

  const styleBreakoutDefaults = (wrapper: HTMLElement) => {
    wrapper.style.display = "block";
    wrapper.style.padding = "14px 18px";
    wrapper.style.margin = "14px 0";
    wrapper.style.borderRadius = "12px";
    wrapper.style.background = "rgba(255, 255, 255, 0.06)";
    wrapper.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.22)";
    wrapper.style.border = "1px solid rgba(112, 201, 217, 0.30)";
  };

  const toggleBreakout = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const existing = findBreakoutAncestor(range.startContainer);
    if (existing) {
      const parent = existing.parentNode;
      if (parent) {
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        existing.remove();
      }
      setActiveBreakoutId(null);
      commit();
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "newsletter-breakout";
    styleBreakoutDefaults(wrapper);
    const id = ensureBreakoutId(wrapper);

    if (range.collapsed) {
      let blockNode: Node | null = range.startContainer;
      while (blockNode && blockNode !== editor) {
        if (blockNode.nodeType === 1) {
          const display = window.getComputedStyle(blockNode as Element).display;
          if (display === "block" || display === "list-item" || display === "flex" || display === "grid") break;
        }
        blockNode = blockNode.parentNode;
      }
      if (blockNode && blockNode !== editor) {
        const target = blockNode as HTMLElement;
        target.parentNode?.insertBefore(wrapper, target);
        wrapper.appendChild(target);
      } else {
        return;
      }
    } else {
      try {
        range.surroundContents(wrapper);
      } catch {
        const frag = range.extractContents();
        wrapper.appendChild(frag);
        range.insertNode(wrapper);
      }
    }

    setActiveBreakoutId(id);
    commit();
  };

  const getActiveBreakout = (): HTMLDivElement | null => {
    if (!activeBreakoutId || !editorRef.current) return null;
    return editorRef.current.querySelector<HTMLDivElement>(`[data-breakout-id="${activeBreakoutId}"]`);
  };

  const setBreakoutStyle = (prop: "fontSize" | "fontFamily" | "color", val: string) => {
    const box = getActiveBreakout();
    if (!box) return;
    box.style[prop] = val;
    commit();
    setSelectionTick((t) => t + 1);
  };

  const handleEditorChange = (element: HTMLDivElement) => {
    const html = sanitizeRichHtml(element.innerHTML);
    if (html !== element.innerHTML) {
      element.innerHTML = html;
    }
    lastCommitRef.current = html;
    onChange(html, element.innerText);
  };

  const activeBox = getActiveBreakout();
  void selectionTick;
  const activeFontSize = activeBox ? parseFloat(activeBox.style.fontSize) || 1 : 1;
  const activeFontFamily = activeBox?.style.fontFamily ?? "";
  const activeColor = activeBox?.style.color ? rgbStringToHex(activeBox.style.color) : "";

  return (
    <div className="newsletter-rich-editor-wrap">
      <div className="newsletter-rich-editor-toolbar" aria-label="Rich text controls">
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("bold")}>
          Bold
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("italic")}>
          Italic
        </button>
        <button
          type="button"
          className={`button ${activeBox ? "primary" : "secondary"}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleBreakout}
          title="Wrap the selection in a breakout box (drop shadow). Click again to remove."
        >
          {activeBox ? "✓ Breakout box" : "Breakout box"}
        </button>
        <button type="button" className="button secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand("removeFormat")}>
          Clear formatting
        </button>
      </div>
      {activeBox ? (
        <div className="newsletter-breakout-controls" aria-label="Breakout box controls">
          <label>
            Size ({activeFontSize.toFixed(2)}rem)
            <input
              type="range"
              min={0.7}
              max={2.5}
              step={0.05}
              value={activeFontSize}
              onChange={(e) => setBreakoutStyle("fontSize", `${e.target.value}rem`)}
            />
          </label>
          <label>
            Font
            <select value={activeFontFamily} onChange={(e) => setBreakoutStyle("fontFamily", e.target.value)}>
              {BREAKOUT_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color
            <span className="newsletter-text-color-row">
              <input
                type="color"
                value={activeColor || "#0d2730"}
                onChange={(e) => setBreakoutStyle("color", e.target.value)}
              />
              <button type="button" className="button secondary" onClick={() => setBreakoutStyle("color", "")} title="Reset to inherited color">
                Reset
              </button>
            </span>
          </label>
        </div>
      ) : null}
      <div
        ref={editorRef}
        className={className ? `newsletter-rich-editor ${className}` : "newsletter-rich-editor"}
        style={style}
        contentEditable
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onFocus={onFocus}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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
  id?: string;
};

function InlinePlainTextEditable({
  value,
  onChange,
  className,
  style,
  placeholder,
  as = "p",
  onFocus
}: {
  value: string;
  onChange: (text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  as?: "p" | "h2" | "h3";
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && document.activeElement !== ref.current) {
      ref.current.innerText = value;
    }
  }, [value]);

  const props = {
    ref: ref as React.RefObject<HTMLParagraphElement & HTMLHeadingElement>,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    onFocus,
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => e.stopPropagation(),
    onClick: (e: React.MouseEvent<HTMLElement>) => e.stopPropagation(),
    onInput: (e: React.FormEvent<HTMLElement>) => onChange(e.currentTarget.innerText),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
    }
  } as const;

  if (as === "h2") return <h2 {...props} />;
  if (as === "h3") return <h3 {...props} />;
  return <p {...props} />;
}

function SingleLineEditable({
  value,
  onChange,
  className,
  style,
  placeholder,
  onFocus,
  as = "h2",
  id
}: SingleLineEditableProps) {
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
    id,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    onFocus,
    onMouseDown: (e: React.MouseEvent<HTMLHeadingElement>) => e.stopPropagation(),
    onClick: (e: React.MouseEvent<HTMLHeadingElement>) => e.stopPropagation(),
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

function IssueTitleEditable({
  value,
  issueDate,
  showDate = true,
  onChange,
  className,
  style,
  placeholder,
  onFocus,
  id,
  editable = true
}: {
  value: string;
  issueDate: string;
  showDate?: boolean;
  onChange: (text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onFocus?: () => void;
  id?: string;
  editable?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && document.activeElement !== ref.current) {
      ref.current.innerText = value;
    }
  }, [value]);

  const handleInput = (el: HTMLSpanElement) => {
    onChange(el.innerText.replace(/\n/g, " "));
  };

  return (
    <h1 id={id} className={className} style={style} onClick={editable ? onFocus : undefined}>
      {editable ? (
        <span
          ref={ref}
          className="newsletter-issue-title-text"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onFocus={onFocus}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ref.current?.blur();
            }
          }}
          onInput={(e) => handleInput(e.currentTarget)}
        />
      ) : (
        <span className="newsletter-issue-title-text">{value}</span>
      )}
      {showDate && (
        <span
          className="newsletter-issue-date-text"
          onClick={editable ? (e) => { e.stopPropagation(); onFocus?.(); } : undefined}
        > | {issueDate}</span>
      )}
    </h1>
  );
}

const CANVAS_LS_KEY = "maroma-newsletter-canvas-draft";
const CANVAS_LS_SAVED_KEY = "maroma-newsletter-canvas-saved-at";

function withCanvasStoryGaps(s: StoriesState): StoriesState {
  const reconciled = reconcileNewsletterCanvasState(s);
  const existing = parseStorySpacingGaps(reconciled.newsletterCanvas?.storySpacingGaps);
  if (existing) {
    return {
      ...reconciled,
      newsletterCanvas: {
        ...(reconciled.newsletterCanvas ?? { enabled: false, elements: [] }),
        storySpacingGaps: existing,
      },
    };
  }
  return {
    ...reconciled,
    newsletterCanvas: {
      ...(reconciled.newsletterCanvas ?? { enabled: false, elements: [] }),
      storySpacingGaps:
        typeof window !== "undefined" ? loadStorySpacingGaps() : { ...DEFAULT_STORY_SPACING_GAPS },
    },
  };
}

function syncCanvasMastheadAssets(state: StoriesState): StoriesState {
  const elements = state.newsletterCanvas?.elements ?? [];
  if (elements.length === 0) return state;
  const findImageSrc = (id: string): string | null => {
    const el = elements.find((item) => item.kind === "image" && item.id === id);
    return el && "src" in el && typeof el.src === "string" && el.src.trim() ? el.src.trim() : null;
  };

  const topSrc = findImageSrc("migrated-top");
  const logoSrc = findImageSrc("migrated-logo");
  const portraitSrc = findImageSrc("migrated-portrait");
  const heroSrc = findImageSrc("migrated-hero");

  if (!topSrc && !logoSrc && !portraitSrc && !heroSrc) return state;

  return {
    ...state,
    newsletterTopImageUrl: topSrc ?? state.newsletterTopImageUrl,
    newsletterLogoUrl: logoSrc ?? state.newsletterLogoUrl,
    newsletterPortraitUrl: portraitSrc ?? state.newsletterPortraitUrl,
    newsletterHeroImageUrl: heroSrc ?? state.newsletterHeroImageUrl,
  };
}

export default function NewsletterPageClient({
  initialState,
  editMode,
  isAdmin = false,
  canEditNewsletter: canEditNewsletterProp = false,
}: Props) {
  // Always-current ref so saveStories never captures a stale closure
  const stateRef = useRef<StoriesState>(initialState);
  const canvasRef = useRef<NewsletterCanvasHandle>(null);
  const newsletterShellRef = useRef<HTMLElement>(null);
  const { isAdminUser, canEditNewsletter: canEditNewsletterSession, sessionReady } = useAdminSession();
  const newsletterEditor = Boolean(
    sessionReady ? canEditNewsletterSession : canEditNewsletterProp || isAdmin,
  );
  /** Live session wins — never show editor chrome after sign-out with a stale SSR edit flag. */
  const canEdit = Boolean(editMode && sessionReady && newsletterEditor);
  const showAdminEntry = newsletterEditor;

  const [state, setState] = useState<StoriesState>(() => {
    // On first render in the browser, check if localStorage has a newer canvas draft
    if (typeof window === "undefined") return withCanvasStoryGaps(initialState);
    try {
      const raw = localStorage.getItem(CANVAS_LS_KEY);
      if (!raw) return withCanvasStoryGaps(initialState);
      const draft = JSON.parse(raw) as { canvas: import("../../lib/story-types").NewsletterCanvas; savedAt: number };
      const serverHasCanvas = initialState.newsletterCanvas?.enabled && (initialState.newsletterCanvas?.elements?.length ?? 0) > 0;
      const draftHasCanvas = draft.canvas?.enabled && (draft.canvas?.elements?.length ?? 0) > 0;
      // Use draft if: server has no canvas, or draft was saved after the last confirmed API save
      const lastApiSave = Number(localStorage.getItem(CANVAS_LS_SAVED_KEY) ?? 0);
      if (draftHasCanvas && preferServerCanvasOverLocalDraft(initialState.newsletterCanvas, draft.canvas)) {
        return withCanvasStoryGaps(initialState);
      }
      if (draftHasCanvas && (!serverHasCanvas || draft.savedAt > lastApiSave)) {
        return withCanvasStoryGaps({ ...initialState, newsletterCanvas: draft.canvas });
      }
    } catch { /* ignore */ }
    return withCanvasStoryGaps(initialState);
  });

  // Browser drafts hydrate after the server render. Run the structural repair
  // once on the mounted draft so missing story image frames are restored too.
  useEffect(() => {
    setState((current) => withCanvasStoryGaps(current));
  }, []);

  // Size the fixed side controls from the newsletter's real painted gutters.
  // This stays accurate with browser zoom, split-screen windows and scrollbars.
  useLayoutEffect(() => {
    if (!canEdit) return;
    const shell = newsletterShellRef.current;
    if (!shell) return;
    const updateGutter = () => {
      const rect = shell.getBoundingClientRect();
      const available = Math.max(36, Math.floor(Math.min(rect.left, window.innerWidth - rect.right) - 6));
      document.documentElement.style.setProperty("--newsletter-editor-side-gutter", `${available}px`);
    };
    updateGutter();
    const observer = new ResizeObserver(updateGutter);
    observer.observe(shell);
    window.addEventListener("resize", updateGutter);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateGutter);
      document.documentElement.style.removeProperty("--newsletter-editor-side-gutter");
    };
  }, [canEdit]);

  const storyGaps =
    state.newsletterCanvas?.storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS;

  const setStoryGaps = useCallback((gaps: StorySpacingGaps) => {
    saveStorySpacingGaps(gaps);
    setState((prev) => ({
      ...prev,
      newsletterCanvas: {
        ...(prev.newsletterCanvas ?? { enabled: false, elements: [] }),
        storySpacingGaps: gaps,
      },
    }));
  }, []);

  // Keep stateRef in sync on every render
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CANVAS_LS_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { canvas?: import("../../lib/story-types").NewsletterCanvas };
        if (preferServerCanvasOverLocalDraft(initialState.newsletterCanvas, draft.canvas)) {
          localStorage.removeItem(CANVAS_LS_KEY);
          localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
        }
      }
    } catch {
      // ignore
    }
    if (!canEdit) return;
    setHasPreviousIssueBackup(hasPreviousNewsletterIssueBackup());
    void fetch("/api/newsletter/previous-issue")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { exists?: boolean } | null) => {
        if (data?.exists) setHasPreviousIssueBackup(true);
      })
      .catch(() => {
        // local backup still applies
      });
    void fetch("/api/newsletter/restore-archive")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { issues?: NewsletterArchiveSummary[] } | null) => {
        const issues = data?.issues ?? [];
        setArchiveIssues(issues);
        setRestoreArchiveSlug((current) => {
          if (current) return current;
          const july = issues.find((issue) => /july/i.test(issue.subject));
          return july?.slug || issues.find((issue) => issue.testOnly)?.slug || issues[0]?.slug || "";
        });
      })
      .catch(() => {
        // restore picker stays empty
      });
  }, [canEdit, initialState.newsletterCanvas]);

  // Auto-save canvas draft to localStorage whenever canvas changes (debounced)
  const canvasDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editMode || !state.newsletterCanvas?.enabled) return;
    if (canvasDraftTimer.current) clearTimeout(canvasDraftTimer.current);
    canvasDraftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(CANVAS_LS_KEY, JSON.stringify({
          canvas: state.newsletterCanvas,
          savedAt: Date.now(),
        }));
      } catch { /* quota exceeded — ignore */ }
    }, 1500);
  }, [state.newsletterCanvas, editMode]);

  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasPreviousIssueBackup, setHasPreviousIssueBackup] = useState(false);
  const [archiveIssues, setArchiveIssues] = useState<NewsletterArchiveSummary[]>([]);
  const [restoreArchiveSlug, setRestoreArchiveSlug] = useState("");
  const [selectedEditorTarget, setSelectedEditorTarget] = useState<EditableTarget | null>(null);
  const [selectedStoryEdit, setSelectedStoryEdit] = useState<{ storyId: string; field: StoryEditField } | null>(null);
  const [selectedLayoutDividerId, setSelectedLayoutDividerId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [addStoryDraft, setAddStoryDraft] = useState({
    title: "",
    body: "",
    excerpt: "",
    imageUrl: "",
    sourceUrl: "",
    ctaLabel: "Read more",
    ctaUrl: ""
  });
  const [activeLayoutSection, setActiveLayoutSection] = useState<NewsletterLayoutSectionId>("portraitHero");
  const [openDrawer, setOpenDrawer] = useState<ToolDrawer>(null);
  const [showGlobalControls, setShowGlobalControls] = useState(false);
  const [importUrls, setImportUrls] = useState("");
  const [webSearchQuery, setWebSearchQuery] = useState("Maroma Auroville");
  const [webSearchMax, setWebSearchMax] = useState(12);
  const [textPourStatus, setTextPourStatus] = useState("");
  const [richPourStatus, setRichPourStatus] = useState("");
  const [richPourReplace, setRichPourReplace] = useState(false);
  const richPourRef = useRef<HTMLDivElement | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("Maroma newsletter");
  const [testMailingList, setTestMailingList] = useState<string[]>([]);
  const [newTestEmail, setNewTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [campaignSent, setCampaignSent] = useState(false);

  const SENT_BUTTON_RESET_MS = 3000;

  useEffect(() => {
    if (!testSent) return;
    const timer = window.setTimeout(() => setTestSent(false), SENT_BUTTON_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [testSent]);

  useEffect(() => {
    if (!campaignSent) return;
    const timer = window.setTimeout(() => setCampaignSent(false), SENT_BUTTON_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [campaignSent]);

  useEffect(() => {
    setTestMailingList(loadTestMailingList());
  }, []);
  const [audienceInfo, setAudienceInfo] = useState<{
    activeSubscribers: number;
    totalSubscribers: number;
    selectedListId: string | null;
    selectedListName: string | null;
    mailingLists: NewsletterMailingListSummary[];
    campaigns: NewsletterCampaignSummary[];
    envHints: {
      postmarkConfigured: boolean;
      fromEmailConfigured: boolean;
      trackingSecretConfigured: boolean;
      siteUrlConfigured: boolean;
      fromAddress: string;
      messageStream: string;
      readyToSend: boolean;
    };
  } | null>(null);
  const [newListName, setNewListName] = useState("");
  const topImageUploadRef = useRef<HTMLInputElement | null>(null);
  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const portraitUploadRef = useRef<HTMLInputElement | null>(null);
  const heroUploadRef = useRef<HTMLInputElement | null>(null);
  const briefImage0UploadRef = useRef<HTMLInputElement | null>(null);
  const briefImage1UploadRef = useRef<HTMLInputElement | null>(null);
  const briefImage2UploadRef = useRef<HTMLInputElement | null>(null);
  const storyImageUploadRef = useRef<HTMLInputElement | null>(null);
  const textPourRef = useRef<HTMLInputElement | null>(null);
  const mailingListRef = useRef<HTMLInputElement | null>(null);
  const canTransformImages = canEdit;
  const isImageTarget = (target: EditableTarget) =>
    target === "topImage" ||
    target === "logoImage" ||
    target === "portraitImage" ||
    target === "heroImage" ||
    target === "executiveBriefImage0" ||
    target === "executiveBriefImage1" ||
    target === "executiveBriefImage2";

  const briefImageTargetIndex = (target: EditableTarget): number | null => {
    if (target === "executiveBriefImage0") return 0;
    if (target === "executiveBriefImage1") return 1;
    if (target === "executiveBriefImage2") return 2;
    return null;
  };

  const clearEditors = () => {
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedBlockId(null);
  };

  const commitNewsletterBlocks = (blocks: NewsletterBlock[]) => {
    setState((prev) => {
      let next: StoriesState = { ...prev, newsletterBlocks: blocks };
      for (const b of blocks) {
        if ("sync" in b && b.sync) next = applyBlockToLegacyState(next, b);
      }
      let { stories } = next;
      for (const b of blocks) {
        if (b.kind !== "story" || !b.storyId) continue;
        const prevStory = stories.find((s) => s.id === b.storyId);
        if (!prevStory || prevStory.kind === "divider" || prevStory.kind === "text") continue;
        stories = stories.map((s) => (s.id === b.storyId ? snapshotToStoryRecord(s, b.snapshot) : s));
      }
      const storyIdsInBlockOrder: string[] = [];
      for (const b of blocks) {
        if (b.kind !== "story" || !b.storyId) continue;
        if (!storyIdsInBlockOrder.includes(b.storyId)) storyIdsInBlockOrder.push(b.storyId);
      }
      if (storyIdsInBlockOrder.length > 0) {
        const byId = new Map(stories.map((s) => [s.id, s] as const));
        const front = storyIdsInBlockOrder.map((id) => byId.get(id)).filter((s): s is StoryRecord => !!s);
        const inBlocks = new Set(storyIdsInBlockOrder);
        const tail = stories.filter((s) => !inBlocks.has(s.id));
        stories = [...front, ...tail];
      }
      return { ...next, stories };
    });
  };
  const openAddStoryDialog = () => {
    setAddStoryDraft({
      title: "",
      body: "",
      excerpt: "",
      imageUrl: "",
      sourceUrl: "",
      ctaLabel: "Read more",
      ctaUrl: ""
    });
    setAddStoryOpen(true);
    setShowAddBlockMenu(false);
  };

  const closeAddStoryDialog = () => {
    setAddStoryOpen(false);
  };

  const submitAddStoryDialog = () => {
    const title = addStoryDraft.title.trim();
    const rawBody = addStoryDraft.body.trim();
    if (!title && !rawBody) {
      setAddStoryOpen(false);
      return;
    }
    const looksLikeHtml = /<\s*[a-z][\s\S]*?>/i.test(rawBody);
    const bodyHtml = looksLikeHtml
      ? rawBody
      : rawBody
          .split(/\n{2,}/)
          .map((para) => para.replace(/\n/g, " ").trim())
          .filter(Boolean)
          .map(
            (para) =>
              `<p>${para
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</p>`
          )
          .join("\n");
    const excerptInput = addStoryDraft.excerpt.trim();
    const derivedExcerpt = (() => {
      if (excerptInput) return excerptInput;
      const stripped = bodyHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!stripped) return "";
      if (stripped.length <= 200) return stripped;
      const cut = stripped.slice(0, 200);
      const lastSpace = cut.lastIndexOf(" ");
      return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    })();
    const sourceUrl = addStoryDraft.sourceUrl.trim();
    const story: StoryRecord = {
      ...emptyStory(),
      title,
      excerpt: derivedExcerpt,
      body: bodyHtml,
      imageUrl: addStoryDraft.imageUrl.trim(),
      imageFrame: normalizeStoryImageFrame(undefined),
      sourceUrl,
      ctaLabel: addStoryDraft.ctaLabel.trim() || "Read more",
      ctaUrl: addStoryDraft.ctaUrl.trim() || sourceUrl
    };
    if (story.imageUrl) {
      story.images = [story.imageUrl];
    }
    const block = storyToBlock(story);
    setState((prev) => ({
      ...prev,
      stories: [...prev.stories, story],
      newsletterBlocks: [...(prev.newsletterBlocks ?? []), block]
    }));
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedBlockId(block.id);
    setStatus("Story added. Click any field to refine.");
    setAddStoryOpen(false);
  };

  const addNewsletterBlock = (kind: NewsletterBlockKind) => {
    if (kind === "story") {
      const story = emptyStory();
      const block = storyToBlock(story);
      setState((prev) => ({
        ...prev,
        stories: [...prev.stories, story],
        newsletterBlocks: [...(prev.newsletterBlocks ?? []), block]
      }));
      setSelectedEditorTarget(null);
      setSelectedStoryEdit(null);
      setSelectedLayoutDividerId(null);
      setSelectedBlockId(block.id);
      setShowAddBlockMenu(false);
      setStatus("Added story block. Click to edit.");
      return;
    }
    const block = createBlock(kind);
    setState((prev) => ({ ...prev, newsletterBlocks: [...(prev.newsletterBlocks ?? []), block] }));
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedBlockId(block.id);
    setShowAddBlockMenu(false);
    setStatus(`Added ${kind} block. Click to edit.`);
  };
  const updateNewsletterBlock = (block: NewsletterBlock) => {
    setState((prev) => {
      const blocks = (prev.newsletterBlocks ?? []).map((b) => (b.id === block.id ? block : b));
      let next: StoriesState = { ...prev, newsletterBlocks: blocks };
      if ("sync" in block && block.sync) next = applyBlockToLegacyState(next, block);
      if (block.kind === "story" && block.storyId) {
        const prevStory = next.stories.find((s) => s.id === block.storyId);
        if (prevStory && prevStory.kind !== "divider" && prevStory.kind !== "text") {
          next = {
            ...next,
            stories: next.stories.map((s) =>
              s.id === block.storyId ? snapshotToStoryRecord(s, block.snapshot) : s
            )
          };
        }
      }
      return next;
    });
  };
  const deleteNewsletterBlock = (id: string) => {
    setState((prev) => {
      const block = (prev.newsletterBlocks ?? []).find((b) => b.id === id);
      let stories = prev.stories;
      if (block?.kind === "story" && block.storyId) {
        stories = stories.filter((s) => s.id !== block.storyId);
      }
      return {
        ...prev,
        stories,
        newsletterBlocks: (prev.newsletterBlocks ?? []).filter((b) => b.id !== id)
      };
    });
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const targetToLayoutSection = (target: EditableTarget): NewsletterLayoutSectionId | null => {
    switch (target) {
      case "logoImage":
        return "logo";
      case "topImage":
        return "topImage";
      case "portraitImage":
      case "heroImage":
        return "portraitHero";
      case "issueHeading":
        return "issueHeading";
      case "missionHeading":
      case "missionBody":
        return "mission";
      case "greetingHeading":
      case "greetingBody":
        return "greeting";
      case "executiveBriefTitle":
      case "executiveBriefBody":
      case "executiveBriefLink":
      case "executiveBriefSection":
      case "executiveBriefImage0":
      case "executiveBriefImage1":
      case "executiveBriefImage2":
      case "storyTitle":
      case "storyExcerpt":
      case "storyBody":
      case "storyMeta":
      case "storyCta":
        return "stories";
    }
  };

  const selectBlock = (target: EditableTarget) => {
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedEditorTarget(target);
    const sec = targetToLayoutSection(target);
    if (sec) setActiveLayoutSection(sec);
  };

  const selectStoryField = (storyId: string, field: StoryEditField) => {
    setSelectedEditorTarget(null);
    setSelectedLayoutDividerId(null);
    setSelectedStoryEdit({ storyId, field });
    setActiveLayoutSection("stories");
  };

  const layoutSectionLabels: Record<NewsletterLayoutSectionId, string> = {
    logo: "Logo",
    topImage: "Top banner",
    portraitHero: "Portrait & hero",
    issueHeading: "Issue title",
    mission: "Mission",
    greeting: "Greeting",
    stories: "Stories"
  };

  const storyFrameCanvasHeight = (frame?: StoryImageFrame | null, width = 660): number => {
    const f = normalizeStoryImageFrame(frame);
    const maxPx = f.maxHeightPx > 0 ? f.maxHeightPx : 360;
    const ar = f.aspectRatio.trim();
    if (!ar) return maxPx;
    const match = ar.match(/^\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*$/);
    if (!match) return maxPx;
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return maxPx;
    return Math.min(maxPx, Math.round((width * h) / w));
  };

  const insertLayoutDivider = (sectionId: NewsletterLayoutSectionId, placement: "before" | "after") => {
    const preset =
      state.newsletterLayoutDividerPreset ?? DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET;
    const newDivider: NewsletterLayoutDivider = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `divider-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
      sectionId,
      placement,
      offsetX: preset.offsetX,
      offsetY: preset.offsetY,
      marginTop: preset.marginTop,
      marginBottom: preset.marginBottom,
      thickness: preset.thickness,
      color: preset.color,
      widthPercent: preset.widthPercent,
      lineStyle: preset.lineStyle
    };
    setState((prev) => ({
      ...prev,
      newsletterLayoutDividers: [...(prev.newsletterLayoutDividers ?? []), newDivider]
    }));
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(newDivider.id);
    setStatus(`Decorative line added ${placement} ${layoutSectionLabels[sectionId]}.`);
  };

  const saveLayoutDividerPreset = (divider: NewsletterLayoutDivider) => {
    const preset: NewsletterLayoutDividerPreset = {
      offsetX: divider.offsetX,
      offsetY: divider.offsetY,
      marginTop: divider.marginTop,
      marginBottom: divider.marginBottom,
      thickness: divider.thickness,
      color: divider.color,
      widthPercent: divider.widthPercent,
      lineStyle: divider.lineStyle
    };
    setState((prev) => ({ ...prev, newsletterLayoutDividerPreset: preset }));
    setStatus("Default decorative line saved. Future inserts will use these settings.");
  };

  const resetLayoutDividerPreset = () => {
    setState((prev) => ({
      ...prev,
      newsletterLayoutDividerPreset: { ...DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET }
    }));
    setStatus("Default decorative line reset.");
  };

  const updateLayoutDivider = (id: string, patch: Partial<NewsletterLayoutDivider>) => {
    setState((prev) => ({
      ...prev,
      newsletterLayoutDividers: (prev.newsletterLayoutDividers ?? []).map((d) =>
        d.id === id ? { ...d, ...patch } : d
      )
    }));
  };

  const deleteLayoutDivider = (id: string) => {
    setState((prev) => ({
      ...prev,
      newsletterLayoutDividers: (prev.newsletterLayoutDividers ?? []).filter((d) => d.id !== id)
    }));
    setSelectedLayoutDividerId(null);
  };

  const isStoryFieldSelected = (storyId: string, field: StoryEditField) =>
    selectedStoryEdit?.storyId === storyId && selectedStoryEdit.field === field;

  const newsletterInk = useMemo(() => resolveNewsletterInkColor(state), [state]);
  const effectiveStoryTextColor = (() => {
    const explicit = state.newsletterStoryTextColor?.trim();
    if (explicit && !isLightInkColor(explicit)) return explicit;
    return newsletterInk;
  })();
  const storyTextStyle: React.CSSProperties = { color: effectiveStoryTextColor };

  const legacyInkColor = (key: keyof typeof state.newsletterElementStyles): string => {
    const stored = state.newsletterElementStyles[key].color?.trim();
    if (stored && !isLightInkColor(stored)) return stored;
    return newsletterInk;
  };

  const elementCssStyle = (key: keyof typeof state.newsletterElementStyles): React.CSSProperties => {
    const s = state.newsletterElementStyles[key];
    return {
      fontFamily: s.fontFamily,
      fontSize: `${s.fontSizeRem}rem`,
      textAlign: s.textAlign,
      fontWeight: s.fontWeight,
      color: s.color || effectiveStoryTextColor || undefined,
      transform: `translate(${s.offsetX ?? 0}px, ${s.offsetY ?? 0}px)`
    };
  };
  const flowOffsetStyle = (offsetX?: number, offsetY?: number): React.CSSProperties => ({
    transform: `translateX(${offsetX ?? 0}px)`,
    marginTop: offsetY ?? 0
  });
  const flowSectionStyle = (offsetX?: number, offsetY?: number, color?: string): React.CSSProperties => ({
    transform: `translateX(${offsetX ?? 0}px)`,
    marginTop: Math.max(0, offsetY ?? 0),
    ...(color ? { color } : {})
  });
  const storyTitleCss = elementCssStyle("storyTitle");
  const storyExcerptCss = elementCssStyle("storyExcerpt");
  const storyBodyCss = elementCssStyle("storyBody");
  const storyMetaCss = elementCssStyle("storyMeta");

  /** Layer the global element style with per-story offsets so each story can be moved independently. */
  const storyFieldStyle = (
    base: React.CSSProperties,
    story: StoryRecord,
    field: "title" | "excerpt" | "body" | "meta" | "cta"
  ): React.CSSProperties => {
    const globalKey = (
      field === "title"
        ? "storyTitle"
        : field === "excerpt"
          ? "storyExcerpt"
          : field === "body"
            ? "storyBody"
            : field === "meta"
              ? "storyMeta"
              : "storyCta"
    ) as keyof typeof state.newsletterElementStyles;
    const g = state.newsletterElementStyles[globalKey];
    const xKey = `${field}OffsetX` as keyof StoryRecord;
    const yKey = `${field}OffsetY` as keyof StoryRecord;
    const px = (story as Record<string, unknown>)[xKey];
    const py = (story as Record<string, unknown>)[yKey];
    const totalX = (g.offsetX ?? 0) + (typeof px === "number" ? px : 0);
    const totalY = (g.offsetY ?? 0) + (typeof py === "number" ? py : 0);
    return { ...base, transform: `translate(${totalX}px, ${totalY}px)` };
  };

  const featured = canEdit ? state.stories : state.stories.slice(0, 6);
  const modularLayout = (state.newsletterBlocksMigrationVersion ?? 0) >= 1;

  // The legacy chrome already renders header assets, issue title, mission,
  // greeting and the story list. Hide any block that's a duplicate of those so
  // we don't double up after a one-time auto-migration.
  const storyIdsInLegacy = useMemo(
    () => new Set(state.stories.map((s) => s.id)),
    [state.stories]
  );
  const legacyHeaderImageUrls = useMemo(() => {
    const u = new Set<string>();
    const add = (s: string | undefined) => {
      const t = (s ?? "").trim();
      if (t) u.add(t);
    };
    add(state.newsletterLogoUrl);
    add(state.newsletterTopImageUrl);
    add(state.newsletterHeroImageUrl);
    add(state.newsletterPortraitUrl);
    return u;
  }, [
    state.newsletterLogoUrl,
    state.newsletterTopImageUrl,
    state.newsletterHeroImageUrl,
    state.newsletterPortraitUrl
  ]);
  const visibleNewsletterBlocks = useMemo(() => {
    const modular = (state.newsletterBlocksMigrationVersion ?? 0) >= 1;
    return (state.newsletterBlocks ?? []).filter((b) => {
      if ("sync" in b && b.sync) return false;
      if (b.kind === "image" && b.pairRole) return false;
      if (b.kind === "story") {
        if (!b.storyId?.trim()) return false;
        if (!modular && storyIdsInLegacy.has(b.storyId)) return false;
      }
      if (b.kind === "image" && (!("sync" in b) || !b.sync)) {
        const primary = b.images[0]?.trim();
        if (primary && legacyHeaderImageUrls.has(primary)) return false;
        if (b.images.length === 0 && !b.alt.trim() && !b.caption.trim()) return false;
      }
      return true;
    });
  }, [state.newsletterBlocks, state.newsletterBlocksMigrationVersion, storyIdsInLegacy, legacyHeaderImageUrls]);

  // One-time cleanup: drop orphan image blocks left over from earlier edits
  // (no images, no caption, no alt, no sync, no pair role). These otherwise
  // render as an empty teal-outlined "ghost" frame in the editor.
  const orphanCleanupRanRef = useRef(false);
  useEffect(() => {
    if (orphanCleanupRanRef.current) return;
    if (!Array.isArray(state.newsletterBlocks) || state.newsletterBlocks.length === 0) return;
    const next = state.newsletterBlocks.filter((b) => {
      if (b.kind !== "image") return true;
      if ("sync" in b && b.sync) return true;
      if (b.pairRole) return true;
      if (b.images.length > 0) return true;
      if (b.alt.trim() || b.caption.trim()) return true;
      return false;
    });
    if (next.length !== state.newsletterBlocks.length) {
      orphanCleanupRanRef.current = true;
      setState((prev) => ({ ...prev, newsletterBlocks: next }));
    } else {
      orphanCleanupRanRef.current = true;
    }
  }, [state.newsletterBlocks]);

  useEffect(() => {
    if (!selectedBlockId) return;
    if (!visibleNewsletterBlocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId, visibleNewsletterBlocks]);
  const issueDate = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
    []
  );

  const briefStoryCandidates = useMemo(
    () => state.stories.filter((s) => !s.kind || s.kind === "story"),
    [state.stories]
  );
  const briefSlotIds: string[] = useMemo(() => {
    const raw = state.executiveBriefStoryIds ?? ["", "", ""];
    const out: string[] = [];
    for (let i = 0; i < 3; i++) out.push(typeof raw[i] === "string" ? raw[i] : "");
    return out;
  }, [state.executiveBriefStoryIds]);
  const resolveBriefStory = (slotIndex: number): StoryRecord | null => {
    const explicit = briefSlotIds[slotIndex];
    if (explicit) {
      const found = briefStoryCandidates.find((s) => s.id === explicit);
      if (found) return found;
    }
    const usedIds = new Set(
      briefSlotIds
        .map((id, idx) => (idx !== slotIndex && id ? id : ""))
        .filter(Boolean)
    );
    let cursor = 0;
    for (const story of briefStoryCandidates) {
      if (usedIds.has(story.id)) continue;
      if (cursor === slotIndex) return story;
      cursor += 1;
    }
    return null;
  };
  const setBriefStorySlot = (slotIndex: number, storyId: string) => {
    setState((prev) => {
      const ids = (prev.executiveBriefStoryIds ?? ["", "", ""]).slice(0, 3);
      while (ids.length < 3) ids.push("");
      ids[slotIndex] = storyId;
      return { ...prev, executiveBriefStoryIds: ids };
    });
  };
  const briefSlots: { index: number; story: StoryRecord | null }[] = [0, 1, 2].map((i) => ({
    index: i,
    story: resolveBriefStory(i)
  }));
  const briefHasAnyStory = briefSlots.some((s) => s.story);
  const briefTitleValue = state.executiveBriefTitle ?? "Top Stories This Month";
  const showExecBrief = canEdit || (briefTitleValue.trim() && briefHasAnyStory);
  const topImageSrc = state.newsletterTopImageUrl.trim();
  const logoSrc = state.newsletterLogoUrl.trim() || "/maroma-logo.png";
  const heroSrc = state.newsletterHeroImageUrl.trim();
  const portraitSrc = state.newsletterPortraitUrl.trim();
  const showPortraitColumn = Boolean(portraitSrc || canEdit);
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
      target === "greetingBody" ||
      target === "executiveBriefTitle" ||
      target === "executiveBriefBody" ||
      target === "executiveBriefLink" ||
      target === "executiveBriefSection" ||
      target === "storyTitle" ||
      target === "storyExcerpt" ||
      target === "storyBody" ||
      target === "storyMeta" ||
      target === "storyCta"
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
    const briefIdx = briefImageTargetIndex(target);
    if (briefIdx !== null) {
      const list = state.executiveBriefImageTransforms ?? [];
      return list[briefIdx] ?? { x: 0, y: 0, zoom: 1, borderRadius: 12, zIndex: 0 };
    }
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
    patch: Partial<{ x: number; y: number; zoom: number; borderRadius: number; zIndex: number }>
  ) => {
    const current = getTransformForTarget(target);
    if (!current) return;
    const briefIdx = briefImageTargetIndex(target);
    if (briefIdx !== null) {
      setState((prev) => {
        const list = (prev.executiveBriefImageTransforms ?? []).slice();
        while (list.length < 3) list.push({ x: 0, y: 0, zoom: 1, borderRadius: 12, zIndex: 0 });
        const cur = list[briefIdx];
        list[briefIdx] = {
          ...cur,
          ...patch,
          ...(typeof patch.zoom === "number"
            ? { zoom: Math.min(3, Math.max(0.01, patch.zoom)) }
            : {}),
          ...(typeof patch.borderRadius === "number"
            ? { borderRadius: Math.min(9999, Math.max(0, patch.borderRadius)) }
            : {}),
          ...(typeof patch.zIndex === "number"
            ? { zIndex: Math.min(999, Math.max(-999, Math.round(patch.zIndex))) }
            : {})
        };
        return { ...prev, executiveBriefImageTransforms: list };
      });
      return;
    }
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
            : {}),
          ...(typeof patch.zIndex === "number"
            ? { zIndex: Math.min(999, Math.max(-999, Math.round(patch.zIndex))) }
            : {})
        }
      }
    }));
  };

  const bumpTargetZIndex = (target: EditableTarget, delta: number) => {
    const current = getTransformForTarget(target);
    if (!current) return;
    setTargetImageTransform(target, { zIndex: (current.zIndex ?? 0) + delta });
  };

  const setTargetZIndexExtreme = (target: EditableTarget, mode: "front" | "back") => {
    const transforms = state.newsletterImageTransforms;
    const values = [transforms.topImage.zIndex, transforms.logo.zIndex, transforms.portrait.zIndex, transforms.hero.zIndex];
    const max = values.reduce((acc, v) => (v > acc ? v : acc), -999);
    const min = values.reduce((acc, v) => (v < acc ? v : acc), 999);
    setTargetImageTransform(target, { zIndex: mode === "front" ? max + 1 : min - 1 });
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
      else if (target === "executiveBriefImage0") briefImage0UploadRef.current?.click();
      else if (target === "executiveBriefImage1") briefImage1UploadRef.current?.click();
      else if (target === "executiveBriefImage2") briefImage2UploadRef.current?.click();
    };
    const targetLabel = target
      .replace("Image", " image")
      .replace("issueHeading", "issue heading")
      .replace("missionHeading", "mission heading")
      .replace("missionBody", "mission body")
      .replace("greetingHeading", "greeting heading")
      .replace("greetingBody", "greeting body")
      .replace("executiveBriefTitle", "executive brief title")
      .replace("executiveBriefBody", "executive brief body")
      .replace("executiveBriefLink", "executive brief link")
      .replace("executiveBriefSection", "executive brief section")
      .replace("executiveBriefImage0", "executive brief image 1")
      .replace("executiveBriefImage1", "executive brief image 2")
      .replace("executiveBriefImage2", "executive brief image 3")
      .replace("storyTitle", "story title")
      .replace("storyExcerpt", "story excerpt")
      .replace("storyBody", "story body")
      .replace("storyMeta", "story meta")
      .replace("storyCta", "story buttons");
    const imageDeleteField =
      target === "topImage"
        ? ("newsletterTopImageUrl" as const)
        : target === "logoImage"
          ? ("newsletterLogoUrl" as const)
          : target === "portraitImage"
            ? ("newsletterPortraitUrl" as const)
            : target === "heroImage"
              ? ("newsletterHeroImageUrl" as const)
              : null;
    const canDeleteThisImage =
      isFloating &&
      isImageTarget(target) &&
      imageDeleteField &&
      Boolean(String((state as Record<string, unknown>)[imageDeleteField] ?? "").trim());
    const handleDeleteTextTarget = (): boolean => {
      if (!isFloating || isImageTarget(target)) return false;
      setState((prev) => {
        switch (target) {
          case "issueHeading":
            return { ...prev, newsletterTitle: "" };
          case "missionHeading":
            return { ...prev, newsletterMissionHeading: "" };
          case "missionBody":
            return { ...prev, newsletterMission: "", newsletterMissionHtml: "" };
          case "greetingHeading":
            return { ...prev, newsletterGreetingHeading: "" };
          case "greetingBody":
            return { ...prev, newsletterWelcomeLaura: "", newsletterWelcomeLauraHtml: "" };
          case "executiveBriefTitle":
            return { ...prev, executiveBriefTitle: "" };
          default:
            return prev;
        }
      });
      clearEditors();
      return true;
    };
    const canDeleteThisText =
      isFloating &&
      !isImageTarget(target) &&
      (() => {
        switch (target) {
          case "issueHeading":
            return Boolean(state.newsletterTitle.trim());
          case "missionHeading":
            return Boolean(state.newsletterMissionHeading.trim());
          case "missionBody":
            return Boolean(state.newsletterMission.trim() || state.newsletterMissionHtml.trim());
          case "greetingHeading":
            return Boolean(state.newsletterGreetingHeading.trim());
          case "greetingBody":
            return Boolean(state.newsletterWelcomeLaura.trim() || state.newsletterWelcomeLauraHtml.trim());
          case "executiveBriefTitle":
            return Boolean(state.executiveBriefTitle.trim());
          default:
            return false;
        }
      })();
    const inlineNode = (
      <aside className={`newsletter-element-controls${isFloating ? " is-floating" : ""}`}>
        {isFloating ? (
          <div className="newsletter-floating-controls-head">
            <strong>Adjust {targetLabel}</strong>
            <div className="newsletter-floating-controls-actions">
              {isImageTarget(target) ? (
                <button type="button" className="button secondary" onClick={triggerUpload}>
                  Upload image
                </button>
              ) : null}
              <button
                type="button"
                className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : saveState === "saving" ? " is-saving" : ""}`}
                onClick={() => void saveStories()}
                disabled={saveState === "saving"}
              >
                {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save"}
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
        {target === "issueHeading" ? (
          <div className="newsletter-position-block">
            <strong>Date line</strong>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={state.newsletterShowDate !== false}
                onChange={(e) => setState((prev) => ({ ...prev, newsletterShowDate: e.target.checked }))}
              />
              Show | {issueDate}
            </label>
          </div>
        ) : null}
        {target === "missionBody" || target === "greetingBody" ? (
          <p className="newsletter-inline-edit-hint">Click the text on the page to edit it directly. Use this panel to change font, size, and color.</p>
        ) : null}
        {canEdit ? (
          <div className="newsletter-position-block">
            <strong>Decorative line</strong>
            <label>
              Section
              <select
                value={activeLayoutSection}
                onChange={(e) => setActiveLayoutSection(e.target.value as NewsletterLayoutSectionId)}
              >
                {(Object.keys(layoutSectionLabels) as NewsletterLayoutSectionId[]).map((id) => (
                  <option key={id} value={id}>
                    {layoutSectionLabels[id]}
                  </option>
                ))}
              </select>
            </label>
            <div className="newsletter-floating-controls-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => insertLayoutDivider(activeLayoutSection, "before")}
              >
                + Line above
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => insertLayoutDivider(activeLayoutSection, "after")}
              >
                + Line below
              </button>
            </div>
          </div>
        ) : null}
        {style ? (
          <>
            <div className="newsletter-position-block">
              <strong>Position</strong>
              <div className="newsletter-floating-controls-actions newsletter-nudge-buttons">
                <button
                  type="button"
                  className="button secondary"
                  title="Move up 8px"
                  onClick={() => setTargetStyle(target, { offsetY: (style.offsetY ?? 0) - 8 })}
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  className="button secondary"
                  title="Move down 8px"
                  onClick={() => setTargetStyle(target, { offsetY: (style.offsetY ?? 0) + 8 })}
                >
                  ↓ Down
                </button>
              </div>
              <label>
                Nudge X ({Math.round(style.offsetX ?? 0)}px)
                <div className="newsletter-radius-row">
                  <input
                    type="range"
                    min={-400}
                    max={400}
                    step={1}
                    value={style.offsetX ?? 0}
                    onChange={(e) => setTargetStyle(target, { offsetX: Number(e.target.value) })}
                    aria-label="Horizontal nudge"
                  />
                  <input
                    type="number"
                    min={-2000}
                    max={2000}
                    step={1}
                    value={Math.round(style.offsetX ?? 0)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.trim()) return;
                      const next = Number.parseFloat(raw);
                      if (!Number.isFinite(next)) return;
                      setTargetStyle(target, { offsetX: next });
                    }}
                    className="newsletter-radius-number"
                    aria-label="Horizontal nudge value (px)"
                  />
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setTargetStyle(target, { offsetX: 0, offsetY: 0 })}
                    title="Reset both nudges"
                  >
                    Reset
                  </button>
                </div>
              </label>
              <label>
                Nudge Y ({Math.round(style.offsetY ?? 0)}px)
                <div className="newsletter-radius-row">
                  <input
                    type="range"
                    min={-400}
                    max={400}
                    step={1}
                    value={style.offsetY ?? 0}
                    onChange={(e) => setTargetStyle(target, { offsetY: Number(e.target.value) })}
                    aria-label="Vertical nudge"
                  />
                  <input
                    type="number"
                    min={-2000}
                    max={2000}
                    step={1}
                    value={Math.round(style.offsetY ?? 0)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.trim()) return;
                      const next = Number.parseFloat(raw);
                      if (!Number.isFinite(next)) return;
                      setTargetStyle(target, { offsetY: next });
                    }}
                    className="newsletter-radius-number"
                    aria-label="Vertical nudge value (px)"
                  />
                </div>
              </label>
            </div>
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
                  onClick={() => {
                    const next = style.color || "#f3f7f6";
                    setAllTextStyles({ color: next });
                    setState((prev) => ({ ...prev, newsletterStoryTextColor: next }));
                  }}
                  title="Apply this color to every text element in the newsletter, including stories"
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
                  onClick={() => {
                    setAllTextStyles({ color: "" });
                    setState((prev) => ({ ...prev, newsletterStoryTextColor: "" }));
                  }}
                  title="Reset color on every text element, including stories"
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
            <div className="newsletter-radius-presets">
              <button
                type="button"
                className="button primary"
                onClick={() => setTargetImageTransform(target, { x: 0, y: 0, zoom: 1 })}
                title="Reset position and zoom so the full image is visible"
              >
                Fit image
              </button>
            </div>
            <label>
              Layer (z: {transform.zIndex ?? 0})
              <div className="newsletter-radius-presets">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setTargetZIndexExtreme(target, "back")}
                  title="Send to back of all images"
                >
                  To back
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => bumpTargetZIndex(target, -1)}
                  title="Send one layer back"
                >
                  Backward
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => bumpTargetZIndex(target, 1)}
                  title="Bring one layer forward"
                >
                  Forward
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setTargetZIndexExtreme(target, "front")}
                  title="Bring to front of all images"
                >
                  To front
                </button>
              </div>
            </label>
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
              <div className="newsletter-floating-controls-actions newsletter-nudge-buttons">
                <button
                  type="button"
                  className="button secondary"
                  title="Move up"
                  onClick={() => setTargetImageTransform(target, { y: transform.y - 2 })}
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  className="button secondary"
                  title="Move down"
                  onClick={() => setTargetImageTransform(target, { y: transform.y + 2 })}
                >
                  ↓ Down
                </button>
              </div>
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
        {canDeleteThisImage && imageDeleteField ? (
          <div className="newsletter-position-block newsletter-delete-element-block">
            <strong>Delete element</strong>
            <button
              type="button"
              className="button secondary"
              onClick={() => setState((prev) => ({ ...prev, [imageDeleteField]: "" }))}
              aria-label="Remove this image from the newsletter"
            >
              Delete element
            </button>
          </div>
        ) : null}
        {canDeleteThisText ? (
          <div className="newsletter-position-block newsletter-delete-element-block">
            <strong>Delete element</strong>
            <p className="newsletter-inline-edit-hint">
              Clears the {targetLabel} text. The slot stays in the layout. Type new text into the placeholder to bring it back.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={handleDeleteTextTarget}
              aria-label={`Clear ${targetLabel} text`}
            >
              Delete element
            </button>
          </div>
        ) : null}
      </aside>
    );
    if (isFloating && typeof document !== "undefined") {
      return createPortal(inlineNode, document.body);
    }
    return inlineNode;
  };

  const renderLayoutDividers = (sectionId: NewsletterLayoutSectionId, placement: "before" | "after") => {
    const dividers = (state.newsletterLayoutDividers ?? []).filter(
      (d) => d.sectionId === sectionId && d.placement === placement
    );
    if (dividers.length === 0) return null;
    return (
      <>
        {dividers.map((d) => {
          const isSelected = selectedLayoutDividerId === d.id;
          const lineWidth =
            d.lineStyle === "double"
              ? Math.max(3, d.thickness * 3)
              : d.thickness;
          const borderTop =
            d.lineStyle === "double"
              ? `${lineWidth}px double ${d.color}`
              : `${lineWidth}px ${d.lineStyle} ${d.color}`;
          return (
            <div
              key={d.id}
              className={`newsletter-layout-divider${isSelected ? " newsletter-edit-selected" : ""}${canEdit ? " is-editable" : ""}`}
              role={canEdit ? "button" : undefined}
              onClick={
                canEdit
                  ? (e) => {
                      e.stopPropagation();
                      setSelectedEditorTarget(null);
                      setSelectedStoryEdit(null);
                      setSelectedLayoutDividerId(d.id);
                    }
                  : undefined
              }
              style={{
                marginTop: `${d.marginTop}px`,
                marginBottom: `${d.marginBottom}px`,
                transform: `translate(${d.offsetX}px, ${d.offsetY}px)`,
                display: "flex",
                justifyContent: "center"
              }}
            >
              <span
                className="newsletter-layout-divider-line"
                style={{
                  width: `${d.widthPercent}%`,
                  borderTop,
                  display: "block"
                }}
              />
            </div>
          );
        })}
      </>
    );
  };

  const renderLayoutDividerPortal = () => {
    if (!canEdit || !selectedLayoutDividerId) return null;
    const divider = (state.newsletterLayoutDividers ?? []).find((d) => d.id === selectedLayoutDividerId);
    if (!divider) return null;
    const node = (
      <aside className="newsletter-element-controls is-floating">
        <div className="newsletter-floating-controls-head">
          <strong>Decorative line: {layoutSectionLabels[divider.sectionId]} ({divider.placement})</strong>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : saveState === "saving" ? " is-saving" : ""}`}
              onClick={() => void saveStories()}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save"}
            </button>
            <button type="button" className="button secondary" onClick={clearEditors} aria-label="Close line editor">
              Close
            </button>
          </div>
        </div>
        <div className="newsletter-position-block">
          <strong>Move</strong>
          <label>
            Section
            <select
              value={divider.sectionId}
              onChange={(e) =>
                updateLayoutDivider(divider.id, {
                  sectionId: e.target.value as NewsletterLayoutSectionId
                })
              }
            >
              {(Object.keys(layoutSectionLabels) as NewsletterLayoutSectionId[]).map((id) => (
                <option key={id} value={id}>
                  {layoutSectionLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Placement
            <select
              value={divider.placement}
              onChange={(e) =>
                updateLayoutDivider(divider.id, {
                  placement: e.target.value === "before" ? "before" : "after"
                })
              }
            >
              <option value="before">Above section</option>
              <option value="after">Below section</option>
            </select>
          </label>
          <label>
            Nudge X ({Math.round(divider.offsetX)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={divider.offsetX}
              onChange={(e) => updateLayoutDivider(divider.id, { offsetX: Number(e.target.value) })}
            />
          </label>
          <label>
            Nudge Y ({Math.round(divider.offsetY)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={divider.offsetY}
              onChange={(e) => updateLayoutDivider(divider.id, { offsetY: Number(e.target.value) })}
            />
          </label>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => updateLayoutDivider(divider.id, { offsetX: 0, offsetY: 0 })}
            >
              Reset nudge
            </button>
          </div>
        </div>
        <label>
          Margin top ({Math.round(divider.marginTop)}px)
          <input
            type="range"
            min={0}
            max={120}
            step={1}
            value={divider.marginTop}
            onChange={(e) => updateLayoutDivider(divider.id, { marginTop: Number(e.target.value) })}
          />
        </label>
        <label>
          Margin bottom ({Math.round(divider.marginBottom)}px)
          <input
            type="range"
            min={0}
            max={120}
            step={1}
            value={divider.marginBottom}
            onChange={(e) => updateLayoutDivider(divider.id, { marginBottom: Number(e.target.value) })}
          />
        </label>
        <label>
          Width ({Math.round(divider.widthPercent)}%)
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={divider.widthPercent}
            onChange={(e) => updateLayoutDivider(divider.id, { widthPercent: Number(e.target.value) })}
          />
        </label>
        <label>
          Thickness ({divider.thickness}px)
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={divider.thickness}
            onChange={(e) => updateLayoutDivider(divider.id, { thickness: Number(e.target.value) })}
          />
        </label>
        <label>
          Style
          <select
            value={divider.lineStyle}
            onChange={(e) => {
              const v = e.target.value;
              const next: NewsletterLayoutDivider["lineStyle"] =
                v === "dashed" ? "dashed" : v === "double" ? "double" : "solid";
              updateLayoutDivider(divider.id, { lineStyle: next });
            }}
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
                const c = divider.color.trim();
                if (/^#[0-9a-f]{6}$/i.test(c)) return c;
                if (/^#[0-9a-f]{3}$/i.test(c)) return c;
                return "#e6f5ef";
              })()}
              onChange={(e) => updateLayoutDivider(divider.id, { color: e.target.value })}
              aria-label="Line color"
            />
            <button
              type="button"
              className="button secondary"
              onClick={() => updateLayoutDivider(divider.id, { color: "rgba(230, 245, 239, 0.55)" })}
            >
              Default
            </button>
          </span>
        </label>
        <div className="newsletter-position-block">
          <strong>Preset</strong>
          <p className="newsletter-inline-edit-hint">
            Save the current line as the default. Every new decorative line will start with these settings (thickness, width, margins, color, style, nudge).
          </p>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className="button primary"
              onClick={() => saveLayoutDividerPreset(divider)}
            >
              Save as default
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const preset =
                  state.newsletterLayoutDividerPreset ?? DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET;
                updateLayoutDivider(divider.id, {
                  offsetX: preset.offsetX,
                  offsetY: preset.offsetY,
                  marginTop: preset.marginTop,
                  marginBottom: preset.marginBottom,
                  thickness: preset.thickness,
                  color: preset.color,
                  widthPercent: preset.widthPercent,
                  lineStyle: preset.lineStyle
                });
                setStatus("This line was reset to the saved default.");
              }}
            >
              Apply default to this line
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={resetLayoutDividerPreset}
              title="Reset the saved default back to the built-in style"
            >
              Reset default
            </button>
          </div>
        </div>
        <div className="newsletter-position-block newsletter-delete-element-block">
          <strong>Delete element</strong>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              deleteLayoutDivider(divider.id);
              clearEditors();
            }}
            aria-label="Delete decorative line"
          >
            Delete element
          </button>
        </div>
      </aside>
    );
    if (typeof document === "undefined") return null;
    return createPortal(node, document.body);
  };

  const renderStoryEditPortal = () => {
    if (!canEdit || !selectedStoryEdit) return null;
    const story = state.stories.find((s) => s.id === selectedStoryEdit.storyId);
    if (!story || story.kind === "divider") return null;
    const isTextBlock = story.kind === "text";
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
    const galleryImages: string[] = Array.isArray(story.images) && story.images.length > 0
      ? story.images
      : story.imageUrl
        ? [story.imageUrl]
        : [];
    const selectedBlockMovementControls = (() => {
      if (isTextBlock) return null;
      if (field === "image") {
        const imageOffsetX = clampStoryImageBlockOffset(story.imageOffsetX, "x");
        const imageOffsetY = clampStoryImageBlockOffset(story.imageOffsetY, "y");
        return (
          <div className="newsletter-position-block newsletter-position-block-emphasis">
            <strong>Move selected IMAGE block only</strong>
            <p className="newsletter-inline-edit-hint">
              These sliders move only this story image. They do not move the headline or text.
            </p>
            <label>
              Image block X ({imageOffsetX}px)
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={imageOffsetX}
                onChange={(e) => updateStory(story.id, { imageOffsetX: clampStoryImageBlockOffset(Number(e.target.value), "x") })}
              />
            </label>
            <label>
              Image block Y ({imageOffsetY}px)
              <input
                type="range"
                min={-120}
                max={120}
                step={1}
                value={imageOffsetY}
                onChange={(e) => updateStory(story.id, { imageOffsetY: clampStoryImageBlockOffset(Number(e.target.value), "y") })}
              />
            </label>
            <div className="newsletter-floating-controls-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => updateStory(story.id, { imageOffsetX: 0, imageOffsetY: 0 })}
              >
                Reset image block position
              </button>
            </div>
          </div>
        );
      }
      const perStoryXKey = `${field}OffsetX` as keyof StoryRecord;
      const perStoryYKey = `${field}OffsetY` as keyof StoryRecord;
      const perStoryXVal = (story as Record<string, unknown>)[perStoryXKey];
      const perStoryYVal = (story as Record<string, unknown>)[perStoryYKey];
      const curPerStoryX = typeof perStoryXVal === "number" ? perStoryXVal : 0;
      const curPerStoryY = typeof perStoryYVal === "number" ? perStoryYVal : 0;
      return (
        <div className="newsletter-position-block newsletter-position-block-emphasis">
          <strong>Move selected {fieldLabels[field].toLowerCase()} only</strong>
          <p className="newsletter-inline-edit-hint">
            These sliders move only this {fieldLabels[field].toLowerCase()} in this story. They do not move the image or other stories.
          </p>
          <label>
            {fieldLabels[field]} X ({Math.round(curPerStoryX)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={curPerStoryX}
              onChange={(e) => updateStory(story.id, { [perStoryXKey]: Number(e.target.value) } as Partial<StoryRecord>)}
            />
          </label>
          <label>
            {fieldLabels[field]} Y ({Math.round(curPerStoryY)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={curPerStoryY}
              onChange={(e) => updateStory(story.id, { [perStoryYKey]: Number(e.target.value) } as Partial<StoryRecord>)}
            />
          </label>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => updateStory(story.id, { [perStoryXKey]: 0, [perStoryYKey]: 0 } as Partial<StoryRecord>)}
            >
              Reset selected {fieldLabels[field].toLowerCase()}
            </button>
          </div>
        </div>
      );
    })();
    const node = (
      <aside className="newsletter-element-controls is-floating">
        <div className="newsletter-floating-controls-head">
          <strong>{isTextBlock ? "Edit text block" : `Edit story: ${fieldLabels[field]}`}</strong>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : saveState === "saving" ? " is-saving" : ""}`}
              onClick={() => void saveStories()}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save"}
            </button>
            <button type="button" className="button secondary" onClick={clearEditors} aria-label="Close editor">
              Close
            </button>
          </div>
        </div>
        {selectedBlockMovementControls}
        <div className="newsletter-position-block">
          <strong>{isTextBlock ? "Block layout" : "Story layout"}</strong>
          <div className="newsletter-floating-controls-actions">
            <button type="button" className="button secondary" onClick={() => insertTextBlockNearStory(story.id, "before")}>
              + Text block above
            </button>
            <button type="button" className="button secondary" onClick={() => insertTextBlockNearStory(story.id, "after")}>
              + Text block below
            </button>
            <button type="button" className="button secondary" onClick={() => insertDividerNearStory(story.id, "before")}>
              + Divider above
            </button>
            <button type="button" className="button secondary" onClick={() => insertDividerNearStory(story.id, "after")}>
              + Divider below
            </button>
            <button type="button" className="button secondary" onClick={() => moveStory(story.id, -1)}>
              Move up
            </button>
            <button type="button" className="button secondary" onClick={() => moveStory(story.id, 1)}>
              Move down
            </button>
          </div>
        </div>
        <div className="newsletter-position-block">
          <strong>Move entire {isTextBlock ? "block" : "story"} together</strong>
          <p className="newsletter-inline-edit-hint">
            This moves the whole {isTextBlock ? "block" : "story"} as one unit, including headline, image, and text.
          </p>
          <label>
            Nudge X ({Math.round(story.articleOffsetX ?? 0)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={story.articleOffsetX ?? 0}
              onChange={(e) => updateStory(story.id, { articleOffsetX: Number(e.target.value) })}
            />
          </label>
          <label>
            Nudge Y ({Math.round(story.articleOffsetY ?? 0)}px)
            <input
              type="range"
              min={-400}
              max={400}
              step={1}
              value={story.articleOffsetY ?? 0}
              onChange={(e) => updateStory(story.id, { articleOffsetY: Number(e.target.value) })}
            />
          </label>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => updateStory(story.id, { articleOffsetX: 0, articleOffsetY: 0 })}
            >
              Reset whole-{isTextBlock ? "block" : "story"} position
            </button>
          </div>
        </div>
        <div className="newsletter-position-block">
          <strong>Decorative line (anywhere in newsletter)</strong>
          <label>
            Section
            <select
              value={activeLayoutSection}
              onChange={(e) => setActiveLayoutSection(e.target.value as NewsletterLayoutSectionId)}
            >
              {(Object.keys(layoutSectionLabels) as NewsletterLayoutSectionId[]).map((id) => (
                <option key={id} value={id}>
                  {layoutSectionLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <div className="newsletter-floating-controls-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => insertLayoutDivider(activeLayoutSection, "before")}
            >
              + Line above section
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => insertLayoutDivider(activeLayoutSection, "after")}
            >
              + Line below section
            </button>
          </div>
        </div>
        {(() => {
          const fieldStyleTarget: EditableTarget | null = isTextBlock
            ? "storyBody"
            : field === "title"
              ? "storyTitle"
              : field === "excerpt"
                ? "storyExcerpt"
                : field === "body"
                  ? "storyBody"
                  : field === "meta"
                    ? "storyMeta"
                    : field === "cta"
                      ? "storyCta"
                      : null;
          if (!fieldStyleTarget) return null;
          const fStyle = state.newsletterElementStyles[fieldStyleTarget];
          return (
            <div className="newsletter-position-block">
              <strong>Size, font &amp; colour (applies to every story)</strong>
              <label>
                Global nudge X ({Math.round(fStyle.offsetX ?? 0)}px), moves ALL stories
                <input
                  type="range"
                  min={-400}
                  max={400}
                  step={1}
                  value={fStyle.offsetX ?? 0}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { offsetX: Number(e.target.value) })}
                />
              </label>
              <label>
                Global nudge Y ({Math.round(fStyle.offsetY ?? 0)}px), moves ALL stories
                <input
                  type="range"
                  min={-400}
                  max={400}
                  step={1}
                  value={fStyle.offsetY ?? 0}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { offsetY: Number(e.target.value) })}
                />
              </label>
              <label>
                Font size ({fStyle.fontSizeRem.toFixed(2)}rem)
                <input
                  type="range"
                  min={0.6}
                  max={5}
                  step={0.02}
                  value={fStyle.fontSizeRem}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { fontSizeRem: Number(e.target.value) })}
                />
              </label>
              <label>
                Font family
                <input
                  value={fStyle.fontFamily}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { fontFamily: e.target.value })}
                  placeholder="inherit, Georgia, Inter…"
                />
              </label>
              <label>
                Alignment
                <select
                  value={fStyle.textAlign}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { textAlign: e.target.value === "left" ? "left" : "center" })}
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                </select>
              </label>
              <label>
                Bold
                <input
                  type="checkbox"
                  checked={fStyle.fontWeight >= 600}
                  onChange={(e) => setTargetStyle(fieldStyleTarget, { fontWeight: e.target.checked ? 700 : 400 })}
                />
              </label>
              <label>
                Colour
                <span className="newsletter-text-color-row">
                  <input
                    type="color"
                    value={fStyle.color || "#f3f7f6"}
                    onChange={(e) => setTargetStyle(fieldStyleTarget, { color: e.target.value })}
                  />
                  <button type="button" className="button secondary" onClick={() => setTargetStyle(fieldStyleTarget, { color: "" })}>
                    Default
                  </button>
                </span>
              </label>
              <div className="newsletter-floating-controls-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setTargetStyle(fieldStyleTarget, { offsetX: 0, offsetY: 0 })
                  }
                >
                  Reset global position
                </button>
              </div>
            </div>
          );
        })()}
        {isTextBlock ? (
          <>
            <label>
              Optional heading
              <input
                value={story.title}
                onChange={(e) => updateStory(story.id, { title: e.target.value })}
                placeholder="(leave blank for body-only)"
              />
            </label>
            <label>
              Body (rich HTML; paste from Word/Docs/web to keep formatting)
              <textarea
                rows={10}
                value={story.body}
                onChange={(e) => updateStory(story.id, { body: e.target.value })}
                placeholder="<p>Your text here…</p>"
              />
            </label>
            <p className="admin-rss-hint">
              Tip: click directly on the text block in the preview to type inline. This textarea is for raw HTML (e.g. paste in <code>&lt;p&gt;&lt;strong&gt;…&lt;/strong&gt;&lt;/p&gt;</code>).
            </p>
          </>
        ) : null}
        {!isTextBlock && field === "title" ? (
          <label>
            Title
            <input value={story.title} onChange={(e) => updateStory(story.id, { title: e.target.value })} placeholder="Story title" />
          </label>
        ) : null}
        {!isTextBlock && field === "excerpt" ? (
          <label>
            Excerpt
            <textarea rows={4} value={story.excerpt} onChange={(e) => updateStory(story.id, { excerpt: e.target.value })} placeholder="Story excerpt" />
          </label>
        ) : null}
        {!isTextBlock && field === "body" ? (
          <>
            <label>
              Body (rich HTML; paste from Word/Docs/web to keep formatting)
              <textarea rows={10} value={story.body} onChange={(e) => updateStory(story.id, { body: e.target.value })} placeholder="Story body" />
            </label>
            <div className="newsletter-floating-controls-actions newsletter-inline-ok">
              <button
                type="button"
                className="button primary button-sage"
                onClick={async () => {
                  await saveStories();
                  clearEditors();
                }}
                disabled={saveState === "saving"}
              >
                {saveState === "saving" ? "Saving…" : "OK, done"}
              </button>
            </div>
          </>
        ) : null}
        {!isTextBlock && field === "meta" ? (
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
        {!isTextBlock && field === "cta" ? (
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
        {!isTextBlock && field === "image" ? (
          <>
            <label>
              Image URL (primary)
              <input
                value={story.imageUrl}
                onChange={(e) => updateStory(story.id, { imageUrl: e.target.value, images: e.target.value ? [e.target.value] : [] })}
                placeholder="Story image URL"
              />
            </label>
            <div className="newsletter-story-image-panel-actions">
              <button type="button" className="button primary" onClick={() => storyImageUploadRef.current?.click()}>
                Upload image(s). Pick multiple for a montage
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => updateStory(story.id, { imageUrl: "", images: [] })}
              >
                Clear all images
              </button>
            </div>
            {galleryImages.length === 1 || galleryImages.length === 0 ? (
              <div className="newsletter-position-block">
                <strong>Image frame (size / crop)</strong>
                <p className="admin-rss-hint">
                  Applies when the story shows one hero image. Wider aspect ratios crop top/bottom; use <strong>Fit: Contain</strong> to show the full photo inside the frame.
                </p>
                {(() => {
                  const f = normalizeStoryImageFrame(story.imageFrame);
                  const setFrame = (patch: Partial<StoryImageFrame>) =>
                    updateStory(story.id, { imageFrame: { ...f, ...patch } });
                  return (
                    <>
                      <label>
                        Aspect ratio
                        <select
                          value={f.aspectRatio}
                          onChange={(e) => setFrame({ aspectRatio: e.target.value })}
                        >
                          <option value="">Natural (height capped)</option>
                          <option value="21 / 9">21:9 ultrawide</option>
                          <option value="16 / 9">16:9 cinematic</option>
                          <option value="3 / 2">3:2 photo</option>
                          <option value="4 / 3">4:3 classic</option>
                          <option value="1 / 1">1:1 square</option>
                          <option value="3 / 4">3:4 portrait</option>
                          <option value="2 / 3">2:3 poster</option>
                          <option value="9 / 16">9:16 vertical</option>
                        </select>
                      </label>
                      <label>
                        Max frame height ({f.maxHeightPx === 0 ? "default ~360px" : `${f.maxHeightPx}px`})
                        <input
                          type="range"
                          min={0}
                          max={1200}
                          step={10}
                          value={f.maxHeightPx}
                          onChange={(e) => setFrame({ maxHeightPx: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Fit
                        <select
                          value={f.objectFit}
                          onChange={(e) => setFrame({ objectFit: e.target.value === "contain" ? "contain" : "cover" })}
                        >
                          <option value="cover">Cover (fill frame, may crop)</option>
                          <option value="contain">Contain (full image visible)</option>
                        </select>
                      </label>
                      <label>
                        Move image, X ({Math.round(f.offsetX ?? 0)}px)
                        <input
                          type="range"
                          min={-400}
                          max={400}
                          step={1}
                          value={f.offsetX ?? 0}
                          onChange={(e) => setFrame({ offsetX: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Move image, Y ({Math.round(f.offsetY ?? 0)}px)
                        <input
                          type="range"
                          min={-400}
                          max={400}
                          step={1}
                          value={f.offsetY ?? 0}
                          onChange={(e) => setFrame({ offsetY: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Zoom ({(f.zoom ?? 1).toFixed(2)}×)
                        <input
                          type="range"
                          min={0.2}
                          max={5}
                          step={0.02}
                          value={f.zoom ?? 1}
                          onChange={(e) => setFrame({ zoom: Number(e.target.value) })}
                        />
                      </label>
                      <div className="newsletter-floating-controls-actions">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setFrame({ offsetX: 0, offsetY: 0, zoom: 1 })}
                        >
                          Reset image position
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => updateStory(story.id, { imageFrame: undefined })}
                        >
                          Reset frame to default
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
            {galleryImages.length > 0 ? (
              <div className="newsletter-story-gallery-grid">
                {galleryImages.map((src, idx) => (
                  <div key={`${idx}-${src.slice(0, 24)}`} className="newsletter-story-gallery-item">
                    <img src={src} alt={`Story image ${idx + 1}`} />
                    <div className="newsletter-story-gallery-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => moveStoryImage(story.id, idx, -1)}
                        disabled={idx === 0}
                        title="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => moveStoryImage(story.id, idx, 1)}
                        disabled={idx === galleryImages.length - 1}
                        title="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => removeStoryImageAt(story.id, idx)}
                        title="Remove this image"
                      >
                        ✕
                      </button>
                    </div>
                    {idx === 0 ? <span className="newsletter-story-gallery-tag">Primary</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="admin-rss-hint">
              {galleryImages.length > 1
                ? `${galleryImages.length} images. Montage layout will be applied automatically.`
                : "Pick 2–9 photos at once to build a tidy montage."}
            </p>
          </>
        ) : null}
        <div className="newsletter-position-block newsletter-delete-element-block">
          <strong>Delete element</strong>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setState((prev) => {
                const stories = prev.stories.filter((s) => s.id !== story.id);
                let newsletterBlocks = prev.newsletterBlocks ?? [];
                if ((prev.newsletterBlocksMigrationVersion ?? 0) >= 1) {
                  newsletterBlocks = newsletterBlocks.filter(
                    (b) => !(b.kind === "story" && b.storyId === story.id)
                  );
                }
                return { ...prev, stories, newsletterBlocks };
              });
              clearEditors();
            }}
            aria-label={isTextBlock ? "Delete text block from newsletter" : "Delete story from newsletter"}
          >
            Delete element
          </button>
        </div>
      </aside>
    );
    if (typeof document === "undefined") return null;
    return createPortal(node, document.body);
  };

  // Shared logic: build canvas elements from any StoriesState snapshot.
  // Pass existingEls to preserve user-customised styles.
  // preservePositions=true (default false): also preserve X/Y positions for flow text —
  // used by explicit "Convert to canvas" only. On rich-text-pour, flow positions are
  // recalculated fresh so auto-reflow artifacts don't corrupt the layout.
  // Masthead overlays (banner/logo/portrait/hero) always keep their canvas geometry
  // and crop when present — pour/rebuild must not undo the composed masthead.
  const buildCanvasElements = (
    s: StoriesState,
    existingEls?: import("../../lib/story-types").CanvasEl[],
    preservePositions = false
  ): import("../../lib/story-types").CanvasEl[] => {
    const els: import("../../lib/story-types").CanvasEl[] = [];
    const existingById = existingEls
      ? new Map(existingEls.map((e) => [e.id, e]))
      : new Map<string, import("../../lib/story-types").CanvasEl>();
    const storyFrameCanvasHeight = (frame?: StoryImageFrame | null, width = 660): number => {
      const f = normalizeStoryImageFrame(frame);
      const maxPx = f.maxHeightPx > 0 ? f.maxHeightPx : 360;
      const ar = f.aspectRatio.trim();
      if (!ar) return maxPx;
      const match = ar.match(/^\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*$/);
      if (!match) return maxPx;
      const w = Number(match[1]);
      const h = Number(match[2]);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return maxPx;
      return Math.min(maxPx, Math.round((width * h) / w));
    };

    // Locked elements: carry them over verbatim and skip recalculation for their IDs.
    const lockedIds = new Set<string>();
    if (existingEls) {
      for (const e of existingEls) {
        if ((e as { locked?: boolean }).locked) {
          els.push(e);
          lockedIds.add(e.id);
        }
      }
    }

    // Helper: add a text element and return its estimated bottom Y.
    // Always places at atY. Preserves visual styles (color, font) from existing element,
    // but uses the DEFAULT opts for height estimation so layout is always predictable —
    // user-customised font sizes / line-heights don't corrupt the Y tracker.
    const addText = (
      id: string,
      html: string,
      opts: Partial<import("../../lib/story-types").CanvasTextEl>,
      atY: number,
      trailingGap = 16
    ): number => {
      if (lockedIds.has(id)) {
        // Already added verbatim — advance y past the locked element's actual bottom
        const ex = existingById.get(id);
        if (ex && ex.kind === "text") return Math.max(atY, ex.y + measureElementHeight(ex) + trailingGap);
        return atY;
      }
      const base = makeTextEl({ id, x: 28, w: 660, zIndex: 5, ...opts, html, y: atY });
      const existing = existingById.get(id);
      const el = existing && existing.kind === "text"
        ? { ...base,
            color: existing.color,
            bg: existing.bg,
            borderWidth: existing.borderWidth,
            borderRadius: existing.borderRadius,
            shadow: existing.shadow,
            ...(preservePositions ? { x: existing.x, w: existing.w, fontSize: existing.fontSize,
              fontWeight: existing.fontWeight, lineHeight: existing.lineHeight,
              textAlign: existing.textAlign, letterSpacing: existing.letterSpacing } : {}),
          } as import("../../lib/story-types").CanvasTextEl
        : base;
      els.push(el);
      return atY + measureElementHeight(el) + trailingGap;
    };

    const addDivider = (id: string, atY: number): number => {
      if (lockedIds.has(id)) {
        const ex = existingById.get(id);
        if (ex) return Math.max(atY, ex.y + 32);
        return atY;
      }
      els.push(makeDividerEl({ id, x: 100, y: atY, w: 516, zIndex: 5 }));
      return atY + 24;
    };

    // Helper: advance y past a locked image element
    const yPastLocked = (id: string, fallbackY: number): number => {
      const ex = existingById.get(id);
      if (ex && ex.kind === "image") return Math.max(fallbackY, ex.y + ex.h + 20);
      return fallbackY;
    };

    /** Masthead overlays are user-composed — never reset geometry/crop on pour/rebuild. */
    const pushMastheadImage = (
      id: string,
      src: string,
      defaults: Partial<import("../../lib/story-types").CanvasImageEl>,
    ) => {
      if (!src || lockedIds.has(id)) return;
      const existing = existingById.get(id);
      if (existing && existing.kind === "image") {
        const kept = { ...existing, src } as import("../../lib/story-types").CanvasImageEl & {
          montageGroup?: string;
          montageIndex?: number;
          montageCols?: number;
        };
        delete kept.montageGroup;
        delete kept.montageIndex;
        delete kept.montageCols;
        if (id === "migrated-portrait") {
          kept.shadow = true;
          if (!kept.borderRadius || kept.borderRadius < MASTHEAD_PORTRAIT_SIZE / 2 - 2) {
            kept.borderRadius = MASTHEAD_PORTRAIT_SIZE / 2;
          }
        }
        els.push(kept);
        return;
      }
      els.push(makeImageEl(src, { id, ...defaults }));
    };

    const mastheadBottom = (id: string): number | null => {
      const el = els.find((e) => e.id === id) ?? (lockedIds.has(id) ? existingById.get(id) : undefined);
      if (el && el.kind === "image") return el.y + el.h;
      return null;
    };

    let y = 0;

    // ── Top banner image (full-bleed) ──────────────────────────────
    if (s.newsletterTopImageUrl) {
      pushMastheadImage("migrated-top", s.newsletterTopImageUrl, {
        x: mastheadCenterX(MASTHEAD_BANNER_W),
        y: -34,
        w: MASTHEAD_BANNER_W,
        h: 300,
        zIndex: 1,
        borderRadius: 0,
      });
      y = Math.max(y, mastheadBottom("migrated-top") ?? 280);
    }

    // ── Logo (centred over banner) ─────────────────────────────────
    if (s.newsletterLogoUrl) {
      const logoW = 400;
      const logoY = s.newsletterTopImageUrl ? 10 : 0;
      pushMastheadImage("migrated-logo", s.newsletterLogoUrl, {
        x: mastheadCenterX(logoW),
        y: logoY,
        w: logoW,
        h: 130,
        zIndex: 3,
        borderRadius: 0,
      });
    }

    // ── Portrait circle ────────────────────────────────────────────
    if (s.newsletterPortraitUrl) {
      const portraitW = MASTHEAD_PORTRAIT_SIZE;
      const portraitY = Math.max(0, y - 60);
      pushMastheadImage("migrated-portrait", s.newsletterPortraitUrl, {
        x: mastheadCenterX(portraitW),
        y: portraitY,
        w: portraitW,
        h: MASTHEAD_PORTRAIT_SIZE,
        zIndex: 10,
        borderRadius: MASTHEAD_PORTRAIT_SIZE / 2,
        objectPositionX: 0,
        objectPositionY: 0,
        imageZoom: 1,
        shadow: true,
      });
      const portraitBottom = mastheadBottom("migrated-portrait");
      if (portraitBottom != null) y = Math.max(y, portraitBottom + 20);
    }

    // ── Hero / celebration image ───────────────────────────────────
    if (s.newsletterHeroImageUrl) {
      const heroW = MASTHEAD_BANNER_W;
      const heroY = y;
      pushMastheadImage("migrated-hero", s.newsletterHeroImageUrl, {
        x: mastheadCenterX(heroW),
        y: heroY,
        w: heroW,
        h: 320,
        zIndex: 2,
        borderRadius: 14,
      });
      const heroBottom = mastheadBottom("migrated-hero");
      if (heroBottom != null) y = Math.max(y, heroBottom + 20);
    }

    y += 28;

    // ── Mission heading ────────────────────────────────────────────
    if (s.newsletterMissionHeading?.trim()) {
      y = addText("migrated-mission-hd", `<p>${s.newsletterMissionHeading}</p>`,
        { fontSize: 11, fontWeight: 600, textAlign: "center", color: "#a7c7bc", letterSpacing: 2 }, y);
    }

    // ── Mission body ───────────────────────────────────────────────
    const missionHtml = s.newsletterMissionHtml || (s.newsletterMission ? `<p>${s.newsletterMission}</p>` : "");
    if (missionHtml.trim()) {
      y = addText("migrated-mission", missionHtml,
        { x: 60, w: 596, fontSize: 16, textAlign: "center", color: "#4a8a82", lineHeight: 1.7 }, y);
    }

    y += 12; // breathing room before dividers

    // ── Issue heading with framing dividers (only when title exists) ──
    const hasTitle = !!s.newsletterTitle?.trim();
    if (hasTitle) {
      y = addDivider("migrated-div1", y);
      y = addText("migrated-title", `<p><strong>${s.newsletterTitle}</strong></p>`,
        { fontSize: 34, fontWeight: 700, textAlign: "center", color: "#f1f6f5", lineHeight: 1.1 }, y, 24);
      y = addDivider("migrated-div2", y);
      if (s.newsletterGreetingHeading?.trim()) {
        y = addText("migrated-greeting-hd", `<p>${s.newsletterGreetingHeading}</p>`,
          { fontSize: 20, fontWeight: 700, textAlign: "center", color: "#2a7060", lineHeight: 1.3 }, y, 12);
      }
    } else {
      y = addDivider("migrated-div1", y);
    }

    y += 8;

    // ── Greeting body ──────────────────────────────────────────────
    const greetingHtml = s.newsletterWelcomeLauraHtml || (s.newsletterWelcomeLaura ? `<p>${s.newsletterWelcomeLaura}</p>` : "");
    if (greetingHtml.trim()) {
      y = addText("migrated-greeting", greetingHtml,
        { fontSize: 17, textAlign: "left", color: "#e8f3f0", lineHeight: 1.75 }, y);
    }

    // ── Inherit body text colour from existing canvas elements ────────
    // Priority: greeting body → mission body → any text el → fallback
    const bodyTextColor: string = (() => {
      for (const id of ["migrated-greeting", "migrated-mission", "migrated-bt-0", "migrated-sb-0", "migrated-sb-s0"]) {
        const ex = existingById.get(id);
        if (ex && ex.kind === "text" && ex.color) return ex.color;
      }
      // Scan all existing text elements for a non-heading colour
      for (const ex of existingById.values()) {
        if (ex.kind === "text" && ex.color && !["#a7c7bc", "#f1f6f5"].includes(ex.color)) return ex.color;
      }
      return "#e8f3f0";
    })();

    // ── Non-story blocks (headings, text boxes, images) ───────────────
    const blocks = s.newsletterBlocks ?? [];
    // Collect story IDs from blocks so we can skip them in the loop
    const blockStoryIds = new Set(
      blocks
        .filter((b) => b.kind === "story")
        .map((b) => (b as import("../../lib/story-types").NewsletterStoryBlock).storyId)
    );

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "story") continue; // handled in unified stories section below
      els.push(makeDividerEl({ id: `migrated-bdiv-${i}`, x: 0, y, w: 716, zIndex: 5 }));
      y += 28;

      if (b.kind === "heading") {
        const hb = b as { text?: string };
        if (hb.text?.trim()) {
          y = addText(`migrated-bh-${i}`, `<p>${hb.text}</p>`,
            { fontSize: 13, fontWeight: 600, textAlign: "center", color: "#a7c7bc", letterSpacing: 1.5 }, y);
        }
      } else if (b.kind === "text" || b.kind === "text-box") {
        const tb = b as { html?: string; body?: string };
        const html = tb.html || (tb.body ? `<p>${tb.body}</p>` : "");
        if (html.trim()) {
          y = addText(`migrated-bt-${i}`, html,
            { fontSize: 16, textAlign: "left", color: bodyTextColor, lineHeight: 1.7 }, y);
        }
      } else if (b.kind === "image") {
        const ib = b as { imageUrl?: string };
        if (ib.imageUrl) {
          els.push(makeImageEl(ib.imageUrl, { id: `migrated-bi-${i}`, x: 28, y, w: 660, h: 320, zIndex: 5, borderRadius: 10 }));
          y += 336;
        }
      }
    }

    // ── Unified stories section ───────────────────────────────────────────
    // Use s.stories directly in array order — this is the pour/document order.
    // Block-based ordering was legacy; in canvas mode pours always replace stories
    // so s.stories already reflects the correct document sequence.
    type StoryItem = { story: import("../../lib/story-types").StoryRecord };
    const storyItems: StoryItem[] = s.stories.map(story => ({ story }));

    if (storyItems.length > 0) {
      y += GREETING_TO_NEXT_GAP; // gap before TOP STORIES section

      // Equal-length summaries so TOP STORIES tiles share the same text block height.
      const topStories = storyItems.slice(0, 3); // only first 3 in the grid
      const cardData: import("../../lib/story-types").CanvasStoryCardData[] = topStories.map(({ story }, cardIdx) => {
        const excerpt = buildStoryGridSummary(story);
        const existingStoryImg = existingById.get(`migrated-si-${cardIdx}`) as import("../../lib/story-types").CanvasImageEl | undefined;
        return {
          storyId: story.id,
          title: story.title || "",
          imageUrl: story.imageUrl || existingStoryImg?.src || undefined,
          excerpt,
        };
      });

      const cols: 2 | 3 = topStories.length >= 3 ? 3 : 2;

      // Preserve user customisations on the existing grid element
      const existingGrid = existingById.get("migrated-story-grid") as import("../../lib/story-types").CanvasStoryGridEl | undefined;
      const gridLocked = lockedIds.has("migrated-story-grid");
      if (!gridLocked) {
        els.push(makeStoryGridEl({
          id: "migrated-story-grid",
          x: 0, y,
          w: 716, zIndex: 5,
          columns: existingGrid?.columns ?? cols,
          headingText: existingGrid?.headingText ?? "TOP STORIES THIS MONTH",
          headingColor: existingGrid?.headingColor ?? bodyTextColor,
          cardBg: existingGrid?.cardBg ?? "rgba(255,255,255,0.12)",
          textColor: existingGrid?.textColor ?? bodyTextColor,
          stories: cardData,
        }));
      }

      // Estimate height so y advances correctly for elements placed below
      const gridEl = els.find((e) => e.id === "migrated-story-grid") as import("../../lib/story-types").CanvasStoryGridEl | undefined;
      const gridH = gridEl ? estimateStoryGridHeight(gridEl) : 400;
      if (gridLocked && existingGrid) {
        y = Math.max(y, existingGrid.y + gridH);
      } else {
        y += gridH;
      }
      y += STORY_GRID_TO_SECTION_GAP; // 2 cm after TOP STORIES before first story section

      // ── Individual story sections: divider → headline → image → body → CTA ──
      // Professional newsletter spacing:
      //   story divider (full-bleed, 1px) → 28px → headline → 14px → image → 20px → body → 24px → CTA → 28px
      storyItems.forEach(({ story }, si) => {

        // ── Story divider (full-width) ──────────────────────────────
        const exDiv = existingById.get(`migrated-sdiv-${si}`) as import("../../lib/story-types").CanvasDividerEl | undefined;
        if (!lockedIds.has(`migrated-sdiv-${si}`)) {
          els.push(makeDividerEl({
            id: `migrated-sdiv-${si}`,
            x: exDiv?.x ?? 0,
            y,
            w: exDiv?.w ?? 716,
            zIndex: 5,
            color: exDiv?.color ?? "rgba(60,140,130,0.35)",
            thickness: exDiv?.thickness ?? 2,
            lineStyle: exDiv?.lineStyle ?? "solid",
          }));
        }
        y += 28; // gap after divider to headline

        // ── Headline ────────────────────────────────────────────────
        if (story.title) {
          y = addText(`migrated-st-${si}`, `<p>${story.title}</p>`,
            { x: 28, w: 660, fontSize: 26, fontWeight: 700, textAlign: "left", color: bodyTextColor, lineHeight: 1.2 }, y, 10);
        }

        // ── Story image ─────────────────────────────────────────────
        const imgId = `migrated-si-${si}`;
        const existingImg = existingById.get(imgId) as import("../../lib/story-types").CanvasImageEl | undefined;
        const frame = normalizeStoryImageFrame(story.imageFrame);
        const imgW = existingImg?.w ?? 660;
        const imgH = storyFrameCanvasHeight(frame, imgW);
        // Prefer story imageUrl; fall back to existing canvas src (user may have uploaded manually)
        const imgSrc = story.imageUrl || existingImg?.src || "";
        if (!lockedIds.has(imgId)) {
          els.push(makeImageEl(imgSrc, {
            id: imgId,
            x: existingImg?.x ?? 28,
            y: preservePositions ? (existingImg?.y ?? y) : y,
            w: imgW,
            h: imgH,
            zIndex: 5,
            borderRadius: existingImg?.borderRadius ?? 8,
            objectFit: existingImg?.objectFit ?? frame.objectFit ?? "cover",
            objectPositionX: existingImg?.objectPositionX ?? frame.offsetX ?? 0,
            objectPositionY: existingImg?.objectPositionY ?? frame.offsetY ?? 0,
            imageZoom: existingImg?.imageZoom ?? frame.zoom ?? 1,
            shadow: existingImg?.shadow ?? false,
          }));
          y += imgH + 16;
        } else {
          y = yPastLocked(imgId, y + imgH + 16);
        }

        // ── Body text ───────────────────────────────────────────────
        const bodyHtml = story.body || (story.excerpt ? `<p>${story.excerpt}</p>` : "");
        if (bodyHtml.trim()) {
          y = addText(`migrated-sb-${si}`, bodyHtml,
            { x: 28, w: 660, fontSize: 16, textAlign: "left", color: bodyTextColor, lineHeight: 1.65 }, y, STORY_BODY_TO_CTA_GAP);
        } else {
          y += STORY_BODY_TO_CTA_GAP;
        }

        // ── CTA button ──────────────────────────────────────────────
        const ctaId = `migrated-cta-${si}`;
        const ctaHref = story.ctaUrl || story.sourceUrl || "";
        const ctaLabel = story.ctaLabel || "Read more →";
        if (!lockedIds.has(ctaId)) {
          const existingCta = existingById.get(ctaId) as import("../../lib/story-types").CanvasCtaEl | undefined;
          els.push(makeCtaEl({
            id: ctaId,
            x: existingCta?.x ?? 28,
            y,
            w: existingCta?.w ?? 200,
            zIndex: 5,
            label: ctaLabel,
            href: ctaHref,
            bgFrom: existingCta?.bgFrom ?? "#0e7490",
            bgTo: existingCta?.bgTo ?? "#10b981",
            textColor: existingCta?.textColor ?? "#ffffff",
            borderRadius: existingCta?.borderRadius ?? 50,
            fontSize: existingCta?.fontSize ?? 13,
            fontWeight: existingCta?.fontWeight ?? 700,
            letterSpacing: existingCta?.letterSpacing ?? 1.5,
          }));
        }
        y += 88; // CTA block + space below button before next divider
      });
    }

    return ensureMastheadZOrder(els);
  };

  const migrateToCanvas = () => {
    const els = buildCanvasElements(state);
    setState((prev) => ({
      ...prev,
      newsletterCanvas: { enabled: true, elements: els },
    }));
  };

  const resetAllPositions = () => {
    setState((prev) => {
      const styles = { ...prev.newsletterElementStyles };
      const keys = Object.keys(styles) as (keyof typeof styles)[];
      const resetStyles = Object.fromEntries(
        keys.map((k) => [k, { ...styles[k], offsetX: 0, offsetY: 0 }])
      ) as typeof styles;

      const resetImgTransforms = {
        topImage: { ...prev.newsletterImageTransforms.topImage, x: 0, y: 0 },
        logo: { ...prev.newsletterImageTransforms.logo, x: 0, y: 0 },
        portrait: { ...prev.newsletterImageTransforms.portrait, x: 0, y: 0 },
        hero: { ...prev.newsletterImageTransforms.hero, x: 0, y: 0 },
      };

      return {
        ...prev,
        newsletterElementStyles: resetStyles,
        newsletterImageTransforms: resetImgTransforms,
      };
    });
  };

  const saveStories = async (overrideState?: StoriesState) => {
    setStatus("Saving...");
    setSaveState("saving");
    const saveStarted = Date.now();
    // Always use stateRef to capture the absolute latest state, avoiding stale closures
    const current = overrideState ?? stateRef.current;
    const toSave = (() => {
      const merged = syncCanvasMastheadAssets({ ...current, newsletterBlocks: current.newsletterBlocks ?? [] });
      let n: StoriesState = merged;
      for (const b of merged.newsletterBlocks) {
        if ("sync" in b && b.sync) n = applyBlockToLegacyState(n, b);
      }
      return n;
    })();
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: toSave })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorMsg = payload?.error ? `Save failed: ${payload.error}` : `Save failed (${response.status}).`;
        throw new Error(errorMsg);
      }
      // Mark the localStorage draft as confirmed saved so we don't offer to restore it
      try {
        const savedAt = Date.now();
        localStorage.setItem(CANVAS_LS_SAVED_KEY, String(savedAt));
        if (toSave.newsletterCanvas?.enabled) {
          localStorage.setItem(CANVAS_LS_KEY, JSON.stringify({
            canvas: toSave.newsletterCanvas,
            savedAt,
          }));
        }
      } catch { /* ignore */ }
      const minSavingMs = 450;
      const elapsed = Date.now() - saveStarted;
      if (elapsed < minSavingMs) {
        await new Promise((resolve) => setTimeout(resolve, minSavingMs - elapsed));
      }
      setStatus("Saved!");
      setSaveState("saved");
      setTimeout(() => {
        setStatus("");
        setSaveState("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setStatus(message);
      setSaveState("idle");
      throw error;
    }
  };

  const createNewIssue = async () => {
    if (
      !window.confirm(
        "Create a new newsletter issue?\n\nStories clear and the issue title + CEO greeting reset. Masthead (banner, logo, portrait, hero) stays as on this issue. Other chrome uses your saved default layout when one exists.",
      )
    ) {
      return;
    }

    const previous = stateRef.current;
    storePreviousNewsletterIssue(previous);
    setStatus("Saving previous issue...");
    setSaveState("saving");
    try {
      const backupRes = await fetch("/api/newsletter/previous-issue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: previous }),
      });
      if (!backupRes.ok) {
        const payload = (await backupRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not save the current issue before creating a new one.");
      }
    } catch (err) {
      setSaveState("idle");
      setStatus(err instanceof Error ? err.message : "Could not save the current issue.");
      window.alert(
        "The current issue could not be backed up, so a new issue was not created. Try Save newsletter first, then Create new issue again.",
      );
      return;
    }

    const fresh = createFreshNewsletterIssueState(previous);
    setHasPreviousIssueBackup(true);
    stateRef.current = fresh;
    setState(fresh);
    setCampaignSubject("Maroma newsletter");
    setOpenDrawer(null);
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedBlockId(null);
    setShowAddBlockMenu(false);
    setAddStoryOpen(false);
    setStatus("Creating new issue...");
    try {
      localStorage.removeItem(CANVAS_LS_KEY);
      localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
    } catch {
      // ignore local draft cache failures
    }

    try {
      await saveStories(fresh);
      setStatus("New issue created. Delete this issue will restore the previous draft.");
    } catch {
      // saveStories sets the visible error state
    }
  };

  const saveCurrentLayoutAsDefault = async () => {
    if (
      !window.confirm(
        "Save the current newsletter layout as the default for future new issues?\n\nThis stores the current masthead, images, mission section, colours, spacing, and layout as the baseline used by Create new issue.",
      )
    ) {
      return;
    }

    const synced = syncCanvasMastheadAssets(stateRef.current);
    const next = {
      ...synced,
      newsletterIssueTemplate: captureFreshIssueTemplateState(synced),
    };
    stateRef.current = next;
    setState(next);
    setStatus("Saving default layout...");

    try {
      await saveStories(next);
      setStatus("Default layout saved.");
    } catch {
      // saveStories sets the visible error state
    }
  };

  const deleteCurrentIssue = async () => {
    let rawPrevious = loadPreviousNewsletterIssue();
    try {
      const res = await fetch("/api/newsletter/previous-issue");
      if (res.ok) {
        const data = (await res.json()) as { state?: StoriesState | null };
        if (data.state) rawPrevious = data.state;
      }
    } catch {
      // fall back to the browser copy
    }
    if (!rawPrevious) {
      window.alert(
        'No previous issue to restore. "Delete this issue" is available after you use Create new issue. It brings back the draft you had right before that.',
      );
      return;
    }

    if (
      !window.confirm(
        "Delete this issue and restore your previous draft?\n\nThe current issue (including any broken formatting) will be discarded and replaced with what you had before the last Create new issue.",
      )
    ) {
      return;
    }

    const restored = withCanvasStoryGaps(rawPrevious);
    stateRef.current = restored;
    setState(restored);
    setCampaignSubject(restored.newsletterTitle?.trim() || "Maroma newsletter");
    setOpenDrawer(null);
    setSelectedEditorTarget(null);
    setSelectedStoryEdit(null);
    setSelectedLayoutDividerId(null);
    setSelectedBlockId(null);
    setShowAddBlockMenu(false);
    setAddStoryOpen(false);
    setStatus("Restoring previous issue...");
    try {
      localStorage.removeItem(CANVAS_LS_KEY);
      localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
    } catch {
      // ignore
    }

    try {
      await saveStories(restored);
      clearPreviousNewsletterIssue();
      await fetch("/api/newsletter/previous-issue", { method: "DELETE" }).catch(() => null);
      setHasPreviousIssueBackup(false);
      setStatus("Previous issue restored.");
    } catch {
      // saveStories sets the visible error state
    }
  };

  const restoreArchiveIssue = async (month?: string) => {
    const slug = month ? "" : restoreArchiveSlug.trim();
    if (
      !window.confirm(
        month
          ? `Replace the editor with the ${month} issue (including test sends and the previous draft)? The current draft will be saved so Delete this issue can bring it back.`
          : slug
          ? "Replace the editor with that issue? The current draft will be saved so Delete this issue can bring it back."
          : "Restore the latest sent or test issue into the editor? The current draft will be saved so Delete this issue can bring it back.",
      )
    ) {
      return;
    }

    setStatus(month ? `Restoring ${month} issue...` : "Restoring sent issue...");
    setSaveState("saving");
    try {
      const res = await fetch("/api/newsletter/restore-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(month ? { month } : { slug: slug || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { state?: StoriesState; error?: string } | null;
      if (!res.ok || !data?.state) {
        throw new Error(data?.error || "Could not restore that issue.");
      }
      const restored = withCanvasStoryGaps(data.state);
      stateRef.current = restored;
      setState(restored);
      setCampaignSubject(restored.newsletterTitle?.trim() || "Maroma newsletter");
      setHasPreviousIssueBackup(true);
      setSelectedEditorTarget(null);
      setSelectedStoryEdit(null);
      setSelectedLayoutDividerId(null);
      setSelectedBlockId(null);
      try {
        localStorage.removeItem(CANVAS_LS_KEY);
        localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      setSaveState("saved");
      setStatus("Sent issue restored into the editor.");
    } catch (err) {
      setSaveState("idle");
      setStatus(err instanceof Error ? err.message : "Could not restore that issue.");
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
        selectedListId: string | null;
        selectedListName: string | null;
        mailingLists: NewsletterMailingListSummary[];
        campaigns: NewsletterCampaignSummary[];
        envHints: {
          postmarkConfigured: boolean;
          fromEmailConfigured: boolean;
          trackingSecretConfigured: boolean;
          siteUrlConfigured: boolean;
          fromAddress: string;
          messageStream: string;
          readyToSend: boolean;
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
      setState(refreshStorySnapshotsInBlocks(payload.state));
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
      setState(refreshStorySnapshotsInBlocks(payload.state));
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
      setState(refreshStorySnapshotsInBlocks(payload.state));
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

  const applyRichPourFromEditor = () => {
    const editor = richPourRef.current;
    if (!editor) return;
    const html = editor.innerHTML.trim();
    if (!html) {
      setRichPourStatus("Paste some text first, then click Apply.");
      return;
    }
    try {
      // In canvas mode always replace stories so the pour order (= document order) is respected.
      // In classic mode honour the user's replace/append toggle.
      const { next: rawNext, summary } = applyRichTextPour(html, state, {
        replaceStories: state.newsletterCanvas.enabled ? true : richPourReplace,
      });
      const next = (rawNext.newsletterBlocksMigrationVersion ?? 0) >= 1 ? refreshStorySnapshotsInBlocks(rawNext) : rawNext;

      // When canvas mode is active, rebuild canvas elements from poured content.
      // Pass existing elements for style preservation (colors, fonts) but NOT positions —
      // auto-reflow may have moved elements, and pour should always produce a clean layout.
      if (state.newsletterCanvas.enabled) {
        const canvasEls = buildCanvasElements(next, state.newsletterCanvas.elements, false);
        setState({ ...next, newsletterCanvas: { enabled: true, elements: canvasEls } });
        setRichPourStatus(`${summary}. Canvas updated.`);
      } else {
        setState(next);
        setRichPourStatus(summary);
      }
      setStatus("Rich text pour applied. Review and click Save newsletter.");
      editor.innerHTML = "";
    } catch {
      setRichPourStatus("Could not parse pasted content.");
    }
  };

  const clearRichPourEditor = () => {
    if (richPourRef.current) richPourRef.current.innerHTML = "";
    setRichPourStatus("");
  };

  const handleRichPourPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData("text/html");
    if (html) {
      event.preventDefault();
      const sanitized = sanitizeRichPourHtml(html);
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        if (richPourRef.current) richPourRef.current.innerHTML += sanitized;
        return;
      }
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(sanitized);
      range.insertNode(fragment);
      range.collapse(false);
      if (richPourRef.current) {
        normalizeRichPourEditorContent(richPourRef.current);
      }
      richPourRef.current?.focus();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    // Preserve blank lines as empty <p>s so story-title detection can see section breaks.
    const asHtml = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => (line.trim() ? `<p>${escapeHtml(line.trim())}</p>` : "<p></p>"))
      .join("");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      if (richPourRef.current) richPourRef.current.innerHTML += asHtml;
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(asHtml);
    range.insertNode(fragment);
    range.collapse(false);
    if (richPourRef.current) {
      normalizeRichPourEditorContent(richPourRef.current);
    }
    richPourRef.current?.focus();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const handleMailingListFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const listName = newListName.trim();
    if (!listName) {
      setDeliveryStatus("Enter a list name before uploading CSV.");
      event.target.value = "";
      return;
    }
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
        body: JSON.stringify({ listName, subscribers: rows })
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "merge failed");
      }
      const payload = (await response.json()) as {
        listName: string;
        added: number;
        updated: number;
        importedRows: number;
        activeSubscribers: number;
      };
      await refreshAudience();
      setDeliveryStatus(
        `Imported ${payload.importedRows} row(s) into "${payload.listName}": ${payload.added} new contacts, ${payload.updated} updated. Active in list: ${payload.activeSubscribers}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload mailing list.";
      setDeliveryStatus(message);
    }
    event.target.value = "";
  };

  const handleMailingListSelect = async (listId: string) => {
    if (!listId || listId === audienceInfo?.selectedListId) return;
    setDeliveryStatus("Switching mailing list…");
    try {
      const response = await fetch("/api/newsletter/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedListId: listId }),
      });
      if (!response.ok) throw new Error("select failed");
      await refreshAudience();
      const payload = (await response.json()) as { selectedListName?: string; activeSubscribers?: number };
      setDeliveryStatus(
        `Campaign list set to "${payload.selectedListName ?? "list"}". Active: ${payload.activeSubscribers ?? 0}.`
      );
    } catch {
      setDeliveryStatus("Could not switch mailing list.");
    }
  };

  const hostNewsletterImages = async () => {
    setDeliveryStatus("Hosting newsletter images for email…");
    try {
      await saveStories();
      const response = await fetch("/api/admin/migrate-canvas-to-firebase", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        urlsFound?: number;
        migrated?: number;
        skipped?: number;
        failed?: number;
        saved?: boolean;
      };
      if (!response.ok) {
        setDeliveryStatus(payload.error ?? `Image hosting failed (${response.status}).`);
        return;
      }
      setDeliveryStatus(
        `Hosted images: found ${payload.urlsFound ?? 0}, uploaded ${payload.migrated ?? 0}, already public ${payload.skipped ?? 0}, failed ${payload.failed ?? 0}. Reloading…`
      );
      try {
        localStorage.removeItem(CANVAS_LS_KEY);
        localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
      } catch { /* ignore */ }
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image hosting failed.";
      setDeliveryStatus(message);
    }
  };

  const sendTestNewsletter = async () => {
    const raw = formatEmailList(testMailingList);
    if (!raw) {
      setDeliveryStatus("Add at least one address to your test mailing list.");
      return;
    }
    setSendingTest(true);
    setTestSent(false);
    setDeliveryStatus("Sending test…");
    try {
      await saveStories();
      const response = await fetch("/api/newsletter/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: campaignSubject,
          testOnly: true,
          testEmails: raw,
          storySpacingGaps: storyGaps,
        }),
      });
      const rawText = await response.text();
      let payload: {
        error?: string;
        sentTo?: string | string[];
        messageIds?: { email: string; messageId?: string }[];
        htmlBytes?: number;
        from?: string;
        hint?: string;
        failures?: { email: string; message: string }[];
      };
      try {
        payload = JSON.parse(rawText) as typeof payload;
      } catch {
        setDeliveryStatus(
          response.ok
            ? "Send returned non-JSON. Try signing in again as admin."
            : `Send failed (${response.status}): ${rawText.slice(0, 200)}`,
        );
        return;
      }
      if (!response.ok) {
        const detail = payload.failures?.[0]?.message;
        const msg = detail
          ? `${payload.error ?? "Test send failed."}: ${detail}`
          : (payload.error ?? `Test send failed (${response.status}).`);
        setDeliveryStatus(
          response.status === 401
            ? `${msg} Sign in as admin and try again.`
            : msg,
        );
        return;
      }
      const sent = Array.isArray(payload.sentTo)
        ? payload.sentTo
        : payload.sentTo
          ? [payload.sentTo]
          : [];
      const ids = (payload.messageIds ?? [])
        .filter((m) => m.messageId)
        .map((m) => `${m.messageId}`)
        .join(", ");
      const failDetail = payload.failures?.map((f) => `${f.email}: ${f.message}`).join("; ");
      const parts = [
        "Newsletter test",
        `accepted for ${sent.join(", ")}.`,
        payload.from ? `From: ${payload.from}.` : "",
        ids ? `Postmark ID: ${ids}.` : "",
        payload.htmlBytes ? `HTML size: ${Math.round(payload.htmlBytes / 1024)} KB.` : "",
        "Check Gmail Spam/Promotions and Postmark Activity (Delivered vs Bounced).",
        failDetail ? `Failed: ${failDetail}` : "",
      ].filter(Boolean);
      setDeliveryStatus(parts.join(" "));
      setTestSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test send request failed.";
      setDeliveryStatus(message.includes("Save failed") ? message : `Test send request failed. ${message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const updateTestMailingList = useCallback((emails: string[]) => {
    const normalized = parseEmailList(emails.join(", "));
    setTestMailingList(normalized);
    saveTestMailingList(normalized);
  }, []);

  const addTestMailingEmail = () => {
    const email = newTestEmail.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      setDeliveryStatus("Enter a valid email address to add to the test list.");
      return;
    }
    if (testMailingList.includes(email)) {
      setNewTestEmail("");
      return;
    }
    updateTestMailingList([...testMailingList, email]);
    setNewTestEmail("");
  };

  const removeTestMailingEmail = (email: string) => {
    updateTestMailingList(testMailingList.filter((e) => e !== email));
  };

  const sendNewsletterCampaign = async () => {
    const listName = audienceInfo?.selectedListName ?? "selected list";
    const active = audienceInfo?.activeSubscribers ?? 0;
    if (
      !window.confirm(
        `Send campaign to "${listName}" (${active} active subscriber${active === 1 ? "" : "s"})? This cannot be undone.`
      )
    ) {
      return;
    }
    setSendingCampaign(true);
    setCampaignSent(false);
    setDeliveryStatus("Sending campaign...");
    try {
      await saveStories();
      const response = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: campaignSubject,
          storySpacingGaps: storyGaps,
          mailingListId: audienceInfo?.selectedListId ?? undefined,
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        campaignId?: string;
        attempted?: number;
        sentOk?: number;
        mailingListName?: string;
        failures?: { email: string; message: string }[];
      };
      if (!response.ok) {
        setDeliveryStatus(payload.error ?? "Send failed.");
        return;
      }
      await refreshAudience();
      const fails = payload.failures?.length ? ` Failures: ${payload.failures.length}.` : "";
      const listLabel = payload.mailingListName ? ` to "${payload.mailingListName}"` : "";
      setDeliveryStatus(
        `Campaign ${payload.campaignId?.slice(0, 8) ?? ""}... sent ${payload.sentOk ?? 0} / ${payload.attempted ?? 0}${listLabel}.${fails}`
      );
      setCampaignSent(true);
    } catch {
      setDeliveryStatus("Send request failed.");
    } finally {
      setSendingCampaign(false);
    }
  };

  const handleBriefImageUpload =
    (index: number) =>
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.78,
          forceJpeg: true
        });
        setState((prev) => {
          const arr = (prev.executiveBriefImageOverrides ?? ["", "", ""]).slice();
          while (arr.length < 3) arr.push("");
          arr[index] = dataUrl;
          return { ...prev, executiveBriefImageOverrides: arr };
        });
        setStatus("Image loaded. Click Save newsletter.");
      } catch {
        setStatus("Could not load image. Try JPG or PNG.");
      }
      event.target.value = "";
    };

  const clearBriefImageOverride = (index: number) => {
    setState((prev) => {
      const arr = (prev.executiveBriefImageOverrides ?? ["", "", ""]).slice();
      while (arr.length < 3) arr.push("");
      arr[index] = "";
      return { ...prev, executiveBriefImageOverrides: arr };
    });
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
    setState((prev) => {
      const stories = prev.stories.map((story) =>
        story.id === id ? { ...story, ...patch, updatedAt: new Date().toISOString() } : story
      );
      let next: StoriesState = { ...prev, stories };
      if ((next.newsletterBlocksMigrationVersion ?? 0) >= 1) {
        const merged = stories.find((s) => s.id === id);
        if (merged && merged.kind !== "divider" && merged.kind !== "text") {
          next = {
            ...next,
            newsletterBlocks: (next.newsletterBlocks ?? []).map((b) => {
              if (b.kind !== "story" || b.storyId !== id) return b;
              const rebuilt = storyToBlock(merged);
              return {
                ...rebuilt,
                snapshot: {
                  ...rebuilt.snapshot,
                  imageTransform: b.snapshot.imageTransform
                }
              };
            })
          };
        }
      }
      if (next.newsletterCanvas?.enabled) {
        let storyCanvasIndex = -1;
        for (const story of stories) {
          if (story.kind === "divider" || story.kind === "text") continue;
          storyCanvasIndex += 1;
          if (story.id !== id) continue;
          const canvasImageId = `migrated-si-${storyCanvasIndex}`;
          const frame = normalizeStoryImageFrame(story.imageFrame);
          next = {
            ...next,
            newsletterCanvas: {
              ...next.newsletterCanvas,
              elements: (next.newsletterCanvas.elements ?? []).map((el) => {
                if (el.kind !== "image" || el.id !== canvasImageId) return el;
                const width = el.w || 660;
                return {
                  ...el,
                  src: story.imageUrl || el.src,
                  h: storyFrameCanvasHeight(frame, width),
                  objectFit: frame.objectFit ?? "cover",
                  objectPositionX: frame.offsetX ?? 0,
                  objectPositionY: frame.offsetY ?? 0,
                  imageZoom: frame.zoom ?? 1,
                };
              }),
            },
          };
          break;
        }
      }
      return next;
    });
  };

  const handleStoryImageUpload = (storyId: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setStatus(files.length > 1 ? `Loading ${files.length} images…` : "Loading image…");
    try {
      const dataUrls: string[] = [];
      for (const file of files) {
        try {
          const dataUrl = await fileToDataUrl(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.78,
            forceJpeg: true
          });
          if (dataUrl) dataUrls.push(dataUrl);
        } catch {
          // skip invalid file
        }
      }
      if (dataUrls.length === 0) {
        setStatus("Could not load image(s). Try JPG or PNG.");
        return;
      }
      const nextImages = dataUrls.slice(0, 12);
      updateStory(storyId, { images: nextImages, imageUrl: nextImages[0] ?? "" });
      setStatus(
        nextImages.length > 1
          ? `${nextImages.length} images loaded. Montage layout. Click Save newsletter.`
          : "Story image loaded. Click Save newsletter."
      );
    } catch {
      setStatus("Could not load image(s). Try JPG or PNG.");
    }
    event.target.value = "";
  };

  const removeStoryImageAt = (storyId: string, index: number) => {
    const story = state.stories.find((s) => s.id === storyId);
    if (!story) return;
    const list = Array.isArray(story.images) && story.images.length > 0
      ? [...story.images]
      : story.imageUrl
        ? [story.imageUrl]
        : [];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    updateStory(storyId, { images: list, imageUrl: list[0] ?? "" });
  };

  const moveStoryImage = (storyId: string, index: number, direction: -1 | 1) => {
    const story = state.stories.find((s) => s.id === storyId);
    if (!story) return;
    const list = Array.isArray(story.images) && story.images.length > 0
      ? [...story.images]
      : story.imageUrl
        ? [story.imageUrl]
        : [];
    const target = index + direction;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    updateStory(storyId, { images: list, imageUrl: list[0] ?? "" });
  };

  const insertDividerNearStory = (storyId: string, position: "before" | "after") => {
    setState((prev) => {
      const idx = prev.stories.findIndex((s) => s.id === storyId);
      if (idx < 0) return prev;
      const insertAt = position === "before" ? idx : idx + 1;
      const next = [...prev.stories];
      next.splice(insertAt, 0, emptyDivider());
      return { ...prev, stories: next };
    });
    setStatus(`Divider inserted ${position} story.`);
  };

  const insertTextBlockNearStory = (storyId: string, position: "before" | "after") => {
    const block = emptyTextBlock();
    setState((prev) => {
      const idx = prev.stories.findIndex((s) => s.id === storyId);
      if (idx < 0) return prev;
      const insertAt = position === "before" ? idx : idx + 1;
      const next = [...prev.stories];
      next.splice(insertAt, 0, block);
      return { ...prev, stories: next };
    });
    setSelectedStoryEdit({ storyId: block.id, field: "body" });
    setStatus(`Text block inserted ${position} story. Click to edit.`);
  };

  const insertTextBlockAtEnd = () => {
    const block = emptyTextBlock();
    setState((prev) => ({ ...prev, stories: [...prev.stories, block] }));
    setSelectedStoryEdit({ storyId: block.id, field: "body" });
    setStatus("Text block added. Click the body to edit.");
  };

  const insertImageStoryAtEnd = () => {
    const block = emptyStory();
    setState((prev) => ({ ...prev, stories: [...prev.stories, block] }));
    setSelectedEditorTarget(null);
    setSelectedLayoutDividerId(null);
    setSelectedStoryEdit({ storyId: block.id, field: "image" });
    setActiveLayoutSection("stories");
    setStatus("Pick one or more images for the new image block…");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => storyImageUploadRef.current?.click());
    }
  };

  const moveStory = (storyId: string, direction: -1 | 1) => {
    setState((prev) => {
      const idx = prev.stories.findIndex((s) => s.id === storyId);
      if (idx < 0) return prev;
      const target = idx + direction;
      const stories = [...prev.stories];
      if (target >= 0 && target < stories.length) {
        const [item] = stories.splice(idx, 1);
        stories.splice(target, 0, item);
      }
      let newsletterBlocks = prev.newsletterBlocks ?? [];
      const isModular = (prev.newsletterBlocksMigrationVersion ?? 0) >= 1 && newsletterBlocks.length > 0;
      if (isModular) {
        const myBlockIdx = newsletterBlocks.findIndex((b) => b.kind === "story" && b.storyId === storyId);
        if (myBlockIdx >= 0) {
          const storyBlockIndices = newsletterBlocks
            .map((b, i) => (b.kind === "story" ? i : -1))
            .filter((i) => i >= 0);
          const positionInStoryList = storyBlockIndices.indexOf(myBlockIdx);
          const swapWithStoryPos = positionInStoryList + direction;
          if (swapWithStoryPos >= 0 && swapWithStoryPos < storyBlockIndices.length) {
            const swapIdx = storyBlockIndices[swapWithStoryPos];
            const blocks = [...newsletterBlocks];
            const [moved] = blocks.splice(myBlockIdx, 1);
            const adjustedSwapIdx = swapIdx > myBlockIdx ? swapIdx - 1 : swapIdx;
            const insertAt = direction === 1 ? adjustedSwapIdx + 1 : adjustedSwapIdx;
            blocks.splice(insertAt, 0, moved);
            newsletterBlocks = blocks;
          }
        }
      }
      return { ...prev, stories, newsletterBlocks };
    });
  };

  const issueHeadingStyle: React.CSSProperties = {
    fontFamily: state.newsletterElementStyles.issueHeading.fontFamily,
    fontSize: `${state.newsletterElementStyles.issueHeading.fontSizeRem}rem`,
    textAlign: state.newsletterElementStyles.issueHeading.textAlign,
    fontWeight: state.newsletterElementStyles.issueHeading.fontWeight,
    color: legacyInkColor("issueHeading"),
    transform: `translate(${state.newsletterElementStyles.issueHeading.offsetX ?? 0}px, ${state.newsletterElementStyles.issueHeading.offsetY ?? 0}px)`,
  };

  return (
    <main className="newsletter-page">
      {renderStoryEditPortal()}
      {renderLayoutDividerPortal()}
      <section
        ref={newsletterShellRef}
        className={`newsletter-shell ${state.newsletterTextAlign === "left" ? "is-align-left" : "is-align-center"}${canEdit ? " is-preview" : ""}${state.newsletterCanvas?.enabled ? " newsletter-shell--canvas" : ""} newsletter-font-${state.newsletterFontFamily ?? "serif"}`}
        style={
          {
            "--newsletter-section-heading-size": `${state.newsletterSectionHeadingSizeRem ?? 0.86}rem`,
            "--newsletter-issue-heading-size": `${state.newsletterIssueHeadingSizeRem ?? 3}rem`,
            "--newsletter-body-font-size": `${state.newsletterBodyFontSizeRem ?? 1.04}rem`,
            "--newsletter-bg": state.newsletterBackgroundColor || "#10151c",
            "--newsletter-ink": newsletterInk,
            background: state.newsletterBackgroundColor || undefined,
            color: newsletterInk
          } as Record<string, string>
        }
      >
        {canEdit && showGlobalControls ? (
          <div className="newsletter-top-tools">
          <strong className="newsletter-side-panel-title">Admin</strong>
          <div className="newsletter-inline-toolbar">
            <div className="newsletter-primary-action-stack">
              <button
                type="button"
                className={`button primary newsletter-save-button${saveState === "saved" ? " is-saved" : saveState === "saving" ? " is-saving" : ""}`}
                onClick={() => void saveStories()}
                disabled={saveState === "saving"}
              >
                {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save newsletter"}
              </button>
            </div>
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
            {!state.newsletterCanvas?.enabled && (
              <button
                type="button"
                className="button secondary"
                title="Convert your existing newsletter into a free-position canvas. All images and text are pre-placed"
                onClick={() => {
                  if (window.confirm("Convert your current newsletter content to canvas mode?\n\nAll your images, text, and stories will be placed on the canvas. You can then drag and resize everything freely.\n\nThis won't delete your classic layout. You can switch back anytime.")) {
                    migrateToCanvas();
                  }
                }}
              >
                Convert to canvas ✦
              </button>
            )}
            {status ? <p className="admin-status">{status}</p> : null}
          </div>

        {openDrawer ? (
          <div className="newsletter-tool-drawer">
            <div className="newsletter-tool-drawer-head">
              <strong>
                {openDrawer === "settings" ? "Newsletter settings" : null}
                {openDrawer === "tools" ? "Story imports" : null}
                {openDrawer === "delivery" ? "Delivery & metrics" : null}
                {openDrawer === "spacing" ? "Story spacing" : null}
              </strong>
              <button type="button" className="button secondary" onClick={() => setOpenDrawer(null)}>
                Close
              </button>
            </div>

            {openDrawer === "delivery" ? (
              <>
                <div className="newsletter-send-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={sendingTest || sendingCampaign}
                    onClick={() => void hostNewsletterImages()}
                  >
                    Host images for email
                  </button>
                  <button
                    type="button"
                    className={`button newsletter-test-send${sendingTest ? " is-sending" : ""}${testSent ? " is-sent" : ""}`}
                    disabled={sendingTest || testMailingList.length === 0}
                    onClick={() => void sendTestNewsletter()}
                  >
                    {sendingTest ? "Sending" : testSent ? "Sent!" : "Send newsletter test"}
                  </button>
                  <button
                    type="button"
                    className={`button newsletter-campaign-send${sendingCampaign ? " is-sending" : ""}${campaignSent ? " is-sent" : ""}`}
                    disabled={sendingCampaign}
                    onClick={() => void sendNewsletterCampaign()}
                  >
                    {sendingCampaign ? "Sending" : campaignSent ? "Sent!" : "Send campaign now"}
                  </button>
                </div>
                <details className="newsletter-test-list-details" open={testMailingList.length === 0}>
                  <summary className="newsletter-test-list-summary">
                    Test mailing list
                    {testMailingList.length > 0 ? (
                      <span className="newsletter-test-list-count">{testMailingList.length}</span>
                    ) : null}
                  </summary>
                  <div className="newsletter-test-list">
                    <p className="admin-rss-hint">
                      Saved in this browser. These addresses receive Send newsletter test.
                    </p>
                    {testMailingList.length > 0 ? (
                      <ul className="newsletter-test-list-chips">
                        {testMailingList.map((email) => (
                          <li key={email}>
                            <span>{email}</span>
                            <button
                              type="button"
                              className="newsletter-test-list-remove"
                              aria-label={`Remove ${email}`}
                              onClick={() => removeTestMailingEmail(email)}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="admin-rss-hint">No test addresses yet. Add yours below.</p>
                    )}
                    <div className="newsletter-test-list-add">
                      <input
                        type="email"
                        value={newTestEmail}
                        placeholder="you@example.com"
                        onChange={(e) => setNewTestEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTestMailingEmail();
                          }
                        }}
                      />
                      <button type="button" className="button secondary" onClick={addTestMailingEmail}>
                        Add
                      </button>
                    </div>
                  </div>
                </details>
                {deliveryStatus ? <p className="admin-status newsletter-send-status">{deliveryStatus}</p> : null}
              </>
            ) : null}

            {openDrawer === "settings" ? (
              <div className="newsletter-tool-drawer-body">
                <section>
                  <h3>Issue lifecycle</h3>
                  <p className="admin-rss-hint">
                    Start a fresh issue: stories are cleared and the title/greeting reset to placeholders. Masthead images, mission, colours, and layout stay unchanged.
                    The previous draft is saved on the server, so Delete this issue still works after a refresh or on another computer.
                    Test sends are also saved privately so you can restore them; they do not appear on the public archive.
                  </p>
                  <div className="newsletter-issue-lifecycle-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void createNewIssue()}
                      disabled={saveState === "saving"}
                    >
                      Create new issue
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void saveCurrentLayoutAsDefault()}
                      disabled={saveState === "saving"}
                      title="Save the current masthead, mission, images, and layout as the default baseline for future new issues"
                    >
                      Save as default layout
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void deleteCurrentIssue()}
                      disabled={saveState === "saving" || !hasPreviousIssueBackup}
                    >
                      Delete this issue
                    </button>
                  </div>
                  {archiveIssues.length > 0 ? (
                    <div className="newsletter-issue-lifecycle-actions" style={{ marginTop: 12 }}>
                      <label>
                        Restore a sent or test issue
                        <select
                          value={restoreArchiveSlug}
                          onChange={(e) => setRestoreArchiveSlug(e.target.value)}
                        >
                          {archiveIssues.map((issue) => (
                            <option key={issue.slug} value={issue.slug}>
                              {issue.testOnly ? "[TEST] " : ""}
                              {issue.subject} — {formatStoryDate(issue.sentAt)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void restoreArchiveIssue()}
                        disabled={saveState === "saving" || !restoreArchiveSlug}
                      >
                        Restore into editor
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void restoreArchiveIssue("july")}
                        disabled={saveState === "saving"}
                      >
                        Restore July issue
                      </button>
                    </div>
                  ) : (
                    <div className="newsletter-issue-lifecycle-actions" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void restoreArchiveIssue("july")}
                        disabled={saveState === "saving"}
                      >
                        Restore July issue
                      </button>
                    </div>
                  )}
                </section>
                <label className="newsletter-bg-color-control" title="Background color">
                  Background
                  <div className="newsletter-bg-color-row">
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
                  </div>
                </label>
                <label>
                  Body font
                  <select
                    value={state.newsletterFontFamily ?? "serif"}
                    onChange={(e) => {
                      const v = e.target.value;
                      const allowed = ["serif", "sans", "montserrat-light", "raleway-light", "josefin-light"] as const;
                      const next = (allowed as readonly string[]).includes(v) ? (v as (typeof allowed)[number]) : "serif";
                      setState((prev) => ({ ...prev, newsletterFontFamily: next }));
                    }}
                  >
                    <option value="serif">Cormorant Garamond (serif)</option>
                    <option value="sans">Montserrat (regular)</option>
                    <option value="montserrat-light">Montserrat Light</option>
                    <option value="raleway-light">Raleway ExtraLight</option>
                    <option value="josefin-light">Josefin Sans Light</option>
                  </select>
                </label>
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
                  Fallback intro (legacy; used only when greeting is empty)
                  <textarea
                    rows={2}
                    value={state.newsletterIntro}
                    onChange={(e) => setState((prev) => ({ ...prev, newsletterIntro: e.target.value }))}
                    placeholder="Used only if greeting is empty."
                  />
                </label>
                <section>
                  <h3>Element positions</h3>
                  <p className="admin-rss-hint">
                    Zero out all nudge X/Y offsets on every image and text element so edit and public views match.
                    Zoom and style settings are kept.
                  </p>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Reset all element positions to zero? This clears all nudge X/Y values. Zoom and style settings are kept.",
                        )
                      ) {
                        resetAllPositions();
                      }
                    }}
                  >
                    Reset positions
                  </button>
                </section>
              </div>
            ) : null}

            {openDrawer === "tools" ? (
              <div className="newsletter-tool-drawer-body">
                <section>
                  <h3>Rich text pour</h3>
                  <p className="admin-rss-hint">
                    Paste from Word, Google Docs, a webpage, or an email.
                    Headings and <strong>bold text on its own line</strong> start new stories.
                    Headings named <code>Mission</code> or <code>Greeting</code> fill those slots.
                    Images in the paste are attached to the story above them.
                  </p>
                  <div
                    ref={richPourRef}
                    className="newsletter-rich-pour-editor"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Paste your newsletter content here…"
                    onFocus={(event) => normalizeRichPourEditorContent(event.currentTarget)}
                    onInput={(event) => normalizeRichPourEditorContent(event.currentTarget)}
                    onPaste={handleRichPourPaste}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button type="button" className="button primary" onClick={applyRichPourFromEditor}>
                      Apply rich text pour
                    </button>
                    <button type="button" className="button secondary" onClick={clearRichPourEditor}>
                      Clear
                    </button>
                  </div>
                  {richPourStatus ? <p className="admin-status">{richPourStatus}</p> : null}
                </section>
              </div>
            ) : null}

            {openDrawer === "delivery" ? (
              <div className="newsletter-tool-drawer-body">
                <section>
                  <h3>Audience</h3>
                  {audienceInfo ? (
                    <>
                      <label>
                        Campaign mailing list
                        <select
                          value={audienceInfo.selectedListId ?? ""}
                          onChange={(e) => void handleMailingListSelect(e.target.value)}
                        >
                          {audienceInfo.mailingLists.length === 0 ? (
                            <option value="">No lists yet</option>
                          ) : (
                            audienceInfo.mailingLists.map((list) => (
                              <option key={list.id} value={list.id}>
                                {list.name} ({list.activeCount} active / {list.totalCount})
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                      <p className="admin-rss-hint">
                        <strong>{audienceInfo.selectedListName ?? "No list selected"}</strong>{" "}
                        <strong>{audienceInfo.activeSubscribers}</strong> active / {audienceInfo.totalSubscribers} total
                        for Send campaign now.
                      </p>
                      <p className="admin-rss-hint">
                        <strong>Postmark:</strong>{" "}
                        {audienceInfo.envHints.postmarkConfigured ? "token set" : "POSTMARK_SERVER_TOKEN missing"}
                        {" · "}
                        <strong>From:</strong> {audienceInfo.envHints.fromAddress}
                        {" · "}
                        <strong>Stream:</strong> {audienceInfo.envHints.messageStream}
                      </p>
                      {!audienceInfo.envHints.readyToSend ? (
                        <p className="admin-status admin-status--warn">
                          Cannot send until Vercel has POSTMARK_SERVER_TOKEN, NEWSLETTER_FROM_EMAIL (verified sender), and NEWSLETTER_TRACKING_SECRET. Redeploy after adding vars.
                        </p>
                      ) : (
                        <p className="admin-rss-hint">Email env ready. Check Postmark Activity if tests do not arrive.</p>
                      )}
                      {!audienceInfo.envHints.trackingSecretConfigured ? (
                        <p className="admin-status admin-status--warn">NEWSLETTER_TRACKING_SECRET missing on server.</p>
                      ) : null}
                      {!audienceInfo.envHints.fromEmailConfigured ? (
                        <p className="admin-status admin-status--warn">NEWSLETTER_FROM_EMAIL missing or invalid on Vercel. Set to production@miraculousmedia.in (your verified Postmark sender).</p>
                      ) : null}
                      {!audienceInfo.envHints.siteUrlConfigured ? (
                        <p className="admin-rss-hint">Optional: set NEXT_PUBLIC_SITE_URL for tracking links behind proxies.</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="admin-rss-hint">Loading audience…</p>
                  )}
                  <label>
                    Add mailing list (CSV / TSV)
                    <input
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. VIP customers, March launch"
                    />
                  </label>
                  <input
                    ref={mailingListRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleMailingListFile}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="button secondary" onClick={() => mailingListRef.current?.click()}>
                    Upload CSV to list
                  </button>
                  <p className="admin-rss-hint">
                    Name the list, upload a CSV, then pick it from the dropdown. Re-uploading the same list name adds
                    addresses to that list.
                  </p>
                </section>

                <section>
                  <h3>Send campaign</h3>
                  <label>
                    Email subject
                    <input value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} />
                  </label>
                  <p className="admin-rss-hint">
                    Subject is prefixed with [TEST] for test sends. Check Postmark Activity for the MessageID if nothing arrives.
                  </p>
                </section>

                <section>
                  <h3>Recent campaigns</h3>
                  <div className="newsletter-campaigns-table-wrap">
                    <table className="newsletter-campaigns-table">
                      <thead>
                        <tr>
                          <th>Sent</th>
                          <th>Subject</th>
                          <th>To</th>
                          <th>Opens</th>
                          <th>Clicks</th>
                          <th>Unsub</th>
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
                              <td>
                                {new Date(c.sentAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td>{c.subject}</td>
                              <td>{c.recipientCount}</td>
                              <td>{c.uniqueOpens}</td>
                              <td>
                                {c.totalClicks}
                                {c.uniqueClickers > 0 ? ` (${c.uniqueClickers})` : ""}
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

            {openDrawer === "spacing" ? (
              <div className="newsletter-tool-drawer-body">
                <StorySpacingControls
                  inline
                  gaps={storyGaps}
                  onChange={setStoryGaps}
                  onApply={() => {
                    requestAnimationFrame(() => canvasRef.current?.compactSpacing(storyGaps));
                  }}
                />
              </div>
            ) : null}
          </div>
          ) : null}
          </div>
        ) : null}

        {state.newsletterCanvas?.enabled ? (
          <>
            <NewsletterCanvas
              ref={canvasRef}
              canvas={state.newsletterCanvas}
              canEdit={!!canEdit}
              storySpacingGaps={storyGaps}
              onChange={(canvas) =>
                setState((prev) => ({
                  ...prev,
                  newsletterCanvas: {
                    ...canvas,
                    storySpacingGaps:
                      prev.newsletterCanvas?.storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS,
                  },
                }))
              }
              onSave={canEdit ? saveStories : undefined}
            />
          </>
        ) : (<>
        {renderLayoutDividers("logo", "before")}
        <div className="newsletter-editable-row">
          <div className="newsletter-asset-row newsletter-logo-row">
          <div
            className={`newsletter-logo-wrap${canTransformImages && selectedEditorTarget === "logoImage" ? " newsletter-edit-selected" : ""}`}
            onClick={canTransformImages ? () => selectBlock("logoImage") : undefined}
            style={{
              position: "relative",
              zIndex: state.newsletterImageTransforms.logo.zIndex ?? 0,
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
            {canTransformImages ? (
              <div className="newsletter-image-quick-actions">
                <button
                  type="button"
                  className="newsletter-image-upload-overlay"
                  onClick={(e) => { e.stopPropagation(); logoUploadRef.current?.click(); }}
                  title="Replace logo"
                >
                  Replace
                </button>
              </div>
            ) : null}
          </div>
          </div>
          {renderInlineControls("logoImage")}
        </div>
        {renderLayoutDividers("logo", "after")}

        {renderLayoutDividers("topImage", "before")}
        {topImageSrc || canEdit ? (
          <div className="newsletter-editable-row">
            <div className="newsletter-asset-row newsletter-top-image-row">
              <div
                className={`newsletter-top-image-wrap${topImageSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "topImage" ? " newsletter-edit-selected" : ""}`}
                onClick={canTransformImages ? () => selectBlock("topImage") : undefined}
                style={{
                  position: "relative",
                  zIndex: state.newsletterImageTransforms.topImage.zIndex ?? 0,
                  transform: `translate(${state.newsletterImageTransforms.topImage.x}%, ${state.newsletterImageTransforms.topImage.y}%) scale(${state.newsletterImageTransforms.topImage.zoom})`,
                  transformOrigin: "center center"
                }}
              >
                {topImageSrc ? (
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
                ) : (
                  <span className="newsletter-placeholder-label">Top image</span>
                )}
                {canTransformImages ? (
                  <div className="newsletter-image-quick-actions">
                    <button
                      type="button"
                      className="newsletter-image-upload-overlay"
                      onClick={(e) => { e.stopPropagation(); topImageUploadRef.current?.click(); }}
                      title={topImageSrc ? "Replace top image" : "Upload top image"}
                    >
                      {topImageSrc ? "Replace" : "Upload"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {renderInlineControls("topImage")}
          </div>
        ) : null}
        {renderLayoutDividers("topImage", "after")}
        <hr className="newsletter-rule" />

        <section className="newsletter-top-block" aria-label="Newsletter opening message">
          {renderLayoutDividers("portraitHero", "before")}
          <div className={`newsletter-top-grid${showPortraitColumn ? " newsletter-top-grid--with-portrait" : ""}`}>
            {showPortraitColumn ? (
              <div className="newsletter-editable-row">
                <div className="newsletter-asset-row" style={{ justifyContent: "center" }}>
                  <div
                    className={`newsletter-portrait-wrap${portraitSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "portraitImage" ? " newsletter-edit-selected" : ""}`}
                    onClick={canTransformImages ? () => selectBlock("portraitImage") : undefined}
                    style={{
                      position: "relative",
                      zIndex: state.newsletterImageTransforms.portrait.zIndex ?? 0,
                      transform: `translate(${state.newsletterImageTransforms.portrait.x}%, ${state.newsletterImageTransforms.portrait.y}%) scale(${state.newsletterImageTransforms.portrait.zoom})`,
                      transformOrigin: "center center"
                    }}
                  >
                    {portraitSrc ? (
                      <img
                        src={portraitSrc}
                        alt=""
                        className="newsletter-portrait-img"
                        style={{
                          borderRadius:
                            state.newsletterImageTransforms.portrait.borderRadius >= 9999
                              ? "50%"
                              : `${state.newsletterImageTransforms.portrait.borderRadius}px`
                        }}
                      />
                    ) : (
                      <span className="newsletter-placeholder-label">CEO profile</span>
                    )}
                    {canTransformImages ? (
                      <div className="newsletter-image-quick-actions">
                        <button
                          type="button"
                          className="newsletter-image-upload-overlay"
                          onClick={(e) => { e.stopPropagation(); portraitUploadRef.current?.click(); }}
                          title={portraitSrc ? "Replace portrait" : "Upload portrait"}
                        >
                          {portraitSrc ? "Replace" : "Upload"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {renderInlineControls("portraitImage")}
              </div>
            ) : null}
            {heroSrc || canEdit ? (
            <div className="newsletter-editable-row">
              <div className="newsletter-asset-row newsletter-hero-row">
              <div
                className={`newsletter-hero-wrap${heroSrc ? "" : " is-placeholder"}${canTransformImages && selectedEditorTarget === "heroImage" ? " newsletter-edit-selected" : ""}`}
                onClick={canTransformImages ? () => selectBlock("heroImage") : undefined}
                style={{
                  position: "relative",
                  zIndex: state.newsletterImageTransforms.hero.zIndex ?? 0,
                  transform: `translate(${state.newsletterImageTransforms.hero.x}%, ${state.newsletterImageTransforms.hero.y}%) scale(${state.newsletterImageTransforms.hero.zoom})`,
                  transformOrigin: "center center"
                }}
              >
                {heroSrc ? (
                  <img
                    src={heroSrc}
                    alt=""
                    className="newsletter-hero-banner"
                    style={{ borderRadius: `${state.newsletterImageTransforms.hero.borderRadius}px` }}
                  />
                ) : (
                  <span className="newsletter-placeholder-label">Hero image</span>
                )}
                {canTransformImages ? (
                  <div className="newsletter-image-quick-actions">
                    <button
                      type="button"
                      className="newsletter-image-upload-overlay"
                      onClick={(e) => { e.stopPropagation(); heroUploadRef.current?.click(); }}
                      title={heroSrc ? "Replace hero image" : "Upload hero image"}
                    >
                      {heroSrc ? "Replace" : "Upload"}
                    </button>
                  </div>
                ) : null}
              </div>
              </div>
              {renderInlineControls("heroImage")}
            </div>
            ) : null}
          </div>
          {renderLayoutDividers("portraitHero", "after")}

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
              <input
                ref={briefImage0UploadRef}
                type="file"
                accept="image/*"
                onChange={handleBriefImageUpload(0)}
                style={{ display: "none" }}
              />
              <input
                ref={briefImage1UploadRef}
                type="file"
                accept="image/*"
                onChange={handleBriefImageUpload(1)}
                style={{ display: "none" }}
              />
              <input
                ref={briefImage2UploadRef}
                type="file"
                accept="image/*"
                onChange={handleBriefImageUpload(2)}
                style={{ display: "none" }}
              />
            </>
          ) : null}
          {canEdit ? (
            <input
              ref={storyImageUploadRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const sid = selectedStoryEdit?.storyId;
                if (!sid) return;
                void handleStoryImageUpload(sid)(e);
              }}
            />
          ) : null}

          {renderLayoutDividers("mission", "before")}
          {hasMission || canEdit ? (
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
                    color: legacyInkColor("missionBody"),
                    transform: `translate(${state.newsletterElementStyles.missionBody.offsetX ?? 0}px, ${state.newsletterElementStyles.missionBody.offsetY ?? 0}px)`,
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
                    color: legacyInkColor("missionBody"),
                    transform: `translate(${state.newsletterElementStyles.missionBody.offsetX ?? 0}px, ${state.newsletterElementStyles.missionBody.offsetY ?? 0}px)`,
                    ["--quote-box-color" as string]: state.newsletterElementStyles.missionBody.quoteBoxColor
                  }}
                  dangerouslySetInnerHTML={{ __html: missionHtml || textToHtml(mission) }}
                />
              ) : null}
              {renderInlineControls("missionBody")}
            </div>
          </div>
          ) : null}
          {renderLayoutDividers("mission", "after")}
          {hasMission || canEdit ? <hr className="newsletter-rule" /> : null}

          {renderLayoutDividers("issueHeading", "before")}
          <div className="newsletter-editable-row newsletter-issue-heading-row">
            {canEdit ? (
              <IssueTitleEditable
                id="newsletter-issue-title-editable"
                value={state.newsletterTitle}
                issueDate={issueDate}
                showDate={state.newsletterShowDate !== false}
                onChange={(text) => setState((prev) => ({ ...prev, newsletterTitle: text }))}
                placeholder="Newsletter title"
                onFocus={() => selectBlock("issueHeading")}
                className={`newsletter-issue-heading newsletter-inline-edit${selectedEditorTarget === "issueHeading" ? " newsletter-edit-selected" : ""}`}
                style={issueHeadingStyle}
              />
            ) : (
              <IssueTitleEditable
                value={state.newsletterTitle}
                issueDate={issueDate}
                showDate={state.newsletterShowDate !== false}
                editable={false}
                onChange={() => undefined}
                className="newsletter-issue-heading"
                style={issueHeadingStyle}
              />
            )}
            {renderInlineControls("issueHeading")}
          </div>
          {renderLayoutDividers("issueHeading", "after")}
          <hr className="newsletter-rule" />

          {renderLayoutDividers("greeting", "before")}
          {hasWelcome || canEdit ? (
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
                    color: legacyInkColor("missionHeading"),
                    transform: `translate(${state.newsletterElementStyles.missionHeading.offsetX ?? 0}px, ${state.newsletterElementStyles.missionHeading.offsetY ?? 0}px)`
                  }}
                />
              ) : state.newsletterMissionHeading?.trim() ? (
                <h2
                  className="newsletter-section-title"
                  style={{
                    fontFamily: state.newsletterElementStyles.missionHeading.fontFamily,
                    fontSize: `${state.newsletterElementStyles.missionHeading.fontSizeRem}rem`,
                    textAlign: state.newsletterElementStyles.missionHeading.textAlign,
                    fontWeight: state.newsletterElementStyles.missionHeading.fontWeight,
                    color: legacyInkColor("missionHeading"),
                    transform: `translate(${state.newsletterElementStyles.missionHeading.offsetX ?? 0}px, ${state.newsletterElementStyles.missionHeading.offsetY ?? 0}px)`
                  }}
                >
                  {state.newsletterMissionHeading.trim()}
                </h2>
              ) : null}
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
                    color: legacyInkColor("greetingHeading"),
                    ...flowOffsetStyle(
                      state.newsletterElementStyles.greetingHeading.offsetX,
                      state.newsletterElementStyles.greetingHeading.offsetY
                    )
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
                    color: legacyInkColor("greetingHeading"),
                    ...flowOffsetStyle(
                      state.newsletterElementStyles.greetingHeading.offsetX,
                      state.newsletterElementStyles.greetingHeading.offsetY
                    )
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
                    color: legacyInkColor("greetingBody"),
                    ...flowOffsetStyle(
                      state.newsletterElementStyles.greetingBody.offsetX,
                      state.newsletterElementStyles.greetingBody.offsetY
                    ),
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
                    color: legacyInkColor("greetingBody"),
                    ...flowOffsetStyle(
                      state.newsletterElementStyles.greetingBody.offsetX,
                      state.newsletterElementStyles.greetingBody.offsetY
                    ),
                    ["--quote-box-color" as string]: state.newsletterElementStyles.greetingBody.quoteBoxColor
                  }}
                  dangerouslySetInnerHTML={{ __html: welcomeHtml || textToHtml(welcomeLine) }}
                />
              ) : null}
              {renderInlineControls("greetingBody")}
            </div>
          </div>
          ) : null}
          {renderLayoutDividers("greeting", "after")}
          <hr className="newsletter-rule" />
        </section>

        {showExecBrief ? (
          (() => {
            const titleStyleData = state.newsletterElementStyles.executiveBriefTitle;
            const bodyStyleData = state.newsletterElementStyles.executiveBriefBody;
            const linkStyleData = state.newsletterElementStyles.executiveBriefLink;
            const sectionStyleData = state.newsletterElementStyles.executiveBriefSection;
            const sectionStyle: React.CSSProperties = flowSectionStyle(
              sectionStyleData?.offsetX,
              sectionStyleData?.offsetY,
              sectionStyleData?.color
            );
            const sectionSelectedClass = canEdit && selectedEditorTarget === "executiveBriefSection" ? " newsletter-edit-selected" : "";
            const titleStyle: React.CSSProperties = {
              fontFamily: titleStyleData.fontFamily,
              fontSize: `${titleStyleData.fontSizeRem}rem`,
              textAlign: titleStyleData.textAlign,
              fontWeight: titleStyleData.fontWeight,
              color: titleStyleData.color || undefined,
              transform: `translate(${titleStyleData.offsetX ?? 0}px, ${titleStyleData.offsetY ?? 0}px)`
            };
            const bodyStyle: React.CSSProperties = {
              fontFamily: bodyStyleData.fontFamily,
              fontSize: `${bodyStyleData.fontSizeRem}rem`,
              textAlign: bodyStyleData.textAlign,
              fontWeight: bodyStyleData.fontWeight,
              color: bodyStyleData.color || undefined,
              transform: `translate(${bodyStyleData.offsetX ?? 0}px, ${bodyStyleData.offsetY ?? 0}px)`
            };
            const linkStyle: React.CSSProperties = {
              fontFamily: linkStyleData.fontFamily,
              fontSize: `${linkStyleData.fontSizeRem}rem`,
              textAlign: linkStyleData.textAlign,
              fontWeight: linkStyleData.fontWeight,
              color: linkStyleData.color || undefined,
              transform: `translate(${linkStyleData.offsetX ?? 0}px, ${linkStyleData.offsetY ?? 0}px)`
            };
            const titleSelectedClass = canEdit && selectedEditorTarget === "executiveBriefTitle" ? " newsletter-edit-selected" : "";
            const bodySelectedClass = canEdit && selectedEditorTarget === "executiveBriefBody" ? " newsletter-edit-selected" : "";
            const linkSelectedClass = canEdit && selectedEditorTarget === "executiveBriefLink" ? " newsletter-edit-selected" : "";
            return (
              <section
                className={`newsletter-exec-brief${sectionSelectedClass}`}
                aria-label="Executive brief: top stories this month"
                style={sectionStyle}
                onClick={canEdit ? (e) => {
                  if (e.target === e.currentTarget) selectBlock("executiveBriefSection");
                } : undefined}
                role={canEdit ? "button" : undefined}
              >
                {canEdit ? (
                  <button
                    type="button"
                    className="newsletter-exec-brief-section-handle"
                    onClick={(e) => { e.stopPropagation(); selectBlock("executiveBriefSection"); }}
                    title="Select & move whole Executive Brief section"
                  >
                    Move section
                  </button>
                ) : null}
                {renderInlineControls("executiveBriefSection")}
                <div className="newsletter-editable-row">
                  {canEdit ? (
                    <SingleLineEditable
                      value={briefTitleValue}
                      onChange={(text) => setState((prev) => ({ ...prev, executiveBriefTitle: text }))}
                      placeholder="Top Stories This Month"
                      onFocus={() => selectBlock("executiveBriefTitle")}
                      className={`newsletter-section-title newsletter-inline-edit newsletter-exec-brief-title${titleSelectedClass}`}
                      style={titleStyle}
                    />
                  ) : (
                    <h2 className="newsletter-section-title newsletter-exec-brief-title" style={titleStyle}>
                      {briefTitleValue}
                    </h2>
                  )}
                  {renderInlineControls("executiveBriefTitle")}
                </div>
                <div className="newsletter-exec-brief-grid">
                  {briefSlots.map(({ index, story }) => {
                    const explicitId = briefSlotIds[index] ?? "";
                    const link = story ? briefLinkForStory(story) : "";
                    const overrideUrl = (state.executiveBriefImageOverrides ?? [])[index] ?? "";
                    const imgSrc = overrideUrl || (story ? briefImageForStory(story) : "");
                    const briefTransform = (state.executiveBriefImageTransforms ?? [])[index] ?? {
                      x: 0,
                      y: 0,
                      zoom: 1,
                      borderRadius: 12,
                      zIndex: 0
                    };
                    const briefImageTarget = (
                      index === 0
                        ? "executiveBriefImage0"
                        : index === 1
                          ? "executiveBriefImage1"
                          : "executiveBriefImage2"
                    ) as EditableTarget;
                    const briefImageSelected = canTransformImages && selectedEditorTarget === briefImageTarget;
                    const triggerBriefUpload = () => {
                      if (index === 0) briefImage0UploadRef.current?.click();
                      else if (index === 1) briefImage1UploadRef.current?.click();
                      else briefImage2UploadRef.current?.click();
                    };
                    return (
                      <div key={index} className="newsletter-exec-brief-card">
                        {canEdit ? (
                          <select
                            className="newsletter-exec-brief-select"
                            value={explicitId}
                            onChange={(e) => setBriefStorySlot(index, e.target.value)}
                            aria-label={`Story slot ${index + 1}`}
                          >
                            <option value="">{story ? `Auto: ${story.title || "(untitled)"}` : "Auto (no story available)"}</option>
                            {briefStoryCandidates.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title?.trim() || "(untitled)"}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div
                          className={`newsletter-exec-brief-card-img-wrap${imgSrc ? "" : " is-placeholder"}${briefImageSelected ? " newsletter-edit-selected" : ""}${canTransformImages ? " is-editable" : ""}`}
                          onClick={canTransformImages ? () => selectBlock(briefImageTarget) : undefined}
                          role={canTransformImages ? "button" : undefined}
                          style={{ borderRadius: `${briefTransform.borderRadius}px`, zIndex: briefTransform.zIndex ?? 0 }}
                        >
                          {imgSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgSrc}
                              alt={story?.title ?? ""}
                              className="newsletter-exec-brief-card-img"
                              style={{
                                transform: `translate(${briefTransform.x}%, ${briefTransform.y}%) scale(${briefTransform.zoom})`,
                                transformOrigin: "center center",
                                borderRadius: `${briefTransform.borderRadius}px`
                              }}
                            />
                          ) : (
                            <div className="newsletter-exec-brief-card-img is-placeholder" aria-hidden>
                              {canEdit ? "Pick a story or upload an image" : ""}
                            </div>
                          )}
                          {canTransformImages ? (
                            <div className="newsletter-image-quick-actions">
                              <button
                                type="button"
                                className="newsletter-image-upload-overlay"
                                onClick={(e) => { e.stopPropagation(); triggerBriefUpload(); }}
                                title={imgSrc ? "Replace image" : "Upload image"}
                              >
                                {imgSrc ? "Replace" : "Upload"}
                              </button>
                              {overrideUrl ? (
                                <button
                                  type="button"
                                  className="newsletter-image-upload-overlay is-secondary"
                                  onClick={(e) => { e.stopPropagation(); clearBriefImageOverride(index); }}
                                  title="Use the story's image again"
                                >
                                  Use story
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {renderInlineControls(briefImageTarget)}
                        {story ? (
                          <h3
                            className={`newsletter-exec-brief-card-title${bodySelectedClass}`}
                            style={bodyStyle}
                            onClick={canEdit ? () => selectBlock("executiveBriefBody") : undefined}
                            role={canEdit ? "button" : undefined}
                          >
                            {story.title || "(untitled)"}
                          </h3>
                        ) : null}
                        {story && link ? (
                          <a
                            className={`newsletter-exec-brief-card-link${linkSelectedClass}`}
                            href={link}
                            style={linkStyle}
                            onClick={canEdit ? (e) => { e.preventDefault(); selectBlock("executiveBriefLink"); } : undefined}
                          >
                            Read more →
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {renderInlineControls("executiveBriefBody")}
                {renderInlineControls("executiveBriefLink")}
              </section>
            );
          })()
        ) : null}

        {renderLayoutDividers("stories", "before")}
        {!modularLayout ? (
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
                    <div className="newsletter-divider-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => moveStory(story.id, -1)}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => moveStory(story.id, 1)}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          setState((prev) => ({ ...prev, stories: prev.stories.filter((s) => s.id !== story.id) }))
                        }
                      >
                        Delete divider
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : story.kind === "text" ? (
                <article
                  key={story.id}
                  className={`newsletter-text-block${
                    canEdit ? (selectedStoryEdit?.storyId === story.id ? " newsletter-edit-selected" : " newsletter-text-block-editable") : ""
                  }`}
                  onClick={canEdit ? () => selectStoryField(story.id, "body") : undefined}
                  role={canEdit ? "button" : undefined}
                  style={{
                    ...storyTextStyle,
                    transform: `translate(${story.articleOffsetX ?? 0}px, ${story.articleOffsetY ?? 0}px)`
                  }}
                >
                  {story.title.trim() ? (
                    <div className="newsletter-inline-text-shell">
                      {canEdit ? (
                        <InlinePlainTextEditable
                          value={story.title}
                          onChange={(title) => updateStory(story.id, { title })}
                          className="newsletter-text-block-heading newsletter-inline-edit"
                          style={storyTextStyle}
                          as="h2"
                          placeholder="Optional heading"
                          onFocus={() => selectStoryField(story.id, "body")}
                        />
                      ) : (
                        <h2 className="newsletter-text-block-heading" style={storyTextStyle}>
                          {story.title}
                        </h2>
                      )}
                    </div>
                  ) : null}
                  <div className="newsletter-inline-text-shell">
                    {canEdit ? (
                      <RichTextEditor
                        value={story.body || "<p><em>Click to edit text block...</em></p>"}
                        placeholder="Text block"
                        onChange={(body) => updateStory(story.id, { body })}
                        className="newsletter-text-block-body newsletter-rich-text newsletter-inline-edit"
                        style={storyTextStyle}
                        onFocus={() => selectStoryField(story.id, "body")}
                      />
                    ) : (
                      <div
                        className="newsletter-rich-text newsletter-text-block-body"
                        style={storyTextStyle}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(story.body || "") }}
                      />
                    )}
                  </div>
                </article>
              ) : (
              <article
                key={story.id}
                id={`story-${story.id}`}
                className="newsletter-story"
                style={{
                  ...storyTextStyle,
                  transform: `translate(${story.articleOffsetX ?? 0}px, ${story.articleOffsetY ?? 0}px)`
                }}
              >
                <div className="newsletter-inline-text-shell">
                  {canEdit ? (
                    <InlinePlainTextEditable
                      value={story.title}
                      onChange={(title) => updateStory(story.id, { title })}
                      className={`newsletter-story-title newsletter-inline-edit${isStoryFieldSelected(story.id, "title") ? " newsletter-edit-selected" : ""}`}
                      onFocus={() => selectStoryField(story.id, "title")}
                      as="h2"
                      placeholder="Story title"
                      style={storyFieldStyle(storyTitleCss, story, "title")}
                    />
                  ) : (
                    <h2 className="newsletter-story-title" style={storyFieldStyle(storyTitleCss, story, "title")}>
                      {story.title.trim()}
                    </h2>
                  )}
                </div>

                {(() => {
                  const gallery = Array.isArray(story.images) && story.images.length > 0
                    ? story.images
                    : story.imageUrl
                      ? [story.imageUrl]
                      : [];
                  const imageBlockTransform = `translate(${clampStoryImageBlockOffset(story.imageOffsetX, "x")}px, ${clampStoryImageBlockOffset(story.imageOffsetY, "y")}px)`;
                  const selectImageBlock = () => {
                    selectStoryField(story.id, "image");
                  };
                  const pickImageFiles = () => {
                    selectStoryField(story.id, "image");
                    if (typeof window !== "undefined") {
                      window.requestAnimationFrame(() => storyImageUploadRef.current?.click());
                    }
                  };
                  if (gallery.length > 1) {
                    const count = Math.min(gallery.length, 9);
                    return (
                      <div
                        className={`newsletter-story-montage newsletter-story-montage-${count}${
                          canEdit ? (isStoryFieldSelected(story.id, "image") ? " newsletter-edit-selected" : "") : ""
                        }${canEdit ? " is-clickable" : ""}`}
                        onClick={canEdit ? (e) => { e.stopPropagation(); selectImageBlock(); } : undefined}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit ? 0 : undefined}
                        title={canEdit ? "Click to select image block; use Add / Replace to upload" : undefined}
                        onKeyDown={
                          canEdit
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  selectImageBlock();
                                }
                              }
                            : undefined
                        }
                        style={
                          canEdit
                            ? { cursor: "pointer", position: "relative", transform: imageBlockTransform }
                            : { transform: imageBlockTransform }
                        }
                      >
                        {gallery.slice(0, 9).map((src, idx) => (
                          <img key={`${idx}-${src.slice(0, 24)}`} src={src} alt={`${story.title} ${idx + 1}`} loading="lazy" />
                        ))}
                        {canEdit ? (
                          <div className="newsletter-image-quick-actions">
                            <button
                              type="button"
                              className="newsletter-image-upload-overlay"
                              onClick={(e) => { e.stopPropagation(); pickImageFiles(); }}
                              title="Add or replace images"
                            >
                              Add / Replace
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  if (gallery.length === 1) {
                    const { wrapper: fw, img: iw } = storySingleImageFrameStyles(story.imageFrame);
                    return (
                      <div
                        className={`newsletter-story-single-frame${canEdit ? " is-clickable" : ""}${
                          canEdit && isStoryFieldSelected(story.id, "image") ? " newsletter-edit-selected" : ""
                        }`}
                        style={{ ...fw, cursor: canEdit ? "pointer" : undefined, position: "relative", transform: imageBlockTransform }}
                        onClick={canEdit ? (e) => { e.stopPropagation(); selectImageBlock(); } : undefined}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit ? 0 : undefined}
                        title={canEdit ? "Click to select image block; use Replace to upload" : undefined}
                        onKeyDown={
                          canEdit
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  selectImageBlock();
                                }
                              }
                            : undefined
                        }
                      >
                        <img src={gallery[0]} alt={story.title} loading="lazy" style={iw} />
                        {canEdit ? (
                          <div className="newsletter-image-quick-actions">
                            <button
                              type="button"
                              className="newsletter-image-upload-overlay"
                              onClick={(e) => { e.stopPropagation(); pickImageFiles(); }}
                              title="Replace this image"
                            >
                              Replace
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  const { wrapper: fw } = storySingleImageFrameStyles(story.imageFrame);
                  return (
                    <div
                      className={`newsletter-story-image-placeholder${isStoryFieldSelected(story.id, "image") ? " newsletter-edit-selected" : ""}${canEdit ? " is-clickable" : ""}`}
                      style={{ ...fw, cursor: canEdit ? "pointer" : undefined, transform: imageBlockTransform }}
                      onClick={
                        canEdit
                          ? (e) => {
                              e.stopPropagation();
                              selectImageBlock();
                            }
                          : undefined
                      }
                      role={canEdit ? "button" : undefined}
                      tabIndex={canEdit ? 0 : undefined}
                      title={canEdit ? "Click to select image block; use the panel upload button to add images" : "Story image frame"}
                      onKeyDown={
                        canEdit
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                selectImageBlock();
                              }
                            }
                          : undefined
                      }
                    >
                      <span className="newsletter-story-image-placeholder-title">
                        {canEdit ? "Click to select image block" : "Image frame"}
                      </span>
                      <span className="newsletter-story-image-placeholder-hint">
                        {canEdit ? "Use the Upload button in the panel to add one or more images." : "This story reserves space for an image."}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const hideExcerpt =
                    hideNewsletterExcerptBecauseBodyCoversIt(story.excerpt, story.body ?? "") &&
                    !(canEdit && isStoryFieldSelected(story.id, "excerpt"));
                  if (hideExcerpt) return null;
                  return (
                <div className="newsletter-inline-text-shell">
                  {canEdit ? (
                    <InlinePlainTextEditable
                      value={story.excerpt}
                      onChange={(excerpt) => updateStory(story.id, { excerpt })}
                      className={`newsletter-story-excerpt newsletter-inline-edit${isStoryFieldSelected(story.id, "excerpt") ? " newsletter-edit-selected" : ""}`}
                      onFocus={() => selectStoryField(story.id, "excerpt")}
                      placeholder="Story excerpt"
                      style={storyFieldStyle(storyExcerptCss, story, "excerpt")}
                    />
                  ) : (
                    <p className="newsletter-story-excerpt" style={storyFieldStyle(storyExcerptCss, story, "excerpt")}>
                      {story.excerpt.trim()}
                    </p>
                  )}
                </div>
                  );
                })()}
                {(story.body && /[<>]/.test(story.body)) || canEdit ? (
                  <div className="newsletter-inline-text-shell">
                    {canEdit ? (
                      <RichTextEditor
                        value={story.body || "<p><em>Click to add body text...</em></p>"}
                        placeholder="Story body"
                        onChange={(body) => updateStory(story.id, { body })}
                        className={`newsletter-story-body newsletter-rich-text newsletter-inline-edit${isStoryFieldSelected(story.id, "body") ? " newsletter-edit-selected" : ""}`}
                        onFocus={() => selectStoryField(story.id, "body")}
                        style={storyFieldStyle(storyBodyCss, story, "body")}
                      />
                    ) : story.body && /[<>]/.test(story.body) ? (
                      <div
                        className="newsletter-story-body newsletter-rich-text"
                        style={storyFieldStyle(storyBodyCss, story, "body")}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(story.body) }}
                      />
                    ) : (
                      null
                    )}
                  </div>
                ) : null}
              </article>
              )
            ))
          )}
        </div>
        ) : null}
        {renderLayoutDividers("stories", "after")}

        <NewsletterBlocksRenderer
          blocks={state.newsletterBlocks ?? []}
          visibleBlockIds={visibleNewsletterBlocks.map((b) => b.id)}
          canEdit={canEdit}
          selectedId={selectedBlockId}
          onSelect={(id) => {
            setSelectedEditorTarget(null);
            setSelectedStoryEdit(null);
            setSelectedLayoutDividerId(null);
            setSelectedBlockId(id);
          }}
          onChange={commitNewsletterBlocks}
          inheritColor={effectiveStoryTextColor || undefined}
          storyTextStyle={storyTextStyle}
        />

        {canEdit && modularLayout ? (
          <div className="newsletter-add-story-row">
            <button
              type="button"
              className="newsletter-add-story-cta"
              onClick={openAddStoryDialog}
              aria-haspopup="dialog"
              title="Open the Add story window. Paste a title and the body text, then click OK"
            >
              + Add story
            </button>
            <p className="newsletter-add-story-hint">
              Opens a window where you can paste the title and the body text, then click <strong>OK</strong>.
            </p>
          </div>
        ) : null}

        </>)}

      </section>
      {canEdit && showGlobalControls ? (
        <div className="newsletter-lifecycle-panel">
          <strong className="newsletter-side-panel-title">Editing</strong>
          <div className="newsletter-lifecycle-action-stack">
            <button
              type="button"
              className="button secondary newsletter-create-issue-button"
              onClick={() => void createNewIssue()}
              disabled={saveState === "saving"}
            >
              Create new issue
            </button>
            <button
              type="button"
              className="button secondary newsletter-create-issue-button"
              onClick={() => void saveCurrentLayoutAsDefault()}
              disabled={saveState === "saving"}
              title="Save the current masthead, mission, images, and layout as the default baseline for future new issues"
            >
              Save as default layout
            </button>
            <button
              type="button"
              className="button secondary newsletter-delete-issue-button"
              onClick={() => void deleteCurrentIssue()}
              disabled={saveState === "saving" || !hasPreviousIssueBackup}
              title={
                hasPreviousIssueBackup
                  ? "Discard this issue and restore the draft from before Create new issue"
                  : "Available after Create new issue. Restores the previous draft"
              }
            >
              Delete this issue
            </button>
          </div>
        </div>
      ) : null}
      {canEdit && selectedBlockId ? (
        <NewsletterBlockEditPane
          block={(state.newsletterBlocks ?? []).find((b) => b.id === selectedBlockId) ?? null}
          onChange={updateNewsletterBlock}
          onClose={() => setSelectedBlockId(null)}
          onDelete={() => {
            if (selectedBlockId) deleteNewsletterBlock(selectedBlockId);
          }}
          onSave={saveStories}
          saveState={saveState}
        />
      ) : null}
      {canEdit && addStoryOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="newsletter-add-story-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="newsletter-add-story-heading"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeAddStoryDialog();
              }}
            >
              <div className="newsletter-add-story-modal">
                <div className="newsletter-add-story-head">
                  <h2 id="newsletter-add-story-heading">Add a new story</h2>
                  <p>Paste a title and body, then click <strong>OK, Add story</strong> below.</p>
                </div>
                <div className="newsletter-add-story-body">
                  <label>
                    Title
                    <input
                      autoFocus
                      type="text"
                      value={addStoryDraft.title}
                      onChange={(e) => setAddStoryDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Echoes of Gold opens at Gallery Maji"
                    />
                  </label>
                  <label>
                    Body (paste here)
                    <textarea
                      rows={8}
                      value={addStoryDraft.body}
                      onChange={(e) => setAddStoryDraft((d) => ({ ...d, body: e.target.value }))}
                      placeholder="Paste the full story text. Leave a blank line between paragraphs."
                    />
                  </label>
                  <details className="newsletter-add-story-more">
                    <summary>More options (optional)</summary>
                    <label>
                      Excerpt (auto-derived from body if blank)
                      <input
                        type="text"
                        value={addStoryDraft.excerpt}
                        onChange={(e) => setAddStoryDraft((d) => ({ ...d, excerpt: e.target.value }))}
                        placeholder="A short summary for the top of the story"
                      />
                    </label>
                    <label>
                      Image URL
                      <input
                        type="url"
                        value={addStoryDraft.imageUrl}
                        onChange={(e) => setAddStoryDraft((d) => ({ ...d, imageUrl: e.target.value }))}
                        placeholder="https://…"
                      />
                    </label>
                    <label>
                      Source URL
                      <input
                        type="url"
                        value={addStoryDraft.sourceUrl}
                        onChange={(e) => setAddStoryDraft((d) => ({ ...d, sourceUrl: e.target.value }))}
                        placeholder="https://… link to the original article"
                      />
                    </label>
                    <label>
                      CTA label
                      <input
                        type="text"
                        value={addStoryDraft.ctaLabel}
                        onChange={(e) => setAddStoryDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                        placeholder="Read more"
                      />
                    </label>
                    <label>
                      CTA URL (defaults to Source URL)
                      <input
                        type="url"
                        value={addStoryDraft.ctaUrl}
                        onChange={(e) => setAddStoryDraft((d) => ({ ...d, ctaUrl: e.target.value }))}
                        placeholder="https://…"
                      />
                    </label>
                  </details>
                </div>
                <div className="newsletter-add-story-actions">
                  <button type="button" className="button secondary" onClick={closeAddStoryDialog}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button primary button-sage"
                    onClick={submitAddStoryDialog}
                    disabled={!addStoryDraft.title.trim() && !addStoryDraft.body.trim()}
                  >
                    OK, Add story
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {canEdit ? (
        <button
          type="button"
          className={`newsletter-edit-pill${showGlobalControls ? " is-active" : ""}`}
          onClick={() => {
            const next = !showGlobalControls;
            setShowGlobalControls(next);
            if (!next) setOpenDrawer(null);
          }}
          aria-pressed={showGlobalControls}
          aria-label={showGlobalControls ? "Hide edit menu" : "Show edit menu"}
        >
          {showGlobalControls ? "Done" : "Edit menu"}
        </button>
      ) : showAdminEntry ? (
        <a
          className="newsletter-edit-pill"
          href="/newsletter?edit=1"
          aria-label="Open the newsletter editor (admin only)"
        >
          Edit newsletter
        </a>
      ) : null}
    </main>
  );
}
