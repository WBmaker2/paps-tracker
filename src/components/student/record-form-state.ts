import type {
  ComprehensiveFlexibilityMeasurementDetail,
  PAPSMeasurementDetail
} from "../../lib/paps/types";

export type RecordFormSubmission = {
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
};

export type FlexibilitySelection = boolean | null;

export type FlexibilityFormState = {
  shoulder: { right: FlexibilitySelection; left: FlexibilitySelection };
  trunk: { right: FlexibilitySelection; left: FlexibilitySelection };
  side: { right: FlexibilitySelection; left: FlexibilitySelection };
  lowerBody: { right: FlexibilitySelection; left: FlexibilitySelection };
};

export const STEP_TEST_INPUT_LABELS = [
  "심박수(1분~1분30초)",
  "심박수(2분~2분30초)",
  "심박수(3분~3분30초)"
] as const;

export const FLEXIBILITY_SECTION_LABELS = [
  { key: "shoulder", label: "어깨" },
  { key: "trunk", label: "몸통" },
  { key: "side", label: "옆구리" },
  { key: "lowerBody", label: "하체" }
] as const;

export const createEmptyFlexibilityState = (): FlexibilityFormState => ({
  shoulder: { right: null, left: null },
  trunk: { right: null, left: null },
  side: { right: null, left: null },
  lowerBody: { right: null, left: null }
});

export const createFlexibilityStateFromDetail = (
  detail: PAPSMeasurementDetail | null | undefined
): FlexibilityFormState => {
  if (detail?.kind !== "comprehensive-flexibility") return createEmptyFlexibilityState();
  return {
    shoulder: detail.shoulder,
    trunk: detail.trunk,
    side: detail.side,
    lowerBody: detail.lowerBody
  };
};

export const buildFlexibilityDetail = (
  value: FlexibilityFormState
): ComprehensiveFlexibilityMeasurementDetail | null => {
  const sections = Object.values(value).flatMap((section) => [section.right, section.left]);
  if (sections.some((entry) => entry === null)) return null;
  return {
    kind: "comprehensive-flexibility",
    shoulder: { right: value.shoulder.right ?? false, left: value.shoulder.left ?? false },
    trunk: { right: value.trunk.right ?? false, left: value.trunk.left ?? false },
    side: { right: value.side.right ?? false, left: value.side.left ?? false },
    lowerBody: { right: value.lowerBody.right ?? false, left: value.lowerBody.left ?? false }
  };
};
