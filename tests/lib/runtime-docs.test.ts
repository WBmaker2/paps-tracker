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
});
