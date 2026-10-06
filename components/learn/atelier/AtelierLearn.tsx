import Link from "next/link";
import { ForParentsEntry } from "@/components/nav/ForParentsEntry";
import { NextLessonCard } from "@/components/learner/NextLessonCard";
import { CourseStatusChip } from "@/components/learner/CourseStatusChip";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { LEARN_CHESS } from "@/content/learnIndex";
import { COURSE_NAME } from "@/lib/school/chessSchool";
import { AtelierProgramme } from "./AtelierProgramme";

/**
 * Master Training Atelier — Training Academy (the Atelier presentation of /learn).
 *
 * A presentation branch only: every route, course, lesson list and progress source is the one the shared Learn
 * page uses (content/learnIndex.ts, content/chessMindCategories.ts, getCourse via `lessonIdsByCourse`, the shared
 * completed-lessons request, /api/learn/next-lesson). Nothing here invents a number: counts and statuses come from
 * the same islands, and an unavailable value stays unavailable.
 *
 * Layout: masthead · current programme (lead) with the next session beside it · curriculum as a numbered editorial
 * index · performance training. Styles are `.ta-*` in app/worlds.css.
 */

interface Row {
  title: string;
  description: string;
  href: string;
  courseId?: string;
}

interface Section {
  no: string;
  name: string;
  note: string;
  rows: Row[];
}

const item = (id: string): Row => {
  const found = LEARN_CHESS.find((i) => i.id === id);
  if (!found) throw new Error(`Learn item missing: ${id}`);
  return { title: found.title, description: found.description, href: found.href, courseId: found.courseId };
};

const tactical = CHESS_MIND_CATEGORIES.find((c) => c.id === "tactical");

function sections(): Section[] {
  return [
    {
      no: "01",
      name: "Foundations",
      note: "The board, the pieces, the rules — and where the game came from.",
      rows: [
        {
          title: COURSE_NAME,
          description: "From zero to playing real people. 30 sessions with Ollie as your coach, at your own pace.",
          href: "/chess-school",
        },
        item("fundamentals"),
        item("origins"),
      ],
    },
    {
      no: "02",
      name: "Tactical training",
      note: "The patterns that win material, and the habit of looking before you move.",
      rows: [
        item("tactics"),
        ...(tactical && tactical.href
          ? [{ title: tactical.title, description: tactical.description, href: tactical.href, courseId: "tactical-thinking" }]
          : []),
      ],
    },
    {
      no: "03",
      name: "Strategic training",
      note: "Forming a plan, and converting an advantage when the board empties.",
      rows: [item("strategy"), item("endgames")],
    },
    {
      no: "04",
      name: "Openings",
      note: "Principles first, then the named systems.",
      rows: [item("openings")],
    },
  ];
}

function CurriculumRow({ row, lessonIdsByCourse }: { row: Row; lessonIdsByCourse: Record<string, string[]> }) {
  return (
    <li>
      <Link href={row.href} className="ta-row">
        <span className="ta-row__text">
          <span className="ta-row__title">{row.title}</span>
          <span className="ta-row__desc">{row.description}</span>
        </span>
        {row.courseId ? (
          <CourseStatusChip courseId={row.courseId} lessonIds={lessonIdsByCourse[row.courseId] ?? []} variant="atelier" />
        ) : null}
        <span className="ta-row__go" aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

export function AtelierLearn({ lessonIdsByCourse }: { lessonIdsByCourse: Record<string, string[]> }) {
  // Tactical Thinking sits in the curriculum above; the rest of Chess Mind is the performance-training list.
  const mind = CHESS_MIND_CATEGORIES.filter((c) => c.id !== "tactical");

  return (
    <div className="ta">
      <header className="ta-mast">
        <div className="ta-mast__main">
          <p className="ta-eyebrow">Master Training Atelier</p>
          <h1 className="ta-title">
            Training <em>Academy</em>
          </h1>
          <p className="ta-lede">
            Structured lessons on the game, and deliberate training for how you think about it.
          </p>
        </div>
        <nav className="ta-index" aria-label="Academy sections">
          <a href="#ta-programme">Programme</a>
          <a href="#ta-curriculum">Curriculum</a>
          <a href="#ta-mind">Mind training</a>
        </nav>
      </header>

      <div className="ta-lead">
        <AtelierProgramme lessonIdsByCourse={lessonIdsByCourse} />
        <NextLessonCard variant="atelier" />
      </div>

      <section className="ta-curriculum" id="ta-curriculum" aria-labelledby="ta-curriculum-title">
        <div className="ta-head">
          <p className="ta-eyebrow">The curriculum</p>
          <h2 id="ta-curriculum-title" className="ta-h2">The four disciplines of the Academy</h2>
        </div>
        {sections().map((s) => (
          <div key={s.no} className="ta-cur">
            <div className="ta-cur__label">
              <span className="ta-cur__no" aria-hidden="true">{s.no}</span>
              <h3 className="ta-cur__name">{s.name}</h3>
              <p className="ta-cur__note">{s.note}</p>
            </div>
            <ul className="ta-rows">
              {s.rows.map((row) => (
                <CurriculumRow key={row.href} row={row} lessonIdsByCourse={lessonIdsByCourse} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="ta-mind" id="ta-mind" aria-labelledby="ta-mind-title">
        <div className="ta-head">
          <p className="ta-eyebrow">Performance training</p>
          <h2 id="ta-mind-title" className="ta-h2">Train your chess mind</h2>
        </div>
        <ul className="ta-rows ta-rows--two">
          {mind.map((cat) => (
            <li key={cat.id}>
              {cat.href ? (
                <Link href={cat.href} className="ta-row">
                  <span className="ta-row__text">
                    <span className="ta-row__title">{cat.title}</span>
                    <span className="ta-row__desc">{cat.description}</span>
                  </span>
                  <span className="ta-row__go" aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="ta-row ta-row--soon">
                  <span className="ta-row__text">
                    <span className="ta-row__title">{cat.title}</span>
                    <span className="ta-row__desc">{cat.description}</span>
                  </span>
                  <span className="ta-chip">Soon</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <ForParentsEntry />
    </div>
  );
}
