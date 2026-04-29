# Landing Teacher Start Design

## Summary

The landing page should not present student entry as a standalone public entry point. Students can only submit records after a teacher creates and opens a session, then shares the generated session link or QR code. A direct `학생 입력 영역` button on the landing page creates the false expectation that students can start independently.

This design makes the landing page a teacher-first start screen. The primary call to action sends teachers to the teacher home. Student entry remains visible only as an explanation of the real flow: the teacher opens a session, shares a session link or QR code, and students use that specific link.

## Goals

- Remove the direct public student-entry CTA from the landing page.
- Keep the product story clear: teacher prepares, opens a session, students enter through the shared session link.
- Avoid linking to `/session/demo` from the landing page.
- Preserve the existing warm visual direction and large card layout.

## User Experience

The page has one primary action:

- `교사 홈으로 시작` -> `/teacher`

The student section becomes an informational card:

- Title: `학생 입력 안내`
- Message: `학생은 선생님이 열어 준 세션 링크 또는 QR 코드로 접속합니다.`
- Supporting text explains that the student input link appears from the teacher home after a session is opened.

This makes the page honest about the workflow while still telling visitors that student input is part of the product.

## Architecture

`app/page.tsx` owns the static landing page, so this change stays there. The component no longer needs the `entryPoints` array because only the teacher area is a link. Student guidance is rendered as a plain `article`.

The existing `tests/app/home-page.test.tsx` protects the landing copy. It should also verify that no public `/session/demo` link remains and that the teacher CTA is the only actionable entry point.

## Non-Goals

- Do not change student session routes.
- Do not add dynamic open-session lookup to the landing page.
- Do not require login on the landing page itself.
- Do not alter teacher session link generation.
