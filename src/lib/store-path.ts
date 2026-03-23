import { isAbsolute, resolve } from "node:path";

const DEFAULT_STORE_RELATIVE_PATH = ".data/paps/demo-store.json";

export const getDefaultStorePath = (cwd = process.cwd()): string =>
  resolve(cwd, DEFAULT_STORE_RELATIVE_PATH);

export const resolveStorePath = (filePath?: string, cwd = process.cwd()): string => {
  if (!filePath) {
    return getDefaultStorePath(cwd);
  }

  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
};
