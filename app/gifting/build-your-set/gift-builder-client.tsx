"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../../../context/CartContext";
import { addToGiftCollection, GIFT_BUILDER_COLLECTION_KEY, readGiftCollection, updateGiftCollectionItem } from "../../../lib/gift-builder-collection";
import { quantityDiscountRate, quantityTierRows } from "../../../lib/gift-builder-pricing";
import type {
  GiftBox,
  GiftBuilderCatalog,
  GiftCardPreset,
  GiftElement,
  GiftEventPreset,
  GiftSetCollectionItem,
  GiftTrack,
} from "../../../lib/gift-builder-types";
import { GiftSetCardAddon, GiftSetCardSummary } from "../../components/GiftSetCardSection";
import { GiftSetThumbnail } from "../../components/GiftSetThumbnail";

type BuilderStep = "start" | "build" | "complete";

const BUILDER_STEPS: BuilderStep[] = ["start", "build", "complete"];

const STEP_LABELS: Record<BuilderStep, string> = {
  start: "Get started",
  build: "Build your set",
  complete: "Review & order",
};

type TrackUiState = {
  presetId: string;
  boxId: string;
};

const DEFAULT_TRACK_UI: TrackUiState = { presetId: "custom", boxId: "" };

function stepIndex(step: BuilderStep): number {
  return BUILDER_STEPS.indexOf(step);
}

const CATEGORY_LABELS: Record<GiftElement["category"], string> = {
  scent: "Scent",
  soap: "Soap",
  candle: "Candle",
  wellness: "Wellness",
  accent: "Accent",
};

function emptySlots(count: number): string[] {
  return Array.from({ length: count }, () => "");
}

function makeDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeUnitPrice(
  box: GiftBox,
  slotIds: string[],
  elements: GiftElement[],
  cardPrice = 0
): number {
  const priceMap = new Map(elements.map((el) => [el.id, el.price]));
  const elementsTotal = slotIds
    .filter(Boolean)
    .reduce((sum, id) => sum + (priceMap.get(id) ?? 0), 0);
  return box.basePrice + elementsTotal + cardPrice;
}

