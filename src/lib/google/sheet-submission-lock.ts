const submissionLockTails = new Map<string, Promise<void>>();

export const withGoogleSheetSubmissionLock = async <T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> => {
  const previousTail = submissionLockTails.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const nextTail = previousTail.then(() => current);

  submissionLockTails.set(key, nextTail);
  await previousTail;

  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (submissionLockTails.get(key) === nextTail) {
      submissionLockTails.delete(key);
    }
  }
};
