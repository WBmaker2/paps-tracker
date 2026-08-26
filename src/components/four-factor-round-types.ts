/**
 * UI-only contract for the four-factor assessment round.
 *
 * The API/store owns the canonical domain types. Keeping this shape local lets
 * the UI ship while the round persistence contract is being integrated.
 */
export const FOUR_FACTOR_IDS = [
  "cardiorespiratory-endurance",
  "flexibility",
  "strength-endurance",
  "power"
] as const;

export type FourFactorId = (typeof FOUR_FACTOR_IDS)[number];
export type FourFactorResultStatus =
  | "incomplete"
  | "excluded"
  | "ready"
  | "finalized"
  | "stale";

export type FourFactorValueView = {
  factorId: FourFactorId;
  eventId?: string | null;
  eventLabel?: string | null;
  representativeAttemptId?: string | null;
  measurement?: number | null;
  unit?: string | null;
  factorScore?: number | null;
};

export type FourFactorStudentResultView = {
  roundId?: string;
  studentId: string;
  studentName: string;
  status: FourFactorResultStatus;
  revision?: number;
  factors: Partial<Record<FourFactorId, FourFactorValueView>> | FourFactorValueView[];
  fourFactorSubtotal?: number | null;
  normalizedScore?: number | null;
  fourFactorGrade?: 1 | 2 | 3 | 4 | 5 | null;
  reason?: string | null;
  calculatedAt?: string | null;
  finalizedAt?: string | null;
};

export type FourFactorProgressView = {
  roundId?: string;
  roundName?: string;
  status?: "draft" | "open" | "review" | "finalized" | "archived";
  factors: Array<{
    factorId: FourFactorId;
    eventId?: string | null;
    eventLabel: string;
    complete: boolean;
  }>;
  finalizedResult?: FourFactorStudentResultView | null;
  roundProgress?: {
    completed: number;
    total: 4;
    nextFactorId?: FourFactorId | null;
    nextEventLabel?: string | null;
  } | null;
};

export const FOUR_FACTOR_LABELS: Record<FourFactorId, string> = {
  "cardiorespiratory-endurance": "심폐지구력",
  flexibility: "유연성",
  "strength-endurance": "근력·근지구력",
  power: "순발력"
};

export const FOUR_FACTOR_STATUS_LABELS: Record<FourFactorResultStatus, string> = {
  incomplete: "미완료",
  excluded: "측정제외",
  ready: "확정 준비",
  finalized: "확정됨",
  stale: "재확정 필요"
};

export const FOUR_FACTOR_STATUS_DESCRIPTIONS: Record<FourFactorResultStatus, string> = {
  incomplete: "네 요인의 대표 기록을 모두 입력하면 확정 준비가 됩니다.",
  excluded: "이 학생은 이번 회차 측정에서 제외되었습니다.",
  ready: "네 요인이 모두 완료되어 결과를 확정할 수 있습니다.",
  finalized: "교사가 확정한 현재 결과입니다.",
  stale: "대표 기록이 바뀌어 최신 결과를 다시 확인해야 합니다."
};
