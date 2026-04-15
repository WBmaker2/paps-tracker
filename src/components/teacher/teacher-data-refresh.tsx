"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../lib/teacher-live-update-protocol";
import type { TeacherLiveUpdateEvent } from "../../lib/teacher-live-updates";

export const TEACHER_DATA_REFRESH_EVENT = "paps:teacher-data-refresh";
const DEFAULT_VERSION_ENDPOINT = "/api/teacher/state-version";
const DEFAULT_EVENT_STREAM_ENDPOINT = "/api/teacher/events";
const REFRESH_THROTTLE_MS = 750;
const TEACHER_CLIENT_ID_STORAGE_KEY = "paps:teacher-live-update-client-id";

type TeacherDataRefreshPayload = {
  connected: boolean;
  version: string | null;
  checkedAt?: string;
  reason?: string | null;
};

type TeacherDataRefreshEventDetail = {
  refresh?: boolean;
  nextVersion?: string | null;
};

export const notifyTeacherDataRefresh = (detail: TeacherDataRefreshEventDetail = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<TeacherDataRefreshEventDetail>(TEACHER_DATA_REFRESH_EVENT, {
      detail
    })
  );
};

const generateTeacherLiveUpdateClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `teacher-client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getTeacherLiveUpdateClientId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existingClientId = window.sessionStorage.getItem(TEACHER_CLIENT_ID_STORAGE_KEY);

    if (existingClientId) {
      return existingClientId;
    }

    const nextClientId = generateTeacherLiveUpdateClientId();
    window.sessionStorage.setItem(TEACHER_CLIENT_ID_STORAGE_KEY, nextClientId);
    return nextClientId;
  } catch {
    return generateTeacherLiveUpdateClientId();
  }
};

export const buildTeacherMutationHeaders = (headers?: HeadersInit): Headers => {
  const nextHeaders = new Headers(headers);
  const clientId = getTeacherLiveUpdateClientId();

  if (clientId) {
    nextHeaders.set(TEACHER_LIVE_UPDATE_CLIENT_HEADER, clientId);
  }

  return nextHeaders;
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
  const clientIdRef = useRef<string | null>(null);

  if (clientIdRef.current === null) {
    clientIdRef.current = getTeacherLiveUpdateClientId();
  }

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
    const handleServerRefresh = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      const payload = (() => {
        if (!messageEvent.data) {
          return null;
        }

        try {
          return JSON.parse(messageEvent.data) as TeacherLiveUpdateEvent;
        } catch {
          return null;
        }
      })();

      if (payload?.originClientId && payload.originClientId === clientIdRef.current) {
        return;
      }

      if (document.visibilityState !== "visible") {
        pendingServerRefreshRef.current = true;
        return;
      }

      refreshRoute();
    };

    eventSource.addEventListener("teacher-data-changed", handleServerRefresh);

    return () => {
      eventSource.removeEventListener("teacher-data-changed", handleServerRefresh);
      eventSource.close();
    };
  }, [eventStreamEndpoint, refreshRoute]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (pendingServerRefreshRef.current) {
          pendingServerRefreshRef.current = false;
          refreshRoute();
          return;
        }

        void syncTeacherData();
      }
    };
    const handleFocus = () => {
      void syncTeacherData();
    };
    const handleDataRefresh = (event: Event) => {
      const detail = (event as CustomEvent<TeacherDataRefreshEventDetail>).detail;

      if (detail && Object.prototype.hasOwnProperty.call(detail, "nextVersion")) {
        latestVersionRef.current = detail.nextVersion ?? null;
      }

      if (detail?.refresh === false) {
        return;
      }

      refreshRoute();
    };

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
