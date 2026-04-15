import { describe, expect, it } from "vitest";

import {
  createTeacherLiveUpdateStream,
  publishTeacherLiveUpdate
} from "../../src/lib/teacher-live-updates";

const decoder = new TextDecoder();

describe("teacher live updates", () => {
  it("streams teacher-scoped events to connected subscribers", async () => {
    const stream = createTeacherLiveUpdateStream({
      teacherEmail: "teacher@example.com"
    });
    const reader = stream.getReader();

    const retryChunk = await reader.read();
    const connectedChunk = await reader.read();

    expect(decoder.decode(retryChunk.value)).toContain("retry: 5000");
    expect(decoder.decode(connectedChunk.value)).toContain("event: connected");

    publishTeacherLiveUpdate({
      teacherEmail: "teacher@example.com",
      source: "session",
      originClientId: "client-1"
    });

    const updateChunk = await reader.read();
    const payloadText = decoder.decode(updateChunk.value);

    expect(payloadText).toContain("event: teacher-data-changed");
    expect(payloadText).toContain('"source":"session"');
    expect(payloadText).toContain('"originClientId":"client-1"');

    await reader.cancel();
  });

  it("does not leak events across different teacher channels", async () => {
    const stream = createTeacherLiveUpdateStream({
      teacherEmail: "teacher-a@example.com"
    });
    const reader = stream.getReader();

    await reader.read();
    await reader.read();

    publishTeacherLiveUpdate({
      teacherEmail: "teacher-b@example.com",
      source: "class"
    });

    const timeoutResult = await Promise.race([
      reader.read().then(() => "event"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 10))
    ]);

    expect(timeoutResult).toBe("timeout");

    await reader.cancel();
  });
});
