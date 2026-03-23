import { PAPS_EVENT_DEFINITIONS } from "../../data/paps/events";
import { getOfficialGradeRule } from "../../data/paps/grades";
import type {
  EventId,
  GradeLevel,
  PAPSEventDefinition,
  SessionType,
  StudentSex
} from "./types";

export const getEventDefinition = (eventId: EventId): PAPSEventDefinition => {
  const eventDefinition = PAPS_EVENT_DEFINITIONS[eventId];

  if (!eventDefinition) {
    throw new Error(`Unknown PAPS event: ${eventId}.`);
  }

  return eventDefinition;
};

export const isEventEligibleForGrade = (eventId: EventId, gradeLevel: GradeLevel): boolean =>
  getEventDefinition(eventId).supportedGrades.includes(gradeLevel);

export const supportsSessionType = (eventId: EventId, sessionType: SessionType): boolean =>
  getEventDefinition(eventId).supportedSessionTypes.includes(sessionType);

export const hasOfficialGradeRule = (
  eventId: EventId,
  gradeLevel: GradeLevel,
  sex: StudentSex
): boolean => getOfficialGradeRule(gradeLevel, sex, eventId) !== null;
