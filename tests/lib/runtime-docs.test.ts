import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..", "..");

describe("runtime docs", () => {
  it("documents Vercel + Google Sheets without PAPS_STORE_PATH guidance", () => {
    const readme = readFileSync(join(projectRoot, "README.md"), "utf8");
    const envExample = readFileSync(join(projectRoot, ".env.example"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(readme).toContain("Vercel");
    expect(readme).not.toContain("PAPS_STORE_PATH");
    expect(envExample).not.toContain("PAPS_STORE_PATH");
    expect(packageJson.scripts?.["migrate:demo-store"]).toBeTruthy();
  });

  it("documents the public update history from MVP to v1.0.1", () => {
    const updateHistory = readFileSync(join(projectRoot, "docs", "update-history.md"), "utf8");

    expect(updateHistory).toContain("# PAPS Tracker Update History");
    expect(updateHistory).toContain("v1.0.1");
    expect(updateHistory).toContain("즉시 결과 기록 순서 보정");
    expect(updateHistory).toContain("v1.0.0");
    expect(updateHistory).toContain("완제품 운영 흐름");
    expect(updateHistory).toContain("v0.1.0");
    expect(updateHistory).toContain("초기 MVP");
  });
});
