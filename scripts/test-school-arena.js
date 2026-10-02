const assert = require("assert");
const fs = require("fs");
const path = require("path");

function read(...parts) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

let passed = 0;
function check(name, ok) {
  if (!ok) throw new Error(name);
  passed += 1;
  console.log("ok", name);
}

const arena = read("lib", "school", "schoolArena.ts");
check("no fabricated ratings in schoolArena", !/rating|accuracy %|masteryPercent/i.test(arena));
check("titles are world-specific", /Kingdom Learning Journey/.test(arena) && /Academy Curriculum/.test(arena) && /Classical Chess Study Program/.test(arena));
check("fen helper uses real session steps", /firstLessonFen/.test(arena) && /firstTeachLines/.test(arena));

const home = read("components", "school", "v2", "SchoolHome.tsx");
check("SchoolHome branches by world", /EnchantedJourney/.test(home) && /AtelierCurriculum/.test(home) && /ClassicSyllabus/.test(home));
check("SchoolHome has no progressbar", !/percentComplete|progressbar/.test(home));

const enc = read("components", "school", "v2", "world", "EnchantedJourney.tsx");
const at = read("components", "school", "v2", "world", "AtelierCurriculum.tsx");
const cl = read("components", "school", "v2", "world", "ClassicSyllabus.tsx");
check("Enchanted is journey-first", /sch-path/.test(enc) && /sch-trail/.test(enc));
check("Atelier is curriculum-first", /sch-block/.test(at) && /sch-curriculum/.test(at) && !/sch-path/.test(at));
check("Classic is syllabus-first", /sch-sheet/.test(cl) && /sch-syllabus/.test(cl) && !/sch-path/.test(cl));
check("Classic does not invent a fen", /firstLessonFen/.test(cl));
check("shared CTA and unlock remain", /SchoolPrimaryAction/.test(enc) && /UnlockSchoolButton/.test(read("components", "school", "v2", "world", "SchoolPrimaryAction.tsx")));

assert.ok(passed >= 10);
console.log(`${passed} pass`);
