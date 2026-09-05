import { TEXT } from "@/lib/designSystem";

/**
 * A single line from Ollie, inline in a lesson.
 *
 * Presentational and deliberately small — this is a coach's aside, not a
 * feature. It renders nothing when there is nothing worth saying, so callers
 * can pass a possibly-missing note without guarding.
 */
export function OllieNote({
  children,
  buddyEmoji = "🦉",
  className = "",
}: {
  children?: string | null;
  buddyEmoji?: string;
  className?: string;
}) {
  if (!children) return null;

  return (
    <div
      className={`flex gap-3 rounded-premiumBtn border border-premium-gold/20 bg-premium-navyLight/40 p-3 ${className}`}
    >
      <span aria-hidden="true" className="text-xl leading-none flex-none">
        {buddyEmoji}
      </span>
      <p className={TEXT.body}>
        <span className="sr-only">Ollie says: </span>
        {children}
      </p>
    </div>
  );
}
