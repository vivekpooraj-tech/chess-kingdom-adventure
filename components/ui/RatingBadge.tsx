/**
 * Chess Mind design system — RatingBadge (Phase: mobile UI/UX redesign).
 * A small, reusable pill for showing a child's chess rating consistently
 * across Home, Play, Profile, and the post-game result screen instead of
 * each screen formatting the number by hand. Never shows a hardcoded
 * fallback value — the caller always passes the real rating from
 * children.rating (see supabase/migrations/0026_rating_system_hardening.sql).
 */
export function RatingBadge({
  rating,
  size = "md",
  className = "",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "lg"
      ? "text-2xl px-3.5 py-1.5"
      : size === "sm"
      ? "text-xs px-2 py-0.5"
      : "text-sm px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-premium-gold/15 border border-premium-gold/30 font-classic-display text-premium-gold ${sizeClass} ${className}`}
    >
      ♟ {rating.toLocaleString()}
    </span>
  );
}
