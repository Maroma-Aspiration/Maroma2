"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { StoriesState } from "../../../lib/story-types";
import { applyBlockToLegacyState } from "../../../lib/newsletter-block-legacy-sync";
import { canvasToEmailHtml, canvasEmailOptionsFromState } from "../../../lib/canvas-to-email";
import {
  loadStorySpacingGaps,
  saveStorySpacingGaps,
  DEFAULT_STORY_SPACING_GAPS,
  type StorySpacingGaps,
} from "../../../lib/story-spacing-gaps";
import { NewsletterCanvas, type NewsletterCanvasHandle } from "../newsletter-canvas";
import { optimizeMastheadImagesInEmailHtml } from "../../../lib/canvas-display-image";
import StorySpacingControls from "../story-spacing-controls";

const CANVAS_LS_KEY = "maroma-newsletter-canvas-draft";
const CANVAS_LS_SAVED_KEY = "maroma-newsletter-canvas-saved-at";

function withCanvasStoryGaps(s: StoriesState): StoriesState {
  if (s.newsletterCanvas?.storySpacingGaps) return s;
  return {
    ...s,
    newsletterCanvas: {
      ...(s.newsletterCanvas ?? { enabled: false, elements: [] }),
      storySpacingGaps:
        typeof window !== "undefined" ? loadStorySpacingGaps() : { ...DEFAULT_STORY_SPACING_GAPS },
    },
  };
}

type AudienceInfo = {
  activeSubscribers: number;
  totalSubscribers: number;
  selectedListId?: string | null;
  selectedListName?: string | null;
  envHints: {
    postmarkConfigured: boolean;
    fromEmailConfigured: boolean;
    trackingSecretConfigured: boolean;
    fromAddress?: string;
    readyToSend?: boolean;
  };
};

function defaultSubject(state: StoriesState): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
  const base = state.newsletterTitle?.trim() || "Maroma Newsletter";
  return `${base} | ${month}`;
}

type Props = {
  initialState: StoriesState;
  siteUrl: string;
};

