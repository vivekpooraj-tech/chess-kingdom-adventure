/**
 * Chess Mind design system — Skeleton. Small shared primitive for
 * route-level loading.tsx files, so every route's instant-feedback skeleton
 * is built the same way instead of each one hand-rolling animate-pulse divs
 * (see app/profile/loading.tsx's own header comment for why these exist at
 * all — Next.js renders a route's loading.tsx the instant navigation
 * starts, before any data fetching, which is what makes a tap register
 * immediately instead of showing nothing for a full request round-trip).
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded-premiumCard bg-premium-navy animate-pulse ${className}`} />;
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return <div className={`rounded-premiumBtn bg-premium-navy/60 animate-pulse ${className}`} />;
}
