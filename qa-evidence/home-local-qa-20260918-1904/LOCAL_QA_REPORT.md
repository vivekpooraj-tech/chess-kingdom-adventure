# Home Redesign — Local Physical QA Report

**Date:** 2026-09-18  
**Build:** Debug APK → `http://localhost:3000` (dev server, `cap:sync:dev`)  
**Account:** rajyam141502@gmail.com (ready child `556bdac3-…`)  
**Devices:** Motorola `ZY32KGHHJ6` (411×914 phone), Lenovo `HA1QEERL` (800×1309 portrait / 1333×776 landscape tablet)

---

## Environment Setup

| Step | Result |
|------|--------|
| `npm run dev` on :3000 | ✅ Running |
| Dev chunks HTTP 200 | ✅ Verified earlier in session |
| `adb reverse tcp:3000` (both devices) | ✅ |
| `npm run cap:sync:dev` | ✅ APK points to localhost |
| Debug APK install (both devices) | ✅ |
| CDP WebView sign-in automation | ✅ |
| Screen time reset for QA child | ✅ Required — child had 60/60 min used (see defects) |

---

## Home Screen (`/kingdom-map`) — Content Checks

### Motorola Portrait (411×914)

| Check | Result |
|-------|--------|
| URL `/kingdom-map` | ✅ |
| Chess Mind title + hero | ✅ |
| Profile strip (Adventurer, rating, Ollie) | ✅ |
| Chess School primary card | ✅ |
| Activity tiles: Play, Puzzles, World, Learn | ✅ |
| TODAY: Daily Challenge + Quests | ✅ |
| DISCOVER: Train Your Mind | ✅ |
| YOUR PROGRESS stats | ✅ |
| Achievements preview + See all | ✅ |
| For Parents link | ✅ |
| Screen time overlay | ✅ Not blocking (after reset) |
| Scroll / bottom sections | ✅ |

**Evidence:** `motorola-portrait-report.json`, `motorola-portrait-*.png`

### Lenovo Portrait (800×1309)

All checks above: **✅ PASS**  
**Evidence:** `lenovo-portrait-report.json`, `lenovo-portrait-*.png`

### Lenovo Landscape (1333×776, `data-layout=tablet`)

All checks above: **✅ PASS** — tablet sidebar nav visible, content scrolls correctly.  
Hero grid reports `heroTwoColumn: true` at 1333px width (tablet layout).  
**Evidence:** `lenovo-landscape-report.json`, `lenovo-landscape-routing-report.json`, `lenovo-landscape-*.png`

---

## Navigation Routing (CDP tap-through)

### Motorola Portrait

| Destination | Expected | Result |
|-------------|----------|--------|
| Play tile | `/play` | ✅ |
| Puzzles tile | `/puzzles` | ✅ |
| World tile | `/world` | ✅ |
| Learn tile | `/learn` | ✅ |
| Train Your Mind | `/chess-mind` | ✅ |
| Start Session 1 | `/chess-school/session/s01-welcome` | ✅ |
| Profile strip | `/profile` | ✅ |
| For Parents | `/parent-gate` | ✅ |
| Achievements See all | `/profile` | ✅ (routes to profile achievements — correct product behavior) |

**Evidence:** `motorola-portrait-routing-report.json`

### Lenovo Landscape

All routing targets above: **✅ PASS** (same URLs and content as Motorola).  
**Evidence:** `lenovo-landscape-routing-report.json`

---

## Chess School — Session 1 Lesson QA (Motorola)

| Check | Result |
|-------|--------|
| Session loads at `s01-welcome` | ✅ |
| Board visible (teach step) | ✅ `board-present`, 411×914 |
| Teach lines (3 steps) | ✅ "Sixty-four squares" progression |
| Piece intro Pawn → Rook → Knight → Bishop → Queen → King | ✅ All 6 pieces, correct order |
| Ollie guidance copy present | ✅ |
| Board sizing on phone | ✅ Fits viewport, no horizontal overflow (`scrollW=411`) |

**Evidence:** `motorola-school-lesson-report.json`, `motorola-school-session1.png`

---

## Defects / Notes

| ID | Severity | Classification | Description |
|----|----------|----------------|-------------|
| ENV-01 | Medium | **Environment / test-account** | Child profile had **60/60 min screen time** used, showing `TimeCompleteOverlay` and blocking Home interaction. Reset via Supabase admin (`minutes_used=0`) was required to proceed. Not a Home redesign defect. |
| ENV-02 | Low | **Environment / test-account** | QA password temporarily rotated for CDP sign-in automation. Restore after QA if desired. |
| QA-01 | Info | **Test harness** | Initial CDP runs landed on incomplete child → `/onboarding/experience`. Fixed by forcing `cka_active_child` cookie to ready child `556bdac3-…`. |
| QA-02 | Info | **Test harness** | `hasDiscover` check failed when matching `Discover` vs UI label `DISCOVER` (case). Harness updated. |

**No source-code defects found** in Home redesign layout, routing, or Chess School Session 1 on tested devices/orientations.

---

## Pass / Fail Summary

| Area | Motorola Portrait | Lenovo Portrait | Lenovo Landscape |
|------|-------------------|-----------------|------------------|
| Home hierarchy & content | **PASS** | **PASS** | **PASS** |
| Navigation routing | **PASS** | (same build; home verified) | **PASS** |
| Chess School Session 1 | **PASS** | — | — |
| Screen time gate | **PASS** (after reset) | **PASS** | **PASS** |

**Overall local QA verdict: PASS** for Home redesign on debug APK against local dev server, subject to screen-time test-data precondition.

---

## Evidence Folder

`qa-evidence/home-local-qa-20260918-1904/`

Key artifacts:
- `motorola-portrait-report.json` — Home DOM checks
- `motorola-portrait-routing-report.json` — Navigation matrix
- `motorola-school-lesson-report.json` — Session 1 piece intro walkthrough
- `lenovo-portrait-report.json`, `lenovo-landscape-report.json`
- Screenshots: `*-top.png`, `*-mid.png`, `*-bottom.png`
