import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTeacherReturnPinConfig,
  validateTeacherReturnPin,
  verifySheetTeacherReturnPin
} from "../../src/lib/teacher-return";

describe("teacher return PIN", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores only a hashed PIN config and verifies candidates with the app secret", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-pin-secret");

    const config = createTeacherReturnPinConfig({
      pin: "2468",
      updatedByTeacherEmail: "teacher@example.com",
      now: new Date("2026-04-21T09:00:00.000Z")
    });

    expect(config).toMatchObject({
      algorithm: "hmac-sha256-v1",
      updatedAt: "2026-04-21T09:00:00.000Z",
      updatedByTeacherEmail: "teacher@example.com"
    });
    expect(config.hash).not.toContain("2468");
    expect(verifySheetTeacherReturnPin(config, "2468")).toBe(true);
    expect(verifySheetTeacherReturnPin(config, "0000")).toBe(false);
  });

  it("requires a 4 to 6 digit numeric PIN", () => {
    expect(validateTeacherReturnPin("1234")).toBeNull();
    expect(validateTeacherReturnPin("123456")).toBeNull();
    expect(validateTeacherReturnPin("123")).toBe("PIN은 4~6자리 숫자로 입력해주세요.");
    expect(validateTeacherReturnPin("1234567")).toBe("PIN은 4~6자리 숫자로 입력해주세요.");
    expect(validateTeacherReturnPin("12ab")).toBe("PIN은 4~6자리 숫자로 입력해주세요.");
  });
});
