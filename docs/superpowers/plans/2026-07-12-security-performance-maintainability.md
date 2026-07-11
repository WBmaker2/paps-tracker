# PAPS Tracker v1.1.0 Security, Performance, and Maintainability Plan

## Scope

This implementation covers the following approved priorities:

1. Fail-closed teacher login and an explicit approval flow for adding a teacher to an existing sheet.
2. Remove full summary rebuilds from the student submission path.
3. Pin the Node.js runtime, restore deterministic tests, and add CI.
4. Add shared accessibility primitives and simplify the settings screen.
5. Split oversized settings and Google Sheets submission modules, then refresh runtime documentation.

Student-specific authentication modes and expiring student session links are intentionally excluded. The teacher supervises student entry in person, so the current shared-session flow remains unchanged.

## Global Constraints

- Preserve the existing Google Sheets tab contract and manual summary rebuild route as a recovery tool.
- Preserve the existing `PROJECT_CONTEXT.md` worktree file without editing or staging it.
- New teachers may not add themselves to a persisted sheet. An already-authorized teacher must issue a signed, target-email-specific approval code.
- Teacher access configuration is mandatory. Missing `GOOGLE_HOSTED_DOMAIN` and `TEACHER_EMAIL_ALLOWLIST` must deny login and teacher routes.
- Student submission success must continue to depend on the raw record write succeeding.
- Update history remains visible from the landing page and is advanced to `v1.1.0`.

## Task 1: Teacher Access and Existing-Sheet Approval

- Change email access checks to fail closed when no domain or allowlist is configured.
- Hide/disable Google sign-in until OAuth and teacher access scope are both configured.
- Replace `claim_existing_sheet` self-approval with a signed teacher invitation token.
- Add an authenticated invite endpoint. The current teacher must already belong to the connected sheet.
- Bind each invitation to spreadsheet ID, inviter email, target email, and a 15-minute expiry.
- Update settings UI and tests for invite generation and invite-code connection.

## Task 2: Incremental Summary Writes

- Keep the initial structured-state read because it validates session, student, event, and history.
- After append/edit, derive only the affected `학생요약` and `공식평가요약` rows from the in-memory next state.
- Locate a row by `학생ID + 종목`, update one existing row, or append one new row.
- Do not call `rebuildGoogleSheetSummaries` from POST/PATCH submission flows.
- Keep `/api/results/rebuild` for explicit repair and migration.

## Task 3: Runtime and CI

- Pin Node.js 22 in `.nvmrc`, `package.json`, and GitHub Actions.
- Keep Vitest deterministic and add a dedicated CI script.
- Add a GitHub Actions workflow for install, test, lint, and production build.

## Task 4: Accessibility and Settings UX

- Add a shared focus-managed dialog and live-status component.
- Apply keyboard focus visibility globally and expose the active teacher navigation item with `aria-current`.
- Use the shared dialog in update history and teacher-return access.
- Collapse the four-step Google Sheets guide after connection.
- Move sheet-tab serialization details into a closed advanced diagnostics disclosure.

## Task 5: Module Boundaries and Documentation

- Extract settings connection, PIN, and classroom panels from the stateful manager.
- Extract student session view/history helpers and incremental summary persistence from the submission service.
- Refresh README architecture, setup, security, Node, CI, and recovery guidance.
- Add `v1.1.0` to public update history and package metadata.

## Verification

- Targeted red-green tests for each behavior change.
- `npm run test:ci`
- `npm run lint`
- `NEXTAUTH_SECRET=test-secret npm run build`
- `git diff --check`
