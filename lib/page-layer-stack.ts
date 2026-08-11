import { clampHeroLayerDepth } from "./hero-layer-depth";

/** Page-level shells that compete for paint order under `.page.maroma`. */
export type PageShellId = "hero" | "ritual-band" | "rituals" | "loved";

export type PageShellStackInput = {
  heroBackgroundStackZ: number;
  heroMediaStackZ: number;
  heroCopyStackZ: number;
  heroRitualBandStackZ: number;
  heroRitualStackZ: number;
  lovedFloralsStackZ: number;
  lovedWashStackZ: number;
  lovedBandStackZ: number;
  lovedContentStackZ: number;
};

export type PageShellPaintZ = Record<PageShellId, number>;

/** Map 1–10 stack depth to paint z-index (wider spread so layers don't tie). */
export function stackDepthToPaintZ(stackZ: number): number {
  return clampHeroLayerDepth(stackZ, 1) * 10;
}

/** Hero section shell — highest of in-hero layers (background, media, copy). */
export function heroShellStackZ(input: Pick<
  PageShellStackInput,
  "heroBackgroundStackZ" | "heroMediaStackZ" | "heroCopyStackZ"
>): number {
  return clampHeroLayerDepth(
    Math.max(
      clampHeroLayerDepth(input.heroBackgroundStackZ, 1),
      clampHeroLayerDepth(input.heroMediaStackZ, 1),
      clampHeroLayerDepth(input.heroCopyStackZ, 1)
    ),
    1
  );
}

/** Loved section shell — highest of loved sub-layers. */
export function lovedShellStackZ(input: Pick<
  PageShellStackInput,
  "lovedFloralsStackZ" | "lovedWashStackZ" | "lovedBandStackZ" | "lovedContentStackZ"
>): number {
  return clampHeroLayerDepth(
    Math.max(
      clampHeroLayerDepth(input.lovedFloralsStackZ, 1),
      clampHeroLayerDepth(input.lovedWashStackZ, 1),
      clampHeroLayerDepth(input.lovedBandStackZ, 1),
      clampHeroLayerDepth(input.lovedContentStackZ, 1)
    ),
    1
  );
}

/** Paint z-index for each page shell — compared directly on desktop + mobile. */
export function resolvePageShellPaintZ(input: PageShellStackInput): PageShellPaintZ {
  const hero = stackDepthToPaintZ(heroShellStackZ(input));
  const loved = stackDepthToPaintZ(lovedShellStackZ(input));
  const floralsDepth = clampHeroLayerDepth(input.lovedFloralsStackZ, 1);
  const bandDepth = clampHeroLayerDepth(input.heroRitualBandStackZ, 1);
  const ritualDepth = clampHeroLayerDepth(input.heroRitualStackZ, 1);

  let ritualBand = stackDepthToPaintZ(bandDepth);
  let rituals = stackDepthToPaintZ(ritualDepth);

  // Band always paints above the loved section shell so height/width stay visually
  // stable — stack depth only orders band vs hero and carousel, not vs loved.
  if (ritualBand <= loved) {
    ritualBand = loved + 1;
  }
  // Product tiles always paint on top of the frosted band (stack depth only orders vs hero).
  if (rituals <= ritualBand) {
    rituals = ritualBand + 1;
  }
  // When carousel depth >= florals depth, nudge above loved shell (breaks DOM-order ties).
  if (ritualDepth >= floralsDepth && rituals <= loved) {
    rituals = loved + 1;
  }

  return { hero, "ritual-band": ritualBand, rituals, loved };
}

export function pageShellStackCssVars(
  paint: PageShellPaintZ
): Record<`--page-layer-z-${PageShellId}`, string> {
  return {
    "--page-layer-z-hero": String(paint.hero),
    "--page-layer-z-ritual-band": String(paint["ritual-band"]),
    "--page-layer-z-rituals": String(paint.rituals),
    "--page-layer-z-loved": String(paint.loved),
  };
}
