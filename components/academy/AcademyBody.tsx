"use client";

import Link from "next/link";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { BRAND } from "@/lib/brand";
import { ACADEMY_CATEGORIES } from "@/content/academyIndex";
import { LEARNING_PATH_STAGES } from "@/lib/learner/learningPath";
import { backLabel } from "@/lib/navigation/destinations";
import { courseLabel, currentStage, useAcademyPath } from "./useAcademyPath";

/**
 * /academy in three world presentations. ONE data source (content/academyIndex.ts + the learner's real learning path),
 * three compositions:
 *   Enchanted: a winding journey trail of the sections, with the current adventure at the top.
 *   Atelier:   an editorial programme: the current stage as the lead, the library as a numbered index.
 *   Classic:   a spacious syllabus: thin rules, one column of sections, the current course set apart.
 * Presentation only: nothing here changes lessons, progress or unlocks. Styles: `.ac-*` in app/world-academy.css, each world
 * in its own section (`.ac-en`, `.ac-at`, `.ac-cl`).
 */

const FALLBACK = LEARNING_PATH_STAGES[0];
const pad = (n: number) => String(n).padStart(2, "0");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

interface Props {
  lessonIdsByCourse: Record<string, string[]>;
}

function useCurrent(lessonIdsByCourse: Record<string, string[]>) {
  const path = useAcademyPath(lessonIdsByCourse);
  return { path, current: currentStage(path, FALLBACK) };
}

function progressText(c: { completed: number | null; total: number | null }) {
  return c.completed === null || c.total === null ? null : `${c.completed} of ${c.total} lessons`;
}

function Back() {
  return (
    <Link href="/learn" className="ac-back">
      {backLabel("LEARN")}
    </Link>
  );
}

function Status({ path, courseId }: { path: ReturnType<typeof useAcademyPath>; courseId?: string }) {
  const s = courseLabel(path, courseId);
  return s ? <span className={`ac-chip${s.done ? " is-done" : ""}`}>{s.label}</span> : null;
}

