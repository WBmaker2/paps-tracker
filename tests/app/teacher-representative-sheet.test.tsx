import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  cookies,
  importRequestStore,
  installTeacherApiFetch,
  sheetOperations
} from "./teacher-representative-fixture";

describe("teacher sync and Sheets representative flows", () => {
  it("shows sync failure status with a resync action", async () => {
    await installTeacherApiFetch();
    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");
    const { getRequestStore } = await importRequestStore();

    render(
      <SyncStatusCard
        recordId="session-official-1:student-kim"
        status="failed"
        updatedAt="2026-03-23T09:25:00.000Z"
        message="Google Sheets API unavailable"
      />
    );

    expect(screen.getByText("Google Sheets API unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "재동기화 요청" }));

    await screen.findByText("재동기화를 다시 대기열에 넣었습니다.");

    const updatedAt = getRequestStore().getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.updatedAt;
    const formattedUpdatedAt = updatedAt
      ? new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date(updatedAt))
      : "";

    expect(
      getRequestStore().getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.status
    ).toBe("pending");
    expect(updatedAt).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(`마지막 확인: ${formattedUpdatedAt}`)).toBeInTheDocument();
    });
  });

  it("writes only source-of-truth tabs for metadata and student mutations in the sheet-backed store", async () => {
    process.env.NODE_ENV = "production";
    const { createGoogleSheetsStoreForRequest } = await import("../../src/lib/google/sheets-store");

    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId: "sheet-live",
      teacherEmail: "demo-teacher@example.com"
    });

    await store.saveClass({
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    });

    expect(sheetOperations.map((entry) => entry.range)).toEqual([
      "'설정'!A:F",
      "'학생명단'!A:I"
    ]);

    sheetOperations.length = 0;

    await store.saveStudent({
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    });

    expect(sheetOperations.map((entry) => entry.range)).toEqual(["'학생명단'!A:I"]);
  });

  it("routes representative updates and results reads through the same sheet-backed store", async () => {
    process.env.NODE_ENV = "production";
    cookies.mockResolvedValue({
      get: (name: string) =>
        name === "paps-spreadsheet-id"
          ? {
              value: "sheet-live"
            }
          : undefined
    });

    const representativeRoute = await import("../../app/api/records/[recordId]/representative/route");
    const { createGoogleSheetsStoreForRequest } = await import("../../src/lib/google/sheets-store");
    const { default: TeacherResultsPage } = await import("../../app/teacher/results/page");

    const response = await representativeRoute.PATCH(
      new NextRequest("http://localhost/api/records/session-official-1:student-kim/representative", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: "paps-spreadsheet-id=sheet-live"
        },
        body: JSON.stringify({
          attemptId: "attempt-2",
          reason: "best-of-two"
        })
      }),
      {
        params: Promise.resolve({
          recordId: "session-official-1:student-kim"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.record?.representativeAttemptId).toBe("attempt-2");
    expect(sheetOperations.map((entry) => entry.range)).toEqual([
      "'수정로그'!A:I",
      "'세션기록'!U2",
      "'세션기록'!P3",
      "'세션기록'!Q3",
      "'세션기록'!R3",
      "'세션기록'!U3"
    ]);
    expect(
      sheetOperations.some(
        (entry) =>
          entry.range === "'학생요약'!A1:L2000" || entry.range === "'공식평가요약'!A1:K2000"
      )
    ).toBe(false);

    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId: "sheet-live",
      teacherEmail: "demo-teacher@example.com"
    });
    const record = (await store.listSessionRecords("session-official-1"))
      .find((entry) => entry.studentId === "student-kim");

    expect(record?.representativeAttemptId).toBe("attempt-2");
    expect(record?.attempts.map((attempt) => attempt.id)).toEqual(["attempt-1", "attempt-2"]);

    render(await TeacherResultsPage());

    expect(screen.getByRole("button", { name: "2회차 대표값" })).toBeInTheDocument();
  });
});
