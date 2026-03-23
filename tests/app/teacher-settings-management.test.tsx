import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStore } from "../../src/lib/demo-store";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

const createTempStorePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "paps-teacher-settings-")), "demo-store.json");

const buildSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "Demo Elementary",
      teacherIds: ["demo-teacher"],
      sheetUrl: null,
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "demo-class-5-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    }
  ],
  teachers: [
    {
      id: "demo-teacher",
      schoolId: "demo-school",
      name: "Demo Teacher",
      email: "demo-teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe("teacher settings management", () => {
  let storePath = "";

  beforeEach(() => {
    vi.resetModules();
    storePath = createTempStorePath();
    process.env.PAPS_STORE_PATH = storePath;
    createDemoStore({
      filePath: storePath,
      seedData: buildSeed()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAPS_STORE_PATH;
  });

  it("updates school info and adds a class from the settings management UI", async () => {
    const schoolsRoute = await import("../../app/api/schools/route");
    const classesRoute = await import("../../app/api/classes/route");
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/schools" && method === "POST") {
          return schoolsRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/classes" && method === "POST") {
          return classesRoute.POST(jsonRequest(pathname, method, body));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    const store = createDemoStore({ filePath: storePath });
    const school = store.getSchool("demo-school");
    const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager school={school} classes={classes} />
      </AppShell>
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "Updated Elementary" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/updated-sheet/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");

    fireEvent.change(screen.getByLabelText("새 학급 학년"), {
      target: { value: "6" }
    });
    fireEvent.change(screen.getByLabelText("새 학급 반 번호"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("새 학급 이름"), {
      target: { value: "6-2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학급 추가" }));

    await screen.findByText("학급을 추가했습니다.");

    await waitFor(() => {
      const reloadedStore = createDemoStore({ filePath: storePath });

      expect(reloadedStore.getSchool("demo-school").name).toBe("Updated Elementary");
      expect(reloadedStore.getSchool("demo-school").sheetUrl).toBe(
        "https://docs.google.com/spreadsheets/d/updated-sheet/edit"
      );
      expect(reloadedStore.listClasses().some((entry) => entry.label === "6-2")).toBe(true);
    });

    expect(screen.getByText("6-2")).toBeInTheDocument();
  });
});
