import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const readJsonFile = <T>(filePath: string, fallbackValue: T): T => {
  if (!existsSync(filePath)) {
    return fallbackValue;
  }

  const rawValue = readFileSync(filePath, "utf8").trim();

  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    throw new Error(`Could not parse JSON store at ${filePath}.`, {
      cause: error
    });
  }
};

export const writeJsonFile = <T>(filePath: string, value: T): T => {
  const directoryPath = dirname(filePath);
  const temporaryFilePath = `${filePath}.${randomUUID()}.tmp`;

  mkdirSync(directoryPath, { recursive: true });
  writeFileSync(temporaryFilePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryFilePath, filePath);

  return value;
};
