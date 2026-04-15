"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export const TEACHER_DATA_REFRESH_EVENT = "paps:teacher-data-refresh";
const DEFAULT_VERSION_ENDPOINT = "/api/teacher/state-version";
const DEFAULT_EVENT_STREAM_ENDPOINT = "/api/teacher/events";
const REFRESH_THROTTLE_MS = 750;

type TeacherDataRefreshPayload = {
  connected: boolean;
  version: string | null;
  checkedAt?: string;
  reason?: string | null;
};

export const notifyTeacherDataRefresh = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(TEACHER_DATA_REFRESH_EVENT));
};

export function TeacherDataRefresh({
  initialVersion = null,
  pollIntervalMs = 0,
  versionEndpoint = DEFAULT_VERSION_ENDPOINT,
  eventStreamEndpoint = DEFAULT_EVENT_STREAM_ENDPOINT
}: {
  initialVersion?: string | null;
  pollIntervalMs?: number;
  versionEndpoint?: string;
  eventStreamEndpoint?: string;
} = {}) {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);
  const latestVersionRef = useRef<string | null>(initialVersion);
  const inFlightRef = useRef<AbortController | null>(null);
  const pendingServerRefreshRef = useRef(false);

  const refreshRoute = useCallback(() => {
    const now = Date.now();

    if (now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) {
      return;
    }

    lastRefreshAtRef.current = now;
    router.refresh();
  }, [router]);

  const syncTeacherData = useCallback(
    async ({
      allowHidden = false,
      refreshOnVersionChange = true
    }: {
      allowHidden?: boolean;
      refreshOnVersionChange?: boolean;
    } = {}) => {
      if (!allowHidden && document.visibilityState !== "visible") {
        return;
      }

      if (inFlightRef.current) {
        return;
      }

      const controller = new AbortController();
      inFlightRef.current = controller;

      try {
        const response = await fetch(versionEndpoint, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as TeacherDataRefreshPayload;
        const nextVersion = payload.connected ? payload.version ?? null : null;
        const previousVersion = latestVersionRef.current;

        latestVersionRef.current = nextVersion;

        if (refreshOnVersionChange && nextVersion !== previousVersion) {
          refreshRoute();
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Ignore transient polling errors and wait for the next check.
        }
      } finally {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
      }
    },
    [refreshRoute, versionEndpoint]
  );

  useEffect(() => {
    latestVersionRef.current = initialVersion;
  }, [initialVersion]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined" || !eventStreamEndpoint) {
      return;
    }

    const eventSource = new EventSource(eventStreamEndpoint);
    const handleServerRefresh = () => {
      if (document.visibilityState !== "visible") {
        pendingServerRefreshRef.current = true;
        return;
      }

      refreshRoute();
      void syncTeacherData({
        allowHidden: true,
        refreshOnVersionChange: false
      });
    };

    eventSource.addEventListener("teacher-data-changed", handleServerRefresh);

    return () => {
      eventSource.removeEventListener("teacher-data-changed", handleServerRefresh);
      eventSource.close();
    };
  }, [eventStreamEndpoint, refreshRoute, syncTeacherData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (pendingServerRefreshRef.current) {
          pendingServerRefreshRef.current = false;
          refreshRoute();
          void syncTeacherData({
            allowHidden: true,
            refreshOnVersionChange: false
          });
          return;
        }

        void syncTeacherData();
      }
    };
    const handleFocus = () => {
      void syncTeacherData();
    };
    const handleDataRefresh = () => {
        refreshRoute();
        void syncTeacherData({
          allowHidden: true,
          refreshOnVersionChange: false
        });
    };

    void syncTeacherData();
    window.addEventListener("focus", handleFocus);
    window.addEventListener(TEACHER_DATA_REFRESH_EVENT, handleDataRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            void syncTeacherData();
          }, pollIntervalMs)
        : null;

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      inFlightRef.current?.abort();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(TEACHER_DATA_REFRESH_EVENT, handleDataRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollIntervalMs, refreshRoute, syncTeacherData]);

  return null;
}
