import type {
  TeacherResultRowView
} from "../../lib/teacher-results";
import type { TeacherResultsFilterState } from "./results-filter-panel";

export const createDefaultFilterState = (): TeacherResultsFilterState => ({
  query: "",
  grade: "all",
  classId: "all",
  eventId: "all",
  sessionType: "all"
});

export const filterTeacherResultRows = (
  rows: TeacherResultRowView[],
  filterState: TeacherResultsFilterState
): TeacherResultRowView[] =>
  rows.filter((row) => {
    if (
      filterState.query &&
      !row.studentNameNormalized.includes(filterState.query.trim().toLocaleLowerCase("ko-KR"))
    ) {
      return false;
    }

    if (filterState.grade !== "all" && row.gradeLevel !== filterState.grade) {
      return false;
    }

    if (filterState.classId !== "all" && row.classId !== filterState.classId) {
      return false;
    }

    if (filterState.eventId !== "all" && row.eventId !== filterState.eventId) {
      return false;
    }

    if (filterState.sessionType !== "all" && row.sessionType !== filterState.sessionType) {
      return false;
    }

    return true;
  });
