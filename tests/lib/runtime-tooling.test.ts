import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..", "..");

type PackageManifest = {
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe("runtime tooling", () => {
  it("pins Node 22 in the local and npm runtime contracts", () => {
    const nvmrc = readFileSync(join(projectRoot, ".nvmrc"), "utf8").trim();
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8")
    ) as PackageManifest;
    const packageLock = JSON.parse(
      readFileSync(join(projectRoot, "package-lock.json"), "utf8")
    ) as { packages?: { ""?: PackageManifest } };

    expect(nvmrc).toBe("22");
    expect(packageJson.engines?.node).toBe(">=22.0.0 <23.0.0");
    expect(packageJson.engines?.npm).toBe(">=10.0.0");
    expect(packageLock.packages?.[""]?.engines).toEqual(packageJson.engines);
  });

  it("makes CI test execution independent from experimental Node Web Storage", () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8")
    ) as PackageManifest;

    expect(packageJson.scripts?.["test:ci"]).toContain(
      "NODE_OPTIONS=--no-experimental-webstorage"
    );
    expect(packageJson.scripts?.["test:ci"]).toContain("vitest run");
    expect(packageJson.scripts?.typecheck).toBe(
      "tsc --noEmit -p tsconfig.typecheck.json"
    );

    const typecheckConfig = JSON.parse(
      readFileSync(join(projectRoot, "tsconfig.typecheck.json"), "utf8")
    ) as { exclude?: string[] };

    expect(typecheckConfig.exclude).toContain("tests");
  });

  it("runs the required production checks in one Node 22 CI workflow", () => {
    const workflow = readFileSync(join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).toMatch(/node-version:\s*22\b/);

    for (const command of [
      "npm ci",
      "npm run test:ci",
      "npm run lint",
      "npm run typecheck",
      "npm run build"
    ]) {
      expect(workflow).toContain(command);
    }
  });
});
