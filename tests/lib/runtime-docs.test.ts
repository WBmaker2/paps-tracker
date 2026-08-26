import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..", "..");

describe("runtime docs", () => {
  it("documents Vercel + Google Sheets without PAPS_STORE_PATH guidance", () => {
    const readme = readFileSync(join(projectRoot, "README.md"), "utf8");
    const envExample = readFileSync(join(projectRoot, ".env.example"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
      version?: string;
      scripts?: Record<string, string>;
    };

    expect(readme).toContain("Vercel");
    expect(readme).not.toContain("PAPS_STORE_PATH");
    expect(envExample).not.toContain("PAPS_STORE_PATH");
    expect(packageJson.scripts?.["migrate:demo-store"]).toBeTruthy();
    expect(packageJson.version).toBe("1.2.1");
    expect(readme).toContain("Node.js 22");
    expect(readme).toContain("교사 초대 승인 코드");
    expect(readme).not.toContain("MVP Limitations");
  });

  it("documents the public update history from MVP to v1.2.1", () => {
    const updateHistory = readFileSync(join(projectRoot, "docs", "update-history.md"), "utf8");
    const updateHistorySource = readFileSync(join(projectRoot, "src", "lib", "update-history.ts"), "utf8");

    expect(updateHistory).toContain("# PAPS Tracker Update History");
    expect(updateHistory).toContain("v1.2.0");
    expect(updateHistory).toContain("체지방 제외 4요인 평가 회차");
    expect(updateHistory).toContain("v1.1.1");
    expect(updateHistory).toContain("보안과 운영 기반 강화");
    expect(updateHistory).toContain("v1.0.2");
    expect(updateHistory).toContain("설정 저장 후 즉시 최신화");
    expect(updateHistory).toContain("v1.0.1");
    expect(updateHistory).toContain("즉시 결과 기록 순서 보정");
    expect(updateHistory).toContain("v1.0.0");
    expect(updateHistory).toContain("완제품 운영 흐름");
    expect(updateHistory).toContain("v0.1.0");
    expect(updateHistory).toContain("초기 MVP");
    expect(updateHistory).toContain("v1.2.1");
    expect(updateHistory).toContain("운영 의존성 보안 패치");
    expect(updateHistorySource).toContain('APP_VERSION = "v1.2.1"');
  });
});
