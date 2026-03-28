import type { PAPSMeasurementDetail } from "../paps/types";
import { parseMeasurementDetail } from "../paps/composite-measurements";

const RECORD_NOTE_CLIENT_SUBMISSION_KEY = "clientSubmissionKey";
const RECORD_NOTE_REASON = "reason";
const RECORD_NOTE_DETAIL = "detail";
const RECORD_NOTE_JSON_PREFIX = "JSON:";
const RECORD_NOTE_DETAIL_SUMMARY_PREFIX = "세부기록:";
const RECORD_NOTE_REASON_PREFIX = "사유:";

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
  } catch {}

  const lines = normalizedValue
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const jsonLine = lines.find((line) => line.startsWith(RECORD_NOTE_JSON_PREFIX));
  const reasonLine = lines.find((line) => line.startsWith(RECORD_NOTE_REASON_PREFIX));

  if (jsonLine) {
    const parsedJson = parseRecordNote(jsonLine.slice(RECORD_NOTE_JSON_PREFIX.length).trim());

    return {
      ...parsedJson,
      reason:
        parsedJson.reason ??
        normalizeOptionalText(reasonLine?.slice(RECORD_NOTE_REASON_PREFIX.length).trim()) ??
        null
    };
  }

  if (reasonLine) {
    return {
      clientSubmissionKey: null,
      reason: normalizeOptionalText(reasonLine.slice(RECORD_NOTE_REASON_PREFIX.length).trim()),
      detail: null
    };
  }

  return {
    clientSubmissionKey: null,
    reason: normalizedValue,
    detail: null
  };
};

export const buildRecordNote = (input: {
  clientSubmissionKey?: string | null;
  reason?: string | null;
  detail?: PAPSMeasurementDetail | null;
  detailSummary?: string | null;
}): string => {
  const clientSubmissionKey = normalizeOptionalText(input.clientSubmissionKey);
  const reason = normalizeOptionalText(input.reason);
  const detail = input.detail ?? null;
  const detailSummary = normalizeOptionalText(input.detailSummary);

  if (!clientSubmissionKey && !detail && !detailSummary) {
    return reason ?? "";
  }

  const lines: string[] = [];

  if (detailSummary) {
    lines.push(`${RECORD_NOTE_DETAIL_SUMMARY_PREFIX} ${detailSummary}`);
  }

  if (reason) {
    lines.push(`${RECORD_NOTE_REASON_PREFIX} ${reason}`);
  }

  lines.push(
    `${RECORD_NOTE_JSON_PREFIX}${JSON.stringify({
      ...(clientSubmissionKey ? { [RECORD_NOTE_CLIENT_SUBMISSION_KEY]: clientSubmissionKey } : {}),
      ...(detail ? { [RECORD_NOTE_DETAIL]: detail } : {}),
      ...(reason ? { [RECORD_NOTE_REASON]: reason } : {})
    })}`
  );

  return lines.join("\n");
};
