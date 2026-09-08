import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { LESSONS } from "@/content/lessons";
import { skillsLearned } from "@/lib/school/curriculum";

/**
 * Day 30 — the end of "Speak Chess in 30 Days".
 *
 * Rendered ONLY when every day is genuinely complete; the caller decides, and
 * this component has no "nearly there" mode, so it cannot congratulate anyone
 * early. Everything it lists is derived from the completed-day rows: the day
 * count is the real count, and the skills are the skill tags of the lessons
 * the learner actually finished. Nothing here is a stock list of things a
 * graduate is assumed to know.
 *
 * The three next actions all point at things that exist today. No certificate
 * download, no shareable badge, no score — none of that is built, and a
 * button that does nothing would be worse than no button.
 */
export function GraduationPanel({
  completedDays,
  neutralTone,
}: {
  completedDays: number[];
  neutralTone: boolean;
}) {
  const skills = skillsLearned(completedDays);
  const days = new Set(completedDays.filter((d) => Number.isFinite(d)).map((d) => Math.floor(d)));
  const realCount = LESSONS.filter((l) => days.has(l.dayNumber)).length;

  return (
    <section
      aria-labelledby="graduation-heading"
      className="w-full rounded-premiumCard bg-gradient-to-br from-premium-gold/15 to-premium-navy border border-premium-gold/40 p-5 sm:p-6 flex flex-col gap-4 shadow-premiumCard"
    >
      <div>
        <p className={`${TEXT.meta} text-premium-gold`}>🏆 Chess School Graduate</p>
        <h2
          id="graduation-heading"
          className="font-classic-display text-xl sm:text-2xl text-premium-ivory mt-1"
        >
          {neutralTone
            ? `You completed Speak Chess in ${realCount} Days.`
            : `You did it — all ${realCount} days!`}
        </h2>
        <p className={`${TEXT.body} mt-2`}>
          {neutralTone
            ? "Every lesson, every puzzle, every mini match. The course is finished — the chess isn't."
            : "Every single day of Chess School is finished. You know how chess works now. Time to play!"}
        </p>
      </div>

      {skills.length > 0 && (
        <div>
          <p className={`${TEXT.caption} uppercase tracking-wide mb-2`}>
            What you learned · {skills.length} skills
          </p>
          <ul className="flex flex-wrap gap-1.5 list-none">
            {skills.map((skill) => (
              <li
                key={skill}
                className="font-classic-body text-[11px] text-premium-ivory/80 border border-premium-gold/30 bg-white/[0.03] rounded-full px-2.5 py-1"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { href: "/puzzles", label: "🧩 Practise tactics" },
          { href: "/play", label: "♟ Play a game" },
          { href: "/kingdom-map#journey", label: "📚 Review lessons" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="font-classic-body text-sm font-semibold text-premium-ivory border border-premium-gold/40 rounded-full px-4 py-2.5 min-h-[44px] flex items-center hover:bg-white/5 active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
