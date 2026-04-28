import type { PAPSSchool } from "../../lib/paps/types";

export const SCHOOL_SETTINGS_STORAGE_KEY = "paps:teacher-settings:saved-school";

export type SavedSchoolSettings = {
  schoolId: string | null;
  schoolName: string;
  sheetUrl: string;
};

export const areSavedSchoolSettingsEqual = (
  left: SavedSchoolSettings | null,
  right: SavedSchoolSettings | null
): boolean =>
  left?.schoolId === right?.schoolId &&
  left?.schoolName === right?.schoolName &&
  left?.sheetUrl === right?.sheetUrl;

export const readSavedSchoolSettings = (): SavedSchoolSettings | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SCHOOL_SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<SavedSchoolSettings>;

    return {
      schoolId: typeof parsedValue.schoolId === "string" ? parsedValue.schoolId : null,
      schoolName: typeof parsedValue.schoolName === "string" ? parsedValue.schoolName : "",
      sheetUrl: typeof parsedValue.sheetUrl === "string" ? parsedValue.sheetUrl : ""
    };
  } catch {
    return null;
  }
};

export const persistSavedSchoolSettings = (value: SavedSchoolSettings | null) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!value) {
      window.localStorage.removeItem(SCHOOL_SETTINGS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SCHOOL_SETTINGS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors so teacher screens still work in restricted browsers.
  }
};

export const createSavedSchoolSettings = (
  school: PAPSSchool | null,
  fallback?: {
    schoolName?: string;
    sheetUrl?: string;
  }
): SavedSchoolSettings | null => {
  if (school) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      sheetUrl: school.sheetUrl ?? ""
    };
  }

  if (!fallback?.schoolName && !fallback?.sheetUrl) {
    return null;
  }

  return {
    schoolId: null,
    schoolName: fallback?.schoolName ?? "",
    sheetUrl: fallback?.sheetUrl ?? ""
  };
};