export default function GiftBuilderClient() {
  const { formatItemPrice, refreshCart } = useCart();
  const [catalog, setCatalog] = useState<GiftBuilderCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<BuilderStep>("start");
  const [activeTrack, setActiveTrack] = useState<GiftTrack>("personal");
  const [trackUi, setTrackUi] = useState<Record<GiftTrack, TrackUiState>>({
    personal: { ...DEFAULT_TRACK_UI },
    corporate: { ...DEFAULT_TRACK_UI },
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>("custom");
  const [boxId, setBoxId] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [setName, setSetName] = useState("My gift set");
  const [orderQty, setOrderQty] = useState(1);
  const [collection, setCollection] = useState<GiftSetCollectionItem[]>([]);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<GiftElement["category"] | "all">("all");
  const [cardId, setCardId] = useState<string | null>(null);
  const [cardMessage, setCardMessage] = useState("");
  const corporateAutoStarted = useRef(false);

  useLayoutEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    setCollection(readGiftCollection());
    void fetch("/api/gift-builder/catalog", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: GiftBuilderCatalog) => setCatalog(data))
      .catch(() => setStatus("Could not load the gift builder. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  useLayoutEffect(() => {
    if (!loading) {
      window.scrollTo(0, 0);
    }
  }, [loading]);

  useEffect(() => {
    const syncCollection = (event: StorageEvent) => {
      if (event.key === GIFT_BUILDER_COLLECTION_KEY) {
        setCollection(readGiftCollection());
      }
    };
    window.addEventListener("storage", syncCollection);
    return () => window.removeEventListener("storage", syncCollection);
  }, []);

  const selectedBox = useMemo(
    () => catalog?.boxes.find((box) => box.id === boxId) ?? null,
    [boxId, catalog]
  );

  const elementMap = useMemo(() => {
    const map = new Map<string, GiftElement>();
    catalog?.elements.forEach((el) => map.set(el.id, el));
    return map;
  }, [catalog]);

  const filledSlots = slots.filter(Boolean);
  const isBuildComplete =
    selectedBox !== null && filledSlots.length === selectedBox.slotCount;

  const cardPresets = catalog?.cardPresets ?? [];

  const selectedCard = useMemo(
    () => cardPresets.find((card) => card.id === cardId) ?? null,
    [cardId, cardPresets]
  );

  const unitPrice = useMemo(() => {
    if (!selectedBox) return 0;
    const elementsTotal = filledSlots.reduce(
      (sum, id) => sum + (elementMap.get(id)?.price ?? 0),
      0
    );
    const cardPrice = selectedCard?.price ?? 0;
    return selectedBox.basePrice + elementsTotal + cardPrice;
  }, [elementMap, filledSlots, selectedBox, selectedCard]);

  useEffect(() => {
    if ((step !== "build" && step !== "complete") || !editingCollectionId) return;
    setCollection(
      updateGiftCollectionItem(editingCollectionId, {
        cardId: cardId ?? undefined,
        cardMessage: cardMessage.trim() || undefined,
        unitPrice,
      })
    );
  }, [cardId, cardMessage, editingCollectionId, step, unitPrice]);

  const enableCard = () => {
    const first = cardPresets[0];
    if (!first) return;
    setCardId(first.id);
    if (!cardMessage.trim()) setCardMessage(first.suggestedMessage);
  };

  const selectCardPreset = (preset: GiftCardPreset) => {
    setCardId(preset.id);
    if (!cardMessage.trim()) setCardMessage(preset.suggestedMessage);
  };

  const disableCard = () => {
    setCardId(null);
  };
  const discountedUnitPrice = Math.round(unitPrice * (1 - quantityDiscountRate(orderQty)));
  const tierRows = useMemo(() => quantityTierRows(unitPrice), [unitPrice]);

  const canNavigateToStep = useCallback(
    (target: BuilderStep): boolean => {
      if (target === step) return false;
      if (target === "start") return true;
      if (target === "build") return Boolean(boxId && selectedBox);
      if (target === "complete") return isBuildComplete;
      return false;
    },
    [boxId, isBuildComplete, selectedBox, step]
  );

  const goToStep = (target: BuilderStep) => {
    if (!canNavigateToStep(target)) return;
    setStatus(null);
    setStep(target);
  };

  const applyPreset = useCallback(
    (preset: GiftEventPreset, track: GiftTrack, chosenBoxId?: string) => {
      const boxIdToUse = chosenBoxId || preset.boxId;
      const box = catalog?.boxes.find((b) => b.id === boxIdToUse);
      if (!box) return;
      setActiveTrack(track);
      setBoxId(box.id);
      const nextSlots = emptySlots(box.slotCount);
      preset.elementIds.slice(0, box.slotCount).forEach((id, index) => {
        nextSlots[index] = id;
      });
      setSlots(nextSlots);
      setSetName(`${preset.label} gift set`);
      setSelectedPresetId(preset.id);
      setActiveSlot(0);
      setEditingCollectionId(null);
      setCardId(null);
      setCardMessage("");
      setStep("build");
    },
    [catalog?.boxes]
  );

  const updateTrackUi = (track: GiftTrack, patch: Partial<TrackUiState>) => {
    setTrackUi((prev) => ({
      ...prev,
      [track]: { ...prev[track], ...patch },
    }));
  };

  const beginTrackBuild = (track: GiftTrack) => {
    if (!catalog) return;
    const ui = trackUi[track];
    const preset =
      ui.presetId !== "custom"
        ? catalog.presets.find((p) => p.id === ui.presetId && p.track === track) ?? null
        : null;
    const boxIdToUse = ui.boxId || preset?.boxId || "";
    const box = catalog.boxes.find((b) => b.id === boxIdToUse);
    if (!box) {
      setStatus("Please choose a box size to continue.");
      return;
    }
    setStatus(null);
    if (preset) {
      applyPreset(preset, track, box.id);
      return;
    }
    setActiveTrack(track);
    setBoxId(box.id);
    setSlots(emptySlots(box.slotCount));
    setSetName(track === "corporate" ? "Corporate gift set" : "My gift set");
    setSelectedPresetId("custom");
    setActiveSlot(0);
    setEditingCollectionId(null);
    setCardId(null);
    setCardMessage("");
    setStep("build");
  };

  const personalPresets = useMemo(
    () => catalog?.presets.filter((preset) => preset.track === "personal") ?? [],
    [catalog?.presets]
  );

  const corporatePresets = useMemo(
    () => catalog?.presets.filter((preset) => preset.track === "corporate") ?? [],
    [catalog?.presets]
  );

  const personalCollection = useMemo(
    () => collection.filter((item) => (item.track ?? "personal") === "personal"),
    [collection]
  );

  const corporateCollection = useMemo(
    () => collection.filter((item) => item.track === "corporate"),
    [collection]
  );

  useEffect(() => {
    if (!catalog || loading || corporateAutoStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("corporate") !== "1") return;
    corporateAutoStarted.current = true;
    const preset = catalog.presets.find((p) => p.id === "corporate");
    if (!preset) return;
    setTrackUi((prev) => ({
      ...prev,
      corporate: { presetId: preset.id, boxId: preset.boxId },
    }));
    applyPreset(preset, "corporate", preset.boxId);
  }, [applyPreset, catalog, loading]);

  const selectElement = (elementId: string) => {
    if (!selectedBox) return;
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = elementId;
      return next;
    });
    const nextEmpty = slots.findIndex((id, idx) => idx > activeSlot && !id);
    if (nextEmpty >= 0) {
      setActiveSlot(nextEmpty);
    } else if (activeSlot < selectedBox.slotCount - 1) {
      setActiveSlot(activeSlot + 1);
    }
  };

  const clearSlot = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
    setActiveSlot(index);
  };

  const completeSet = () => {
    if (!selectedBox || !isBuildComplete || !catalog) return;
    const now = new Date().toISOString();
    const existing = editingCollectionId
      ? collection.find((item) => item.id === editingCollectionId)
      : null;
    const item: GiftSetCollectionItem = {
      id: existing?.id ?? makeDraftId(),
      name: setName.trim() || "My gift set",
      track: activeTrack,
      boxId: selectedBox.id,
      slots: [...slots],
      presetId: selectedPresetId === "custom" ? undefined : selectedPresetId,
      cardId: cardId ?? undefined,
      cardMessage: cardMessage.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      unitPrice,
      completedAt: existing?.completedAt ?? now,
    };
    if (existing) {
      setCollection(
        updateGiftCollectionItem(existing.id, {
          name: item.name,
          track: item.track,
          boxId: item.boxId,
          slots: item.slots,
          presetId: item.presetId,
          cardId: item.cardId,
          cardMessage: item.cardMessage,
          unitPrice: item.unitPrice,
          completedAt: item.completedAt,
        })
      );
      setStatus("Collection updated.");
    } else {
      setCollection(addToGiftCollection(item));
      setEditingCollectionId(item.id);
      setStatus("Added to your collection!");
    }
    setStep("complete");
  };

  const loadCollectionItem = (item: GiftSetCollectionItem, mode: "view" | "edit") => {
    if (!catalog) return;
    const box = catalog.boxes.find((b) => b.id === item.boxId);
    if (!box) return;
    setEditingCollectionId(item.id);
    setActiveTrack(item.track ?? "personal");
    setBoxId(item.boxId);
    setSlots([...item.slots]);
    setSetName(item.name);
    setCardId(item.cardId ?? null);
    setCardMessage(item.cardMessage ?? "");
    setSelectedPresetId(item.presetId ?? "custom");
    setActiveSlot(0);
    setOrderQty(1);
    setStatus(null);
    setRenamingId(null);
    setStep(mode === "view" ? "complete" : "build");
  };

  const startRename = (item: GiftSetCollectionItem) => {
    setRenamingId(item.id);
    setRenameDraft(item.name);
  };

  const commitRename = (id: string) => {
    const name = renameDraft.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    setCollection(updateGiftCollectionItem(id, { name }));
    if (editingCollectionId === id) setSetName(name);
    setRenamingId(null);
    setStatus("Set renamed.");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const resolveCollectionThumbImages = (item: GiftSetCollectionItem): string[] => {
    return item.slots
      .filter(Boolean)
      .map((id) => elementMap.get(id)?.image)
      .filter((src): src is string => Boolean(src));
  };

  const resolveCollectionPrice = (item: GiftSetCollectionItem): number => {
    if (!catalog) return item.unitPrice;
    const box = catalog.boxes.find((b) => b.id === item.boxId);
    if (!box) return item.unitPrice;
    const card = cardPresets.find((c) => c.id === item.cardId);
    return computeUnitPrice(box, item.slots, catalog.elements, card?.price ?? 0);
  };

  const addToBag = async () => {
    if (!selectedBox || !isBuildComplete) return;
    setStatus(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-gift-set",
          boxId: selectedBox.id,
          elementIds: slots,
          quantity: orderQty,
          setName: setName.trim() || "Custom gift set",
          cardId: cardId ?? undefined,
          cardMessage: cardMessage.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not add to basket.");
      await refreshCart();
      setStatus(`Added ${orderQty} gift set${orderQty === 1 ? "" : "s"} to your basket.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not add to basket.");
    }
  };

  const startAnother = () => {
    setStep("start");
    setSelectedPresetId("custom");
    setBoxId("");
    setSlots([]);
    setActiveSlot(0);
    setSetName("My gift set");
    setOrderQty(1);
    setEditingCollectionId(null);
    setRenamingId(null);
    setCardId(null);
    setCardMessage("");
    setStatus(null);
    setTrackUi({
      personal: { ...DEFAULT_TRACK_UI },
      corporate: { ...DEFAULT_TRACK_UI },
    });
  };

  const filteredElements = useMemo(() => {
    if (!catalog) return [];
    if (categoryFilter === "all") return catalog.elements;
    return catalog.elements.filter((el) => el.category === categoryFilter);
  }, [catalog, categoryFilter]);

  const { leftInventory, rightInventory } = useMemo(() => {
    const leftCategories = new Set<GiftElement["category"]>(["scent", "soap", "candle"]);
    const left = filteredElements.filter((el) => leftCategories.has(el.category));
    const right = filteredElements.filter((el) => !leftCategories.has(el.category));
    if (left.length === 0 && right.length === 0) {
      const half = Math.ceil(filteredElements.length / 2);
      return {
        leftInventory: filteredElements.slice(0, half),
        rightInventory: filteredElements.slice(half),
      };
    }
    if (left.length === 0) {
      const half = Math.ceil(right.length / 2);
      return {
        leftInventory: right.slice(0, half),
        rightInventory: right.slice(half),
      };
    }
    if (right.length === 0) {
      const half = Math.ceil(left.length / 2);
      return {
        leftInventory: left.slice(0, half),
        rightInventory: left.slice(half),
      };
    }
    return { leftInventory: left, rightInventory: right };
  }, [filteredElements]);

  const activeElement = slots[activeSlot] ? elementMap.get(slots[activeSlot]) ?? null : null;

  const renderInventoryItem = (element: GiftElement) => {
    const isEquipped = slots.includes(element.id);
    const isActivePick = slots[activeSlot] === element.id;
    return (
      <button
        key={element.id}
        type="button"
        className={`gift-builder-inv-item${isActivePick ? " is-selected" : ""}${
          isEquipped && !isActivePick ? " is-equipped" : ""
        }`}
        onClick={() => selectElement(element.id)}
        title={element.description}
      >
        <span className="gift-builder-inv-thumb" style={{ backgroundImage: `url(${element.image})` }} />
        <span className="gift-builder-inv-body">
          <strong>{element.name}</strong>
          <span>{formatItemPrice(element.price)}</span>
        </span>
        {isEquipped ? <span className="gift-builder-inv-badge">In box</span> : null}
      </button>
    );
  };

  const showInProgressDraft =
    (step === "build" || step === "complete") &&
    selectedBox !== null &&
    (!editingCollectionId || !collection.some((item) => item.id === editingCollectionId));

  const renderCollectionItems = (items: GiftSetCollectionItem[]) => (
    <ul className="gift-builder-collection-list">
      {items.map((item) => {
        const thumbImages = resolveCollectionThumbImages(item);
        const displayPrice = resolveCollectionPrice(item);
        const itemCard = item.cardId
          ? cardPresets.find((card) => card.id === item.cardId) ?? null
          : null;
        const isRenaming = renamingId === item.id;
        const isActive =
          editingCollectionId === item.id && (step === "build" || step === "complete");
        return (
          <li
            key={item.id}
            className={`gift-builder-collection-item${isActive ? " is-active" : ""}`}
          >
            <GiftSetThumbnail images={thumbImages} label={`${item.name} thumbnail`} />
            <div className="gift-builder-collection-body">
              {isRenaming ? (
                <form
                  className="gift-builder-collection-rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename(item.id);
                  }}
                >
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    maxLength={60}
                    autoFocus
                    aria-label="Set name"
                  />
                  <button type="submit" className="gift-builder-link-btn">
                    Save
                  </button>
                  <button type="button" className="gift-builder-link-btn" onClick={cancelRename}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="gift-builder-collection-name"
                  onClick={() => startRename(item)}
                  title="Rename set"
                >
                  {item.name}
                </button>
              )}
              <span>{formatItemPrice(displayPrice)}</span>
              <small>
                {item.slots.filter(Boolean).length} elements
                {itemCard ? ` · ${itemCard.name} card` : ""}
              </small>
              <div className="gift-builder-collection-actions">
                <button
                  type="button"
                  className="gift-builder-collection-btn"
                  onClick={() => loadCollectionItem(item, "view")}
                >
                  View
                </button>
                <button
                  type="button"
                  className="gift-builder-collection-btn"
                  onClick={() => loadCollectionItem(item, "edit")}
                >
                  Edit
                </button>
              </div>
            </div>
            {itemCard ? (
              <GiftSetCardSummary
                preset={itemCard}
                message={item.cardMessage}
                formatItemPrice={formatItemPrice}
                compact
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderTrackStartPanel = (
    track: GiftTrack,
    title: string,
    eyebrow: string,
    description: string,
    presets: GiftEventPreset[],
    highlights: string[]
  ) => {
    const ui = trackUi[track];
    const selectedPreset =
      ui.presetId !== "custom" ? presets.find((preset) => preset.id === ui.presetId) ?? null : null;
    const activeBoxId = ui.boxId || selectedPreset?.boxId || "";

    return (
      <section
        className={`gift-builder-track-panel gift-builder-track-panel--${track}`}
        aria-label={title}
      >
        <span className="gift-builder-track-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p className="gift-builder-panel-copy">{description}</p>

        <label className="gift-builder-field">
          <span>{track === "corporate" ? "Template" : "Occasion"}</span>
          <select
            value={ui.presetId}
            onChange={(e) => {
              const value = e.target.value;
              const preset = presets.find((p) => p.id === value) ?? null;
              updateTrackUi(track, {
                presetId: value,
                boxId: preset?.boxId ?? ui.boxId,
              });
            }}
          >
            <option value="custom">Start from scratch</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        {selectedPreset ? (
          <div className="gift-builder-preset-card gift-builder-preset-card--compact">
            <h3>{selectedPreset.label}</h3>
            <p>{selectedPreset.description}</p>
          </div>
        ) : null}

        <div className="gift-builder-track-boxes">
          <span className="gift-builder-track-boxes-label">Box size</span>
          <div className="gift-builder-track-box-grid">
            {catalog?.boxes.map((box) => (
              <button
                key={box.id}
                type="button"
                className={`gift-builder-track-box${activeBoxId === box.id ? " is-selected" : ""}`}
                onClick={() => updateTrackUi(track, { boxId: box.id })}
              >
                <span className="gift-builder-track-box-name">{box.name}</span>
                <span className="gift-builder-track-box-meta">
                  {box.slotCount} items · from {formatItemPrice(box.basePrice)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ul className="gift-builder-track-points">
          {highlights.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <button
          type="button"
          className="maroma-btn maroma-btn-primary gift-builder-track-start-btn"
          onClick={() => beginTrackBuild(track)}
        >
          {selectedPreset ? `Start with ${selectedPreset.label}` : "Start from scratch"}
        </button>
      </section>
    );
  };

  const renderCollectionSidebar = () => (
    <aside className="gift-builder-collection" aria-label="Your collections">
      <h2>Your collections</h2>
      <p className="gift-builder-panel-copy">
        Personal and corporate sets are saved separately so you can manage each flow without mixing
        them up.
      </p>

      <div className="gift-builder-collection-section">
        <h3>Personal collection</h3>
        {showInProgressDraft && activeTrack === "personal" && selectedBox ? (
          <div className="gift-builder-collection-draft" aria-label="Personal set in progress">
            <span className="gift-builder-collection-draft-label">In progress</span>
            <strong>{setName}</strong>
            <small>
              {filledSlots.length}/{selectedBox.slotCount} elements
              {selectedCard ? ` · ${selectedCard.name} card` : ""}
            </small>
          </div>
        ) : null}
        {personalCollection.length === 0 && !(showInProgressDraft && activeTrack === "personal") ? (
          <p className="gift-builder-collection-empty">No personal sets yet.</p>
        ) : personalCollection.length > 0 ? (
          renderCollectionItems(personalCollection)
        ) : null}
      </div>

      <div className="gift-builder-collection-section gift-builder-collection-section--corporate">
        <h3>Corporate collection</h3>
        {showInProgressDraft && activeTrack === "corporate" && selectedBox ? (
          <div className="gift-builder-collection-draft" aria-label="Corporate set in progress">
            <span className="gift-builder-collection-draft-label">In progress</span>
            <strong>{setName}</strong>
            <small>
              {filledSlots.length}/{selectedBox.slotCount} elements
              {selectedCard ? ` · ${selectedCard.name} card` : ""}
            </small>
          </div>
        ) : null}
        {corporateCollection.length === 0 && !(showInProgressDraft && activeTrack === "corporate") ? (
          <p className="gift-builder-collection-empty">No corporate sets yet.</p>
        ) : corporateCollection.length > 0 ? (
          renderCollectionItems(corporateCollection)
        ) : null}
      </div>
    </aside>
  );

  if (loading) {
    return (
      <main className="gift-builder-page">
        <p className="gift-builder-loading">Preparing your studio…</p>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="gift-builder-page">
        <p className="gift-builder-error">{status ?? "Gift builder unavailable."}</p>
      </main>
    );
  }

  return (
    <main className={`gift-builder-page${step === "build" ? " is-loadout" : ""}`}>
      <header className="gift-builder-hero">
        <Link href="/gifting" className="gift-builder-back">
          ← Back to gifting
        </Link>
        <span className="gift-builder-eyebrow">Gift curation studio</span>
        <h1 className="gift-builder-title">Build your gift set</h1>
        <p className="gift-builder-lede">
          Curate a bespoke gift set: choose your box, select each element, and review pricing
          before you order.
        </p>
        <div className="gift-builder-steps" aria-label="Builder progress">
          {BUILDER_STEPS.map((key, index) => {
            const isActive = step === key;
            const isDone = stepIndex(step) > index;
            const canGo = canNavigateToStep(key);
            return (
              <button
                key={key}
                type="button"
                className={`gift-builder-step-pill${isActive ? " is-active" : ""}${
                  isDone ? " is-done" : ""
                }${!canGo && !isActive ? " is-locked" : ""}`}
                onClick={() => goToStep(key)}
                disabled={!canGo}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${STEP_LABELS[key]}${isDone ? ", completed" : ""}${
                  isActive ? ", current step" : ""
                }`}
                title={STEP_LABELS[key]}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </header>

      <div className="gift-builder-layout">
        <div className="gift-builder-main">
          {step === "start" && (
            <div className="gift-builder-tracks">
              {renderTrackStartPanel(
                "personal",
                "Personal gifting",
                "For friends & family",
                "Celebrate birthdays, festivals, and everyday moments with a curated set you can tailor.",
                personalPresets,
                [
                  "Occasion templates for birthdays, weddings, and festivals",
                  "Optional handwritten greeting cards",
                  "Build one set or several for different recipients",
                ]
              )}
              {renderTrackStartPanel(
                "corporate",
                "Corporate gifting",
                "For teams & clients",
                "Professional sets for client appreciation, team milestones, and company events.",
                corporatePresets,
                [
                  "Volume pricing from 3 sets (5% off) through 10+ sets (15% off)",
                  "Consistent curation across multiple recipients",
                  "Optional greeting cards for each set",
                ]
              )}
            </div>
          )}

          {step === "build" && selectedBox && (
            <section className="gift-builder-loadout" aria-label="Gift set loadout">
              <div className="gift-builder-loadout-toolbar">
                <div>
                  <span className={`gift-builder-track-badge gift-builder-track-badge--${activeTrack}`}>
                    {activeTrack === "corporate" ? "Corporate" : "Personal"}
                  </span>
                  <h2>Build Your Gift Set</h2>
                  <p className="gift-builder-panel-copy">
                    Create a single gift set or multiple. See also our attractive bulk purchase pricing.
                    For larger orders, please feel free to email us at{" "}
                    <a href="mailto:maroma@mroma.com">maroma@mroma.com</a>.
                  </p>
                </div>
                <label className="gift-builder-field gift-builder-name-field">
                  <span>Set name</span>
                  <input
                    type="text"
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    maxLength={60}
                  />
                </label>
              </div>

              <div className="gift-builder-category-tabs gift-builder-loadout-tabs">
                <button
                  type="button"
                  className={categoryFilter === "all" ? "is-active" : ""}
                  onClick={() => setCategoryFilter("all")}
                >
                  All
                </button>
                {(Object.keys(CATEGORY_LABELS) as GiftElement["category"][]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={categoryFilter === cat ? "is-active" : ""}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="gift-builder-loadout-arena">
                <aside className="gift-builder-inv-rail gift-builder-inv-rail--left" aria-label="Components left">
                  <h3 className="gift-builder-inv-title">Scent · Soap · Candle</h3>
                  <div className="gift-builder-inv-scroll">
                    {leftInventory.map((element) => renderInventoryItem(element))}
                  </div>
                </aside>

                <div className="gift-builder-loadout-center">
                  <div className="gift-builder-box-stage">
                    <div className="gift-builder-box-visual gift-builder-box-visual--hero">
                      <div className="gift-builder-box-lid" />
                      <div
                        className={`gift-builder-box-cavity gift-builder-box-cavity--${selectedBox.slotCount}`}
                      >
                        {slots.map((slotId, index) => {
                          const element = slotId ? elementMap.get(slotId) : null;
                          return (
                            <button
                              key={index}
                              type="button"
                              className={`gift-builder-slot${activeSlot === index ? " is-active" : ""}${
                                element ? " is-filled" : ""
                              }`}
                              onClick={() => setActiveSlot(index)}
                              aria-label={`Slot ${index + 1}${element ? `: ${element.name}` : ""}`}
                            >
                              <span className="gift-builder-slot-label">Slot {index + 1}</span>
                              {element ? (
                                <>
                                  <img src={element.image} alt="" />
                                  <span>{element.name}</span>
                                </>
                              ) : (
                                <span className="gift-builder-slot-empty">+</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="gift-builder-slot-bar">
                    <span>
                      Active slot: <strong>{activeSlot + 1}</strong> of {selectedBox.slotCount}
                    </span>
                    {slots[activeSlot] ? (
                      <button
                        type="button"
                        className="gift-builder-link-btn"
                        onClick={() => clearSlot(activeSlot)}
                      >
                        Unequip slot
                      </button>
                    ) : (
                      <span className="gift-builder-slot-hint">Choose a component from the sides</span>
                    )}
                  </div>

                  {activeElement ? (
                    <div className="gift-builder-inspect">
                      <img src={activeElement.image} alt="" />
                      <div>
                        <h4>{activeElement.name}</h4>
                        <p>{activeElement.description}</p>
                        <span>{formatItemPrice(activeElement.price)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="gift-builder-inv-rail gift-builder-inv-rail--right" aria-label="Components right">
                  <h3 className="gift-builder-inv-title">Wellness · Accents</h3>
                  <div className="gift-builder-inv-scroll">
                    {rightInventory.map((element) => renderInventoryItem(element))}
                  </div>
                </aside>
              </div>

              <GiftSetCardAddon
                cardPresets={cardPresets}
                cardId={cardId}
                cardMessage={cardMessage}
                selectedCard={selectedCard}
                formatItemPrice={formatItemPrice}
                onEnable={enableCard}
                onDisable={disableCard}
                onSelectPreset={selectCardPreset}
                onMessageChange={setCardMessage}
              />

              <div className="gift-builder-loadout-footer">
                <div className="gift-builder-price-chip">
                  <span>Running total</span>
                  <strong>{formatItemPrice(unitPrice)}</strong>
                  <small>
                    Box {formatItemPrice(selectedBox.basePrice)} + elements{" "}
                    {formatItemPrice(
                      unitPrice - selectedBox.basePrice - (selectedCard?.price ?? 0)
                    )}
                    {selectedCard
                      ? ` + card ${formatItemPrice(selectedCard.price)}`
                      : ""}
                  </small>
                </div>
                <button
                  type="button"
                  className="maroma-btn maroma-btn-primary"
                  disabled={!isBuildComplete}
                  onClick={completeSet}
                >
                  {editingCollectionId ? "Save changes" : "Complete this set"}
                </button>
              </div>
            </section>
          )}

          {step === "complete" && selectedBox && (
            <section className="gift-builder-panel">
              <h2>Your set is ready</h2>
              <p className="gift-builder-panel-copy">
                Review quantity pricing. Save more when you order several identical sets.
              </p>

              <div className="gift-builder-complete-summary">
                <div className="gift-builder-complete-head">
                  <GiftSetThumbnail
                    images={filledSlots
                      .map((id) => elementMap.get(id)?.image)
                      .filter((src): src is string => Boolean(src))}
                    label={`${setName} thumbnail`}
                  />
                  <div>
                    <h3>{setName}</h3>
                    <p className="gift-builder-panel-copy">
                      {selectedBox.name} · {filledSlots.length} elements
                    </p>
                  </div>
                </div>
                <ul>
                  {slots.map((slotId, index) => {
                    const element = elementMap.get(slotId);
                    if (!element) return null;
                    return (
                      <li key={`${slotId}-${index}`}>
                        <img src={element.image} alt="" />
                        <div>
                          <strong>{element.name}</strong>
                          <p>{element.description}</p>
                        </div>
                        <span>{formatItemPrice(element.price)}</span>
                      </li>
                    );
                  })}
                </ul>
                {selectedCard ? (
                  <GiftSetCardSummary
                    preset={selectedCard}
                    message={cardMessage}
                    formatItemPrice={formatItemPrice}
                  />
                ) : null}
                <div className="gift-builder-complete-total">
                  <span>Per set (incl. box{selectedCard ? " + card" : ""})</span>
                  <strong>{formatItemPrice(unitPrice)}</strong>
                  {selectedCard ? (
                    <small>Includes {formatItemPrice(selectedCard.price)} greeting card</small>
                  ) : null}
                </div>
              </div>

              <div className="gift-builder-qty-table" aria-label="Quantity discounts">
                <h3>Quantity pricing</h3>
                <div className="gift-builder-qty-rows">
                  {tierRows.map((tier) => (
                    <button
                      key={tier.minQty}
                      type="button"
                      className={`gift-builder-qty-row${orderQty >= tier.minQty ? " is-highlight" : ""}`}
                      onClick={() => setOrderQty(tier.minQty)}
                    >
                      <span>{tier.label}</span>
                      <span>
                        {tier.discountRate > 0
                          ? `${Math.round(tier.discountRate * 100)}% off`
                          : "Standard"}
                      </span>
                      <strong>{formatItemPrice(tier.unitPrice)}</strong>
                      <em>Total {formatItemPrice(tier.total)}</em>
                    </button>
                  ))}
                </div>
              </div>

              <label className="gift-builder-field">
                <span>Order quantity</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </label>

              <div className="gift-builder-complete-price">
                <span>Your price</span>
                <strong>{formatItemPrice(discountedUnitPrice * orderQty)}</strong>
                <small>
                  {formatItemPrice(discountedUnitPrice)} each
                  {quantityDiscountRate(orderQty) > 0
                    ? ` · ${Math.round(quantityDiscountRate(orderQty) * 100)}% volume discount`
                    : ""}
                </small>
              </div>

              <div className="gift-builder-complete-actions">
                <button type="button" className="maroma-btn maroma-btn-primary" onClick={() => void addToBag()}>
                  Add to basket
                </button>
                <Link href="/cart" className="maroma-btn maroma-btn-ghost">
                  View basket
                </Link>
                <button
                  type="button"
                  className="maroma-btn maroma-btn-secondary"
                  onClick={() => setStep("build")}
                >
                  Edit set
                </button>
                <button type="button" className="maroma-btn maroma-btn-secondary" onClick={startAnother}>
                  Build another set
                </button>
              </div>
            </section>
          )}

          {status ? <p className="gift-builder-status">{status}</p> : null}
        </div>

        {renderCollectionSidebar()}
      </div>
    </main>
  );
}
