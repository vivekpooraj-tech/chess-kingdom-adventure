/**
 * Static regression test: Watch is enabled everywhere it is meant to appear, exactly once per surface.
 *   node scripts/test-watch-nav.js
 * Reads components/nav/navConfig.tsx and PrimaryNav.tsx as text (like the other static nav tests): Watch is a real link to /watch on the phone/tablet
 * bottom bar (order Home | School | Puzzles | Watch | Profile), never `disabled` / "Soon", one entry in the desktop sidebar, not duplicated, and
 * /watch gets the app chrome. The rendered result (visible, clickable, one visible Watch per layout) is checked by test-watch-browser.js.
 */
const fs = require("fs");
const read = (p) => fs.readFileSync(p, "utf8");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok  " + n); } else { fails.push(n); console.log("FAIL  " + n + (d ? "  -> " + d : "")); } };

const cfg = read("components/nav/navConfig.tsx");
const block = (name) => { const m = cfg.match(new RegExp(`export const ${name}[^=]*= \\[([\\s\\S]*?)\\n\\];`)); return m ? m[1] : ""; };
const labels = (b) => [...b.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

const phone = block("PHONE_NAV_ITEMS"), side = block("NAV_ITEMS"), more = block("SECONDARY_NAV_ITEMS");
check("PHONE_NAV_ITEMS order is Home | School | Puzzles | Watch | Profile", JSON.stringify(labels(phone)) === JSON.stringify(["Home", "School", "Puzzles", "Watch", "Profile"]), JSON.stringify(labels(phone)));
const phoneWatch = (phone.match(/\{[^{}]*label:\s*"Watch"[^{}]*\}/) || [""])[0];
check("phone Watch links to /watch", /href:\s*"\/watch"/.test(phoneWatch), phoneWatch);
check("phone Watch is not disabled", !/disabled/.test(phoneWatch), phoneWatch);
check("no phone nav item is disabled (no 'Soon' tab anywhere)", !/disabled:\s*true/.test(phone));
check("exactly one Watch on the phone bar", labels(phone).filter((l) => l === "Watch").length === 1);
check("desktop sidebar has Watch exactly once in total (primary + Explore)", labels(side).concat(labels(more)).filter((l) => l === "Watch").length === 1, JSON.stringify(labels(side).concat(labels(more))));
const sideWatch = (more.match(/\{[^{}]*label:\s*"Watch"[^{}]*\}/) || [""])[0];
check("sidebar Watch links to /watch and is not disabled", /href:\s*"\/watch"/.test(sideWatch) && !/disabled/.test(sideWatch), sideWatch);
check("/watch is an app-chrome route (bottom bar / sidebar render on it)", /APP_PREFIXES\s*=\s*\[[\s\S]*?"\/watch"[\s\S]*?\]/.test(cfg));
check("the config has no other Watch entries (total 2: phone + sidebar)", (cfg.match(/label:\s*"Watch"/g) || []).length === 2, String((cfg.match(/label:\s*"Watch"/g) || []).length));
const nav = read("components/nav/PrimaryNav.tsx"), side2 = read("components/nav/SideNav.tsx");
check("PrimaryNav renders PHONE_NAV_ITEMS straight from navConfig (nothing overrides it)", /PHONE_NAV_ITEMS/.test(nav) && !/"Watch"/.test(nav));
check("SideNav renders NAV_ITEMS + SECONDARY_NAV_ITEMS straight from navConfig", /NAV_ITEMS/.test(side2) && /SECONDARY_NAV_ITEMS/.test(side2) && !/"Watch"/.test(side2));
check("the /watch page exists", fs.existsSync("app/watch/page.tsx"));
console.log(`\n=== WATCH NAV: ${pass} passed, ${fails.length} failed ===`);
process.exit(fails.length ? 1 : 0);
