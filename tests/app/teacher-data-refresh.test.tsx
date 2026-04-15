import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })
}));

describe("teacher data refresh bridge", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    refresh.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  class MockEventSource {
    static instances: MockEventSource[] = [];

    readonly url: string;
    readonly listeners = new Map<string, Set<(event: Event) => void>>();
    closed = false;

    constructor(url: string) {
      this.url = url;
      MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (event: Event) => void) {
      const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: (event: Event) => void) {
      this.listeners.get(type)?.delete(listener);
    }

    close() {
      this.closed = true;
    }

    emit(type: string, data?: unknown) {
      const event = new MessageEvent(type, {
        data: data ? JSON.stringify(data) : undefined
      });

      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }
  }

  it("keeps the page stable when the latest version matches the initial server version", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        connected: true,
        version: "version-1",
        checkedAt: "2026-04-15T09:00:00.000Z",
        reason: null
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherDataRefresh } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={5000} />);

    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when polling detects a newer version", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          connected: true,
          version: "version-2",
          checkedAt: "2026-04-15T09:00:05.000Z",
          reason: null
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherDataRefresh } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={5000} />);

    await flushEffects();
    expect(fetchMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await flushEffects();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the tab becomes visible with a newer version", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          connected: true,
          version: "version-2",
          checkedAt: "2026-04-15T09:00:05.000Z",
          reason: null
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherDataRefresh } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={5000} />);

    expect(fetchMock).toHaveBeenCalledTimes(0);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes immediately when teacher data changes are announced", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          connected: true,
          version: "version-1",
          checkedAt: "2026-04-15T09:00:00.000Z",
          reason: null
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          connected: true,
          version: "version-2",
          checkedAt: "2026-04-15T09:00:02.000Z",
          reason: null
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherDataRefresh, notifyTeacherDataRefresh } = await import(
      "../../src/components/teacher/teacher-data-refresh"
    );

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={5000} />);

    notifyTeacherDataRefresh();

    await flushEffects();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("updates the local version baseline without refreshing when a mutation provides the next version", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connected: true,
        version: "version-2",
        checkedAt: "2026-04-15T09:00:05.000Z",
        reason: null
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherDataRefresh, notifyTeacherDataRefresh } = await import(
      "../../src/components/teacher/teacher-data-refresh"
    );

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={5000} />);

    notifyTeacherDataRefresh({
      refresh: false,
      nextVersion: "version-2"
    });

    await flushEffects();

    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("subscribes to the teacher SSE stream and refreshes when the server broadcasts a change", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const { TeacherDataRefresh } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={60000} />);

    await flushEffects();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toBe("/api/teacher/events");

    MockEventSource.instances[0]!.emit("teacher-data-changed", {
      source: "session"
    });

    await flushEffects();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("ignores SSE events emitted by the same browser tab", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const {
      TeacherDataRefresh,
      getTeacherLiveUpdateClientId
    } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={60000} />);

    await flushEffects();

    MockEventSource.instances[0]!.emit("teacher-data-changed", {
      source: "session",
      originClientId: getTeacherLiveUpdateClientId()
    });

    await flushEffects();

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defers SSE-triggered refresh while the tab is hidden until visibility returns", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        connected: true,
        version: "version-2",
        checkedAt: "2026-04-15T09:00:05.000Z",
        reason: null
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const { TeacherDataRefresh } = await import("../../src/components/teacher/teacher-data-refresh");

    render(<TeacherDataRefresh initialVersion="version-1" pollIntervalMs={60000} />);

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]!.emit("teacher-data-changed", {
      source: "student"
    });

    await flushEffects();

    expect(refresh).toHaveBeenCalledTimes(0);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await flushEffects();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
