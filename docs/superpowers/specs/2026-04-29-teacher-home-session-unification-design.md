# Teacher Home Session Unification Design

## Summary

The teacher dashboard (`/teacher`) and session page (`/teacher/sessions`) currently overlap: both lead teachers into session creation and session operation. This creates an unnecessary navigation choice without a meaningful difference in task flow.

This change makes `/teacher` the single teacher home for day-to-day operation. The home screen keeps the summary cards and the full session workspace. The separate session navigation item is removed, and existing `/teacher/sessions` links redirect to `/teacher` so bookmarks and older links do not break.

## Goals

- Make the teacher landing experience simpler after Google sign-in.
- Keep one clear place for creating sessions, opening student entry links, and managing session state.
- Preserve existing `/teacher/sessions` URLs by redirecting them to `/teacher`.
- Avoid changing student entry routes, result review, settings, or Google Sheets behavior.

## User Experience

The teacher navigation becomes:

- `교사 홈` -> `/teacher`
- `학생` -> `/teacher/students`
- `결과` -> `/teacher/results`
- `설정` -> `/teacher/settings`

The old `대시보드` label is replaced with `교사 홈` because the page is no longer only a summary dashboard. It is the main work surface for session operation.

Teachers who click or open `/teacher/sessions` are immediately redirected to `/teacher`. They see the same session creation and session list tools on the unified home screen.

## Architecture

`AppShell` owns the teacher navigation, so the navigation change is contained there. `/teacher/page.tsx` remains the canonical screen that loads bootstrap data, summary cards, `TeacherSheetAutoLoader`, and `TeacherSessionWorkspace`.

`/teacher/sessions/page.tsx` becomes a route-level redirect to `/teacher`. This avoids duplicated data loading and keeps the old path compatible.

## Testing

Add a focused navigation test that verifies:

- The teacher nav shows `교사 홈`.
- The teacher nav no longer shows `대시보드`.
- The teacher nav no longer includes a separate `세션` link.
- `/teacher/sessions` redirects to `/teacher`.

Run the focused test first and watch it fail before changing production code. Then run the full test suite, lint, and production build.

## Non-Goals

- Do not redesign the session workspace UI.
- Do not remove session creation or session list functionality.
- Do not change `/session/[sessionId]` or `/session-group/[sessionGroupId]` student entry routes.
- Do not change Google Sheets persistence, polling, or auto-restore behavior.