export default function EmailPreviewClient({ initialState, siteUrl }: Props) {
  const stateRef = useRef(initialState);
  const canvasRef = useRef<NewsletterCanvasHandle>(null);

  const [state, setState] = useState<StoriesState>(() => {
    if (typeof window === "undefined") return withCanvasStoryGaps(initialState);
    try {
      const raw = localStorage.getItem(CANVAS_LS_KEY);
      if (!raw) return withCanvasStoryGaps(initialState);
      const draft = JSON.parse(raw) as { canvas: StoriesState["newsletterCanvas"]; savedAt: number };
      const serverHasCanvas =
        initialState.newsletterCanvas?.enabled && (initialState.newsletterCanvas?.elements?.length ?? 0) > 0;
      const draftHasCanvas = draft.canvas?.enabled && (draft.canvas?.elements?.length ?? 0) > 0;
      const lastApiSave = Number(localStorage.getItem(CANVAS_LS_SAVED_KEY) ?? 0);
      if (draftHasCanvas && (!serverHasCanvas || draft.savedAt > lastApiSave)) {
        return withCanvasStoryGaps({ ...initialState, newsletterCanvas: draft.canvas });
      }
    } catch {
      /* ignore */
    }
    return withCanvasStoryGaps(initialState);
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state.newsletterCanvas?.enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          CANVAS_LS_KEY,
          JSON.stringify({ canvas: state.newsletterCanvas, savedAt: Date.now() })
        );
      } catch {
        /* quota */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [state.newsletterCanvas]);

  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState(() => defaultSubject(initialState));
  const [previewText, setPreviewText] = useState(
    "Read our latest stories, news, and updates from the Maroma team."
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [sendStatus, setSendStatus] = useState<{ ok?: boolean; msg?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingFull, setSendingFull] = useState(false);
  const [audience, setAudience] = useState<AudienceInfo | null>(null);
  const [showSendPanel, setShowSendPanel] = useState(false);
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

  const [applyingSpacing, setApplyingSpacing] = useState(false);
  const [showStorySpacing, setShowStorySpacing] = useState(false);

  const applyStorySpacing = useCallback(() => {
    setApplyingSpacing(true);
    requestAnimationFrame(() => {
      canvasRef.current?.compactSpacing(storyGaps);
      setApplyingSpacing(false);
    });
  }, [storyGaps]);

  const hasCanvas =
    state.newsletterCanvas?.enabled && (state.newsletterCanvas?.elements?.length ?? 0) > 0;

  const html = useMemo(() => {
    if (!hasCanvas || !state.newsletterCanvas) return null;
    return canvasToEmailHtml(
      state.newsletterCanvas,
      canvasEmailOptionsFromState(state, {
        siteUrl,
        allowDataUrls: true,
        subject,
        previewText,
        storySpacingGaps: storyGaps,
      })
    );
  }, [hasCanvas, state, siteUrl, subject, previewText, storyGaps]);

  const previewHtml = useMemo(() => {
    if (!html) return null;
    const withDisplayImages = optimizeMastheadImagesInEmailHtml(html, state.newsletterCanvas?.elements);
    const origin = typeof window !== "undefined" ? window.location.origin : siteUrl;
    return withDisplayImages.replace(
      /(src|href)="\/(newsletter\/display|_next\/image)/g,
      (_m, attr: string, path: string) => `${attr}="${origin}/${path}`,
    );
  }, [html, state.newsletterCanvas?.elements, siteUrl]);

  const saveStories = useCallback(async () => {
    setSaveState("saving");
    setSaveMsg("Saving…");
    const current = stateRef.current;
    let toSave: StoriesState = { ...current, newsletterBlocks: current.newsletterBlocks ?? [] };
    for (const b of toSave.newsletterBlocks) {
      if ("sync" in b && b.sync) toSave = applyBlockToLegacyState(toSave, b);
    }
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: toSave }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Save failed (${response.status}).`);
      }
      try {
        localStorage.setItem(CANVAS_LS_SAVED_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setSaveState("saved");
      setSaveMsg("Saved");
      setTimeout(() => {
        setSaveState("idle");
        setSaveMsg("");
      }, 2500);
    } catch (error) {
      setSaveState("idle");
      setSaveMsg(error instanceof Error ? error.message : "Save failed.");
      throw error;
    }
  }, []);

  const reloadFromServer = async () => {
    setSaveMsg("Reloading…");
    try {
      const res = await fetch("/api/stories");
      if (!res.ok) throw new Error("Could not reload.");
      const data = (await res.json()) as { state: StoriesState };
      setState(data.state);
      setSubject(defaultSubject(data.state));
      setSaveMsg("Reloaded");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Reload failed.");
    }
  };

  const loadAudience = async () => {
    const res = await fetch("/api/newsletter/audience");
    if (res.ok) setAudience((await res.json()) as AudienceInfo);
  };

  const openSendPanel = () => {
    setShowSendPanel(true);
    void loadAudience();
  };

  const copyHtml = async () => {
    if (!html) return;
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHtml = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "newsletter-email.html";
    a.click();
  };

  const sendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    setSendStatus(null);
    try {
      await saveStories();
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, previewText, testOnly: true, testEmail, storySpacingGaps: storyGaps }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; sentTo?: string };
      if (res.ok) {
        setSendStatus({ ok: true, msg: `Test sent to ${data.sentTo}` });
      } else {
        setSendStatus({ ok: false, msg: data.error ?? "Send failed." });
      }
    } catch {
      setSendStatus({ ok: false, msg: "Network error." });
    } finally {
      setSending(false);
    }
  };

  const sendToList = async () => {
    if (
      !window.confirm(
        `Send to "${audience?.selectedListName ?? "selected list"}" (${audience?.activeSubscribers ?? "?"} active subscribers)? This cannot be undone.`
      )
    ) {
      return;
    }
    setSendingFull(true);
    setSendStatus(null);
    try {
      await saveStories();
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          previewText,
          storySpacingGaps: storyGaps,
          mailingListId: audience?.selectedListId ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        sentOk?: number;
        attempted?: number;
        failures?: { email: string; message: string }[];
        error?: string;
      };
      if (res.ok) {
        setSendStatus({
          ok: true,
          msg: `Sent to ${data.sentOk} of ${data.attempted} subscribers.${(data.failures?.length ?? 0) > 0 ? ` ${data.failures!.length} failed.` : ""}`,
        });
      } else {
        setSendStatus({ ok: false, msg: data.error ?? "Send failed." });
      }
    } catch {
      setSendStatus({ ok: false, msg: "Network error." });
    } finally {
      setSendingFull(false);
    }
  };

  const missingEnv = audience && !audience.envHints.readyToSend;

  const btn: CSSProperties = {
    padding: "7px 14px",
    borderRadius: 6,
    border: "1px solid rgba(167,199,188,0.35)",
    background: "rgba(167,199,188,0.08)",
    color: "#a7c7bc",
    fontSize: 13,
    cursor: "pointer",
  };

  return (
    <main
      className="email-preview-page"
      style={{
        minHeight: "100vh",
        background: "#0d1a15",
        color: "#e8f3f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "14px 24px",
          background: "rgba(0,0,0,0.4)",
          borderBottom: "1px solid rgba(167,199,188,0.15)",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <a href="/newsletter?edit=1" style={{ color: "#a7c7bc", textDecoration: "none", fontSize: 13 }}>
          ← Full editor
        </a>
        <span style={{ color: "rgba(167,199,188,0.3)" }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#c8ecf5" }}>Email preview &amp; edit</span>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          {hasCanvas && (
            <>
              <button
                type="button"
                onClick={() => void saveStories()}
                disabled={saveState === "saving"}
                style={{
                  ...btn,
                  border: "1px solid rgba(80,200,160,0.5)",
                  background: saveState === "saved" ? "rgba(80,200,120,0.15)" : "rgba(80,200,160,0.12)",
                  color: saveState === "saved" ? "#80e0a0" : "#80e0c0",
                  fontWeight: 600,
                }}
              >
                {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save"}
              </button>
              <button type="button" style={btn} onClick={() => canvasRef.current?.restoreMontages()}>
                ⊞ Montages
              </button>
              <button
                type="button"
                style={{
                  ...btn,
                  ...(showStorySpacing
                    ? {
                        border: "1px solid rgba(112,201,217,0.5)",
                        background: "rgba(112,201,217,0.12)",
                        color: "#c8ecf5",
                      }
                    : {}),
                }}
                onClick={() => setShowStorySpacing((v) => !v)}
              >
                Story spacing
              </button>
            </>
          )}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(167,199,188,0.3)",
              background: "rgba(255,255,255,0.05)",
              color: "#e8f3f0",
              fontSize: 13,
              width: 220,
            }}
          />
          <input
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Inbox preview text"
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(167,199,188,0.3)",
              background: "rgba(255,255,255,0.05)",
              color: "#e8f3f0",
              fontSize: 13,
              width: 200,
            }}
          />
          <button type="button" style={btn} onClick={() => void reloadFromServer()}>
            ↻ Reload
          </button>
          <button type="button" style={btn} onClick={() => void copyHtml()} disabled={!html}>
            {copied ? "✓ Copied" : "Copy HTML"}
          </button>
          <button type="button" style={btn} onClick={downloadHtml} disabled={!html}>
            ↓ Download
          </button>
          <button
            type="button"
            onClick={openSendPanel}
            style={{
              ...btn,
              border: "1px solid rgba(80,200,160,0.5)",
              background: "rgba(80,200,160,0.15)",
              color: "#80e0c0",
              fontWeight: 600,
            }}
          >
            ✉ Send…
          </button>
        </div>
        {saveMsg && saveState !== "saved" && (
          <span style={{ width: "100%", fontSize: 12, color: "#ffa040", textAlign: "right" }}>{saveMsg}</span>
        )}
      </div>

      {showSendPanel && (
        <div
          style={{
            margin: "16px 24px",
            padding: "20px 24px",
            background: "rgba(80,200,160,0.06)",
            border: "1px solid rgba(80,200,160,0.25)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "#80e0c0" }}>Send Newsletter</h2>
            <button
              type="button"
              onClick={() => setShowSendPanel(false)}
              style={{ background: "none", border: "none", color: "#a7c7bc", cursor: "pointer", fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          {missingEnv && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255,160,60,0.1)",
                border: "1px solid rgba(255,160,60,0.3)",
                borderRadius: 6,
                marginBottom: 14,
                fontSize: 13,
                color: "#ffa040",
              }}
            >
              <strong>Missing configuration:</strong> Postmark token and/or tracking secret not set in Vercel env.
            </div>
          )}
          {audience && (
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#a7c7bc" }}>
              <strong style={{ color: "#c8ecf5" }}>
                {audience.selectedListName ? `${audience.selectedListName}: ` : ""}
                {audience.activeSubscribers} active subscribers
              </strong>
            </p>
          )}
          {sendStatus && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                marginBottom: 14,
                fontSize: 13,
                background: sendStatus.ok ? "rgba(80,200,120,0.1)" : "rgba(255,80,80,0.1)",
                border: `1px solid ${sendStatus.ok ? "rgba(80,200,120,0.3)" : "rgba(255,80,80,0.3)"}`,
                color: sendStatus.ok ? "#80e0a0" : "#ff8080",
              }}
            >
              {sendStatus.ok ? "✓ " : "✕ "}
              {sendStatus.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "rgba(167,199,188,0.7)" }}>Send test to</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(167,199,188,0.3)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#e8f3f0",
                    fontSize: 13,
                    width: 220,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void sendTest()}
                  disabled={sending || !testEmail}
                  style={{ ...btn, color: "#c8ecf5" }}
                >
                  {sending ? "Sending…" : "Send test"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void sendToList()}
              disabled={sendingFull || missingEnv || !audience || audience.activeSubscribers === 0}
              style={{
                padding: "9px 22px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid rgba(80,200,160,0.5)",
                background: "rgba(80,200,160,0.18)",
                color: "#80e0c0",
                opacity: missingEnv || !audience || audience.activeSubscribers === 0 ? 0.45 : 1,
              }}
            >
              {sendingFull ? "Sending…" : `Send to ${audience?.activeSubscribers ?? "…"}`}
            </button>
          </div>
        </div>
      )}

      <p
        style={{
          margin: "10px 24px 0",
          fontSize: 12,
          color: "rgba(167,199,188,0.55)",
          lineHeight: 1.5,
        }}
      >
        Edit on the left. Preview on the right is the exact HTML sent to inboxes. Save before sending.
      </p>

      {hasCanvas && showStorySpacing ? (
        <div
          style={{
            margin: "12px 24px 0",
            padding: "14px 18px",
            background: "rgba(18, 32, 28, 0.96)",
            border: "1px solid rgba(112, 201, 217, 0.28)",
            borderRadius: 10,
            maxWidth: 440,
          }}
        >
          <StorySpacingControls
            inline
            gaps={storyGaps}
            onChange={setStoryGaps}
            onApply={applyStorySpacing}
            applying={applyingSpacing}
          />
        </div>
      ) : null}

      {hasCanvas ? (
        <>
          <div className="email-preview-workspace">
          <section className="email-preview-editor-panel" aria-label="Newsletter canvas editor">
            <NewsletterCanvas
              ref={canvasRef}
              canvas={state.newsletterCanvas}
              canEdit
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
              onSave={saveStories}
            />
          </section>
          <section className="email-preview-output-panel" aria-label="Email preview">
            <div className="email-preview-output-header">
              <span>Sent email preview</span>
              <span className="email-preview-output-subject">{subject}</span>
            </div>
            <div className="email-preview-output-frame">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="Newsletter email preview"
                  className="email-preview-iframe"
                  sandbox="allow-same-origin"
                />
              ) : null}
            </div>
            <details className="email-preview-export-html">
              <summary>Export HTML source</summary>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  fontSize: 11,
                  lineHeight: 1.4,
                  overflow: "auto",
                  maxHeight: 280,
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: 6,
                  color: "rgba(167,199,188,0.85)",
                }}
              >
                {html ?? ""}
              </pre>
            </details>
          </section>
        </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 24px", color: "rgba(167,199,188,0.5)" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Canvas mode is not enabled yet.</p>
          <p style={{ fontSize: 14 }}>
            Open the{" "}
            <a href="/newsletter?edit=1" style={{ color: "#a7c7bc" }}>
              newsletter editor
            </a>{" "}
            and switch to <strong>Canvas mode</strong>, then return here.
          </p>
        </div>
      )}
    </main>
  );
}
