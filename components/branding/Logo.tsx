import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * Chess Mind brand mark, generated from the approved
 * public/Assets/logo/chess_mind_logo.png reference (full circular badge —
 * chess-mind-full.png is a downscaled copy of it; chess-mind-emblem.png is
 * a cropped, transparent-edged square of just the crown/brain medallion for
 * small placements). Path casing here is exact and load-bearing, not a
 * style choice — the "Assets" folder was created outside the sandbox's
 * write access, so it couldn't be renamed to match this repo's usual
 * lowercase convention; Linux (production) filesystems are case-sensitive.
 *
 * - "full": the complete badge + wordmark + tagline lockup, raster image —
 *   only for spots with real room to breathe (splash, welcome).
 * - "compact": emblem only, no text — for small nav/header placements.
 * - "horizontal": emblem + "CHESS MIND" as real (crisp-at-any-size) text,
 *   not baked into the raster, for a wide-but-short header lockup.
 */
type LogoVariant = "full" | "compact" | "horizontal";

export function Logo({
  variant = "compact",
  size = 32,
  href,
  className = "",
}: {
  variant?: LogoVariant;
  /** Pixel size of the emblem (compact/horizontal) or max-width (full). */
  size?: number;
  /** If set, the logo becomes a link (e.g. home/dashboard). */
  href?: string;
  className?: string;
}) {
  const alt = `${BRAND.name} — ${BRAND.tagline}`;

  const content =
    variant === "full" ? (
      <img
        src="/Assets/logo/chess-mind-full.png"
        alt={alt}
        style={{ maxWidth: size, width: "100%", height: "auto" }}
        className={className}
      />
    ) : variant === "horizontal" ? (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src="/Assets/logo/chess-mind-emblem.png"
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
        />
        <span className="font-classic-display font-semibold tracking-wide text-premium-gold">
          {BRAND.name.toUpperCase()}
        </span>
      </span>
    ) : (
      <img
        src="/Assets/logo/chess-mind-emblem.png"
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={className}
      />
    );

  if (!href) return content;

  return (
    <Link href={href} aria-label={`${BRAND.name} home`} className="inline-flex items-center">
      {content}
    </Link>
  );
}
