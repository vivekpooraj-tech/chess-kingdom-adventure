import { ACHIEVEMENTS } from "@/content/achievements";
import { Card } from "@/components/ui/Card";

export function AchievementBadges({ earnedKeys }: { earnedKeys: string[] }) {
  const earnedSet = new Set(earnedKeys);

  return (
    <Card className="w-full max-w-lg flex flex-col gap-4">
      <h2 className="font-display text-lg text-kingdom-night">
        Achievements ({earnedKeys.length}/{ACHIEVEMENTS.length})
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const earned = earnedSet.has(a.key);
          return (
            <div
              key={a.key}
              title={earned ? a.description : "Not earned yet"}
              className="flex flex-col items-center gap-1 text-center"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                  earned ? "bg-kingdom-gold/80 shadow-toy" : "bg-kingdom-night/10 grayscale opacity-40"
                }`}
              >
                {earned ? a.emoji : "🔒"}
              </div>
              <span className="font-body text-[10px] text-kingdom-night/60 leading-tight">
                {a.title}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
