import type { GiftCardPreset } from "../../lib/gift-builder-types";

type GiftCardPreviewProps = {
  preset: GiftCardPreset;
  message: string;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
};

export function GiftCardPreview({
  preset,
  message,
  selected = false,
  compact = false,
  onSelect,
}: GiftCardPreviewProps) {
  const displayMessage = message.trim() || preset.suggestedMessage;
  const Tag = onSelect ? "button" : "div";

  return (
    <Tag
      type={onSelect ? "button" : undefined}
      className={`gift-card-preview gift-card-preview--${preset.style}${
        selected ? " is-selected" : ""
      }${compact ? " is-compact" : ""}`}
      onClick={onSelect}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? `Select ${preset.name} card design` : undefined}
    >
      <div className="gift-card-preview-face" aria-hidden>
        <span className="gift-card-preview-mark">Maroma</span>
        <span className="gift-card-preview-pattern" />
      </div>
      <div className="gift-card-preview-inside">
        <p className="gift-card-preview-message">{displayMessage}</p>
        <span className="gift-card-preview-signoff">With love</span>
      </div>
      {onSelect ? <span className="gift-card-preview-label">{preset.name}</span> : null}
    </Tag>
  );
}
