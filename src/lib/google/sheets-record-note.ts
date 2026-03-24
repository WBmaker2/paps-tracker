const RECORD_NOTE_CLIENT_SUBMISSION_KEY = "clientSubmissionKey";
const RECORD_NOTE_REASON = "reason";

export interface ParsedRecordNote {
  clientSubmissionKey: string | null;
  reason: string | null;
}

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
};

export const parseRecordNote = (value?: string | null): ParsedRecordNote => {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    return {
      clientSubmissionKey: null,
      reason: null
    };
  }

  try {
    const parsed = JSON.parse(normalizedValue) as {
      clientSubmissionKey?: unknown;
      reason?: unknown;
    };

    return {
      clientSubmissionKey:
        typeof parsed.clientSubmissionKey === "string"
          ? normalizeOptionalText(parsed.clientSubmissionKey)
          : null,
      reason: typeof parsed.reason === "string" ? normalizeOptionalText(parsed.reason) : null
    };
  } catch {
    return {
      clientSubmissionKey: null,
      reason: normalizedValue
    };
  }
};

export const buildRecordNote = (input: {
  clientSubmissionKey?: string | null;
  reason?: string | null;
}): string => {
  const clientSubmissionKey = normalizeOptionalText(input.clientSubmissionKey);
  const reason = normalizeOptionalText(input.reason);

  if (!clientSubmissionKey) {
    return reason ?? "";
  }

  return JSON.stringify({
    [RECORD_NOTE_CLIENT_SUBMISSION_KEY]: clientSubmissionKey,
    ...(reason ? { [RECORD_NOTE_REASON]: reason } : {})
  });
};
