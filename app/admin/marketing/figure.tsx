type FigureProps = {
  src: string;
  alt: string;
  caption?: string;
  layout?: "wide" | "side" | "half";
  ratio?: "hero" | "landscape" | "portrait" | "story" | "wide" | "square";
};

export function Figure({
  src,
  alt,
  caption,
  layout,
  ratio = "landscape",
}: FigureProps) {
  const layoutClass = layout ? ` ml-fig-${layout}` : "";
  return (
    <figure className={`ml-figure${layoutClass}`}>
      <div className={`ml-figure-frame ml-ratio-${ratio}`}>
        <img src={src} alt={alt} />
        {caption ? (
          <figcaption className="ml-figure-caption">
            <span>{caption}</span>
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}
