type GiftSetThumbnailProps = {
  images: string[];
  label?: string;
};

export function GiftSetThumbnail({ images, label }: GiftSetThumbnailProps) {
  const count = Math.min(images.length, 5);
  if (count === 0) {
    return (
      <div className="gift-set-thumb gift-set-thumb--empty" aria-hidden>
        <span>+</span>
      </div>
    );
  }

  return (
    <div
      className="gift-set-thumb"
      data-count={count}
      role="img"
      aria-label={label ?? `Gift set with ${count} items`}
    >
      {images.slice(0, 5).map((src, index) => (
        <img key={`${src}-${index}`} src={src} alt="" loading="lazy" />
      ))}
    </div>
  );
}
