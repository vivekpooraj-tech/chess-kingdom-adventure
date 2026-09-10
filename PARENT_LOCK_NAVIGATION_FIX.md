# Parent Lock Navigation Fix

## Why Parent Lock was not visible

Parent Lock / Chess Time **was already implemented** at `/parent-dashboard/parent-lock` with a link on the Parent Dashboard, but the entry was **buried at the bottom of a very long page** — after all child progress cards (This Week, Skills Snapshot, Learning Progress, Academy, Chess Mind, Openings, Puzzles, Achievements), Screen Time settings, and Premium status.

On mobile, parents would need to scroll through the entire progress report before reaching a small “Set up Chess Time →” button. The link was easy to miss and did not match the prominent list-row pattern used elsewhere in the app (e.g. the **For Parents** row on the More tab).

No duplicate Parent Lock implementation existed; only the **placement and presentation** in the Parent Dashboard UI needed fixing.

## File changed

**`app/parent-dashboard/page.tsx`**

- Added a **Parent Controls** section immediately after **Manage Children** (near the top of the dashboard).
- Added a prominent **`ListItemRow`** card:
  - 🔐 **Parent Lock**
  - **Chess Time** (subtitle)
  - “Help your child stay focused on chess.”
- Link: `/parent-gate?next=/parent-dashboard/parent-lock` (Parent Gate challenge, then setup page).
- Removed the old bottom-of-page SecondaryCard duplicate so there is a single, clearly visible entry.

**`scripts/test-parent-lock.js`** — added 5 static checks for dashboard navigation placement and route wiring (no security/session logic changes).

Chess School V2 files were not modified. Parent Lock PIN hashing, timers, and session logic were not changed.

## Final navigation path

```
More tab
  → For Parents  (/parent-gate?next=/parent-dashboard)
    → Parent Gate (arithmetic challenge)
      → Parent Dashboard  (/parent-dashboard)
        → Parent Controls → Parent Lock  (/parent-gate?next=/parent-dashboard/parent-lock)
          → Parent Gate (challenge again — child may hold device)
            → Parent Lock setup  (/parent-dashboard/parent-lock)
              → ParentLockSettings (PIN + Chess Time start)
```

During an active Chess Time session, the child-facing hub remains at `/chess-time`.

## Layout notes (mobile + desktop)

- Parent Dashboard uses the shared **`Screen`** layout with **`ListItemRow`** — same touch-friendly row pattern as the More tab on phones.
- Desktop uses the same page content inside **AppShell** (sidebar + top bar); the Parent Controls row is visible without scrolling past progress sections.

## Test and build results

```text
node scripts/test-parent-lock.js
=== PARENT LOCK: 57 passed, 0 failed ===

npm run build
✓ Compiled successfully
✓ Generating static pages (91/91)
```

No commit. No push.
