export type ClientSubmissionIntent = { fingerprint: string; key: string };

export function getOrCreateClientSubmissionKey(
  current: ClientSubmissionIntent | null,
  fingerprint: string,
  createKey: () => string
): ClientSubmissionIntent {
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, key: createKey() };
}
