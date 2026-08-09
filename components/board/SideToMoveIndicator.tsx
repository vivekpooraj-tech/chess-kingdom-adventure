import clsx from "clsx";
import type { Color } from "chess.js";

/** Chess.com-style "White to move" / "Black to move" badge. */
export function SideToMoveIndicator({
  color,
  tone = "adventure",
}: {
  color: Color;
  tone?: "adventure" | "premium";
}) {
  if (tone === "premium") {
    return (
      <div className="flex items-center gap-2 rounded-full bg-premium-navy border border-white/10 px-4 py-1.5">
        <span
          className={clsx(
            "w-4 h-4 rounded-full border-2 border-premium-ivory/30",
            color === "w" ? "bg-premium-ivory" : "bg-premium-midnightDeep"
          )}
        />
        <span className="font-classic-body text-sm text-premium-ivory">
          {color === "w" ? "White" : "Black"} to move
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/85 shadow-toy px-4 py-1.5">
      <span
        className={clsx(
          "w-4 h-4 rounded-full border-2 border-kingdom-night/30",
          color === "w" ? "bg-white" : "bg-kingdom-night"
        )}
      />
      <span className="font-display text-sm text-kingdom-night">
        {color === "w" ? "White" : "Black"} to move
      </span>
    </div>
  );
}
