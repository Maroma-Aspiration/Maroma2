import type { GiftCardPreset } from "../../lib/gift-builder-types";
import { GiftCardPreview } from "./GiftCardPreview";

type GiftSetCardAddonProps = {
  cardPresets: GiftCardPreset[];
  cardId: string | null;
  cardMessage: string;
  selectedCard: GiftCardPreset | null;
  formatItemPrice: (amount: number) => string;
  onEnable: () => void;
  onDisable: () => void;
  onSelectPreset: (preset: GiftCardPreset) => void;
  onMessageChange: (message: string) => void;
};

export function GiftSetCardAddon({
  cardPresets,
  cardId,
  cardMessage,
  selectedCard,
  formatItemPrice,
  onEnable,
  onDisable,
  onSelectPreset,
  onMessageChange,
}: GiftSetCardAddonProps) {
  return (
    <section className="gift-builder-card-addon" aria-label="Greeting card add-on">
      <div className="gift-builder-card-addon-head">
        <div>
          <h3>Add a card to this set</h3>
          <p className="gift-builder-panel-copy">
            Choose a card design and write your message. We will handwrite it for you.
            {cardPresets[0] ? ` (+${formatItemPrice(cardPresets[0].price)} per set)` : ""}
          </p>
        </div>
        {cardId ? (
          <button type="button" className="gift-builder-link-btn" onClick={onDisable}>
            Remove card
          </button>
        ) : (
          <button type="button" className="maroma-btn maroma-btn-secondary" onClick={onEnable}>
            Add a card
          </button>
        )}
      </div>

      {cardId && cardPresets.length > 0 ? (
        <>
          <div className="gift-builder-card-presets">
            {cardPresets.map((preset) => (
              <GiftCardPreview
                key={preset.id}
                preset={preset}
                message={cardMessage}
                selected={cardId === preset.id}
                compact
                onSelect={() => onSelectPreset(preset)}
              />
            ))}
          </div>

          <div className="gift-builder-card-compose">
            <div className="gift-builder-card-compose-preview">
              {selectedCard ? (
                <GiftCardPreview preset={selectedCard} message={cardMessage} />
              ) : null}
            </div>
            <label className="gift-builder-field">
              <span>Your message</span>
              <textarea
                value={cardMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                maxLength={220}
                rows={5}
                placeholder={
                  selectedCard?.suggestedMessage ?? "Write a personal note for the recipient…"
                }
              />
              <small className="gift-builder-card-hint">
                Suggested: &ldquo;{selectedCard?.suggestedMessage}&rdquo;. Feel free to edit or write
                your own.
              </small>
            </label>
          </div>
        </>
      ) : null}
    </section>
  );
}

type GiftSetCardSummaryProps = {
  preset: GiftCardPreset;
  message?: string;
  formatItemPrice: (amount: number) => string;
  compact?: boolean;
};

export function GiftSetCardSummary({
  preset,
  message,
  formatItemPrice,
  compact = false,
}: GiftSetCardSummaryProps) {
  const displayMessage = message?.trim() || preset.suggestedMessage;

  return (
    <div className={`gift-builder-card-summary${compact ? " is-compact" : ""}`}>
      <GiftCardPreview preset={preset} message={displayMessage} compact={compact} />
      <div className="gift-builder-card-summary-copy">
        <span className="gift-builder-card-summary-label">Greeting card</span>
        <strong>{preset.name}</strong>
        {!compact ? <p>{displayMessage}</p> : null}
        <span className="gift-builder-card-summary-price">{formatItemPrice(preset.price)}</span>
      </div>
    </div>
  );
}