/* ------------------------------ Enchanted ------------------------------ */
function Enchanted({ lessonIdsByCourse }: Props) {
  const { path, current } = useCurrent(lessonIdsByCourse);
  const txt = progressText(current);
  return (
    <div className="ac ac-en">
      <header className="ac-en__head world-enter">
        <p className="world-kicker">{BRAND.academyName}</p>
        <h1 className="ac-en__title">{BRAND.academyTagline}</h1>
        <p className="ac-en__lede">Every lesson is a step on the journey. Pick up where the adventure left off.</p>
      </header>

      <Link href={current.href} className="ac-en-now world-enter">
        <span className="ac-en-now__orb" aria-hidden="true">✦</span>
        <span className="ac-en-now__text">
          <span className="ac-en-now__label">Your adventure</span>
          <span className="ac-en-now__title">{current.title}</span>
          <span className="ac-en-now__sub">{txt ?? current.blurb}</span>
        </span>
        <span className="ac-en-now__cta">
          {current.verb} <span aria-hidden="true">→</span>
        </span>
      </Link>

      <ol className="ac-en-trail" aria-label="Academy sections">
        {ACADEMY_CATEGORIES.map((c, i) => {
          const here = Boolean(c.courseId) && c.courseId === path?.currentCourseId;
          return (
            <li key={c.id} className={`ac-en-stop${i % 2 ? " is-right" : ""}`}>
              <Link href={c.href ?? "#"} className={`ac-en-card${here ? " is-current" : ""}`}>
                <span className="ac-en-card__medal" aria-hidden="true">{c.emoji}</span>
                <span className="ac-en-card__text">
                  <span className="ac-en-card__title">{c.title}</span>
                  <span className="ac-en-card__desc">{c.description}</span>
                </span>
                <Status path={path} courseId={c.courseId} />
                <span className="ac-en-card__go" aria-hidden="true">→</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Back />
    </div>
  );
}

/* ------------------------------- Atelier -------------------------------- */
function Atelier({ lessonIdsByCourse }: Props) {
  const { path, current } = useCurrent(lessonIdsByCourse);
  const txt = progressText(current);
  const stageNo = Math.max(1, LEARNING_PATH_STAGES.findIndex((s) => s.title === current.title) + 1);
  return (
    <div className="ac ac-at">
      <header className="ac-at-mast">
        <p className="ac-at-eyebrow">{BRAND.academyName}</p>
        <h1 className="ac-at-title">
          Learn. Practice. <em>Master.</em>
        </h1>
      </header>

      <div className="ac-at-grid">
        <Link href={current.href} className="ac-at-lead">
          <span className="ac-at-eyebrow">
            Current programme · Stage {pad(stageNo)} of {pad(LEARNING_PATH_STAGES.length)}
          </span>
          <span className="ac-at-lead__title">{current.title}</span>
          <span className="ac-at-lead__desc">{current.blurb}</span>
          {current.completed !== null && current.total ? (
            <span className="ac-at-meter" role="img" aria-label={`${current.completed} of ${current.total} lessons complete`}>
              <span style={{ width: `${Math.round((current.completed / current.total) * 100)}%` }} />
            </span>
          ) : null}
          <span className="ac-at-lead__foot">
            <span className="ac-at-cta">
              {current.verb} programme <span aria-hidden="true">→</span>
            </span>
            {txt && <span className="ac-at-count">{txt}</span>}
          </span>
        </Link>

        <ol className="ac-at-index" aria-label="Academy sections">
          {ACADEMY_CATEGORIES.map((c, i) => (
            <li key={c.id}>
              <Link href={c.href ?? "#"} className="ac-at-row">
                <span className="ac-at-row__no" aria-hidden="true">{pad(i + 1)}</span>
                <span className="ac-at-row__text">
                  <span className="ac-at-row__title">{c.title}</span>
                  <span className="ac-at-row__desc">{c.description}</span>
                </span>
                <Status path={path} courseId={c.courseId} />
                <span className="ac-at-row__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <Back />
    </div>
  );
}

/* ------------------------------- Classic -------------------------------- */
function Classic({ lessonIdsByCourse }: Props) {
  const { path, current } = useCurrent(lessonIdsByCourse);
  const txt = progressText(current);
  return (
    <div className="ac ac-cl">
      <header className="ac-cl-top">
        <p className="world-kicker">{BRAND.academyName}</p>
        <h1 className="ac-cl-title">{BRAND.academyTagline}</h1>
        <p className="ac-cl-lede">History, tactics, strategy, endgames and openings: the full study programme.</p>
      </header>

      <Link href={current.href} className="ac-cl-current">
        <span className="ac-cl-label">Current course</span>
        <span className="ac-cl-current__title">{current.title}</span>
        <span className="ac-cl-current__desc">{txt ?? current.blurb}</span>
        <span className="ac-cl-cta">
          {current.verb} <span aria-hidden="true">→</span>
        </span>
      </Link>

      <section aria-labelledby="ac-cl-syllabus">
        <h2 id="ac-cl-syllabus" className="ac-cl-label">Syllabus</h2>
        <ol className="ac-cl-list">
          {ACADEMY_CATEGORIES.map((c, i) => (
            <li key={c.id}>
              <Link href={c.href ?? "#"} className="ac-cl-row">
                <span className="ac-cl-row__no" aria-hidden="true">{ROMAN[i]}</span>
                <span className="ac-cl-row__text">
                  <span className="ac-cl-row__title">{c.title}</span>
                  <span className="ac-cl-row__desc">{c.description}</span>
                </span>
                <Status path={path} courseId={c.courseId} />
                <span className="ac-cl-row__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <Back />
    </div>
  );
}

export function AcademyBody(props: Props) {
  return <WorldBranch classic={<Classic {...props} />} atelier={<Atelier {...props} />} other={<Enchanted {...props} />} />;
}
