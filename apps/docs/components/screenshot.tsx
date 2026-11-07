import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

/**
 * A framed product screenshot with a caption. Images live in `public/screenshots/` and are
 * captured from `/playground` at 1680×1000 (1.5× DPR), so the default size matches them.
 */
export function Screenshot({
  src,
  alt,
  caption,
  width = 2520,
  height = 1500,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  return (
    <figure className="not-prose my-6">
      <div className="overflow-hidden rounded-xl border bg-fd-card shadow-sm">
        <ImageZoom
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="m-0 h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
