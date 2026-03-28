import type { PAPSMeasurementDetail } from "../paps/types";
import { parseMeasurementDetail } from "../paps/composite-measurements";

const RECORD_NOTE_CLIENT_SUBMISSION_KEY = "clientSubmissionKey";
const RECORD_NOTE_REASON = "reason";
const RECORD_NOTE_DETAIL = "detail";

export interface ParsedRecordNote {
  clientSubmissionKey: string | null;
  reason: string | null;
  detail: PAPSMeasurementDetail | null;
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
        reason: null,
        detail: null
      };
  }

  try {
    const parsed = JSON.parse(normalizedValue) as {
      clientSubmissionKey?: unknown;
      reason?: unknown;
      detail?: unknown;
    };

    return {
      clientSubmissionKey:
        typeof parsed.clientSubmissionKey === "string"
          ? normalizeOptionalText(parsed.clientSubmissionKey)
          : null,
      reason: typeof parsed.reason === "string" ? normalizeOptionalText(parsed.reason) : null,
      detail: parseMeasurementDetail(parsed.detail)
    };
  } catch {
    return {
      clientSubmissionKey: null,
      reason: normalizedValue,
      detail: null
    };
  }
};

export const buildRecordNote = (input: {
  clientSubmissionKey?: string | null;
  reason?: string | null;
  detail?: PAPSMeasurementDetail | null;
}): string => {
  const clientSubmissionKey = normalizeOptionalText(input.clientSubmissionKey);
  const reason = normalizeOptionalText(input.reason);
  const detail = input.detail ?? null;

  if (!clientSubmissionKey && !detail) {
    return reason ?? "";
  }

  return JSON.stringify({
    ...(clientSubmissionKey ? { [RECORD_NOTE_CLIENT_SUBMISSION_KEY]: clientSubmissionKey } : {}),
    ...(detail ? { [RECORD_NOTE_DETAIL]: detail } : {}),
    ...(reason ? { [RECORD_NOTE_REASON]: reason } : {})
  });
};
