const getOptionalEnv = (key: string): string | null => {
  const value = process.env[key]?.trim();

  return value ? value : null;
};

export const getRequiredEnv = (key: string): string => {
  const value = getOptionalEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable ${key}.`);
  }

  return value;
};

const parseCsvEnv = (key: string): string[] => {
  const value = getOptionalEnv(key);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

export const normalizeGoogleServiceAccountPrivateKey = (
  value: string | null | undefined
): string | null => value?.replace(/\\n/g, "\n") ?? null;

export interface GoogleOAuthEnv {
  clientId: string;
  clientSecret: string;
}

export interface GoogleSheetsEnv {
  templateId: string | null;
  serviceAccountEmail: string | null;
  serviceAccountPrivateKey: string | null;
}

export interface GoogleSheetsSetupStatus {
  templateConfigured: boolean;
  serviceAccountConfigured: boolean;
  serviceAccountEmail: string | null;
  missingKeys: string[];
}

export interface GoogleOAuthSetupStatus {
  ready: boolean;
  missingKeys: string[];
  summary: string;
}

export interface TeacherAccessSetupStatus {
  ready: boolean;
  hostedDomain: string | null;
  allowlistCount: number;
  summary: string;
}

export interface GoogleSheetsOperationalStatus extends GoogleSheetsSetupStatus {
  ready: boolean;
  summary: string;
}

export interface AppOperationalReadiness {
  ready: boolean;
  checks: {
    googleOAuth: GoogleOAuthSetupStatus;
    teacherAccess: TeacherAccessSetupStatus;
    googleSheets: GoogleSheetsOperationalStatus;
  };
}

export const getNextAuthSecret = (): string | null => {
  const configuredSecret = getOptionalEnv("NEXTAUTH_SECRET");

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    return getRequiredEnv("NEXTAUTH_SECRET");
  }

  return "paps-tracker-dev-secret";
};

export const hasGoogleOAuthEnv = (): boolean =>
  Boolean(getOptionalEnv("GOOGLE_CLIENT_ID") && getOptionalEnv("GOOGLE_CLIENT_SECRET"));

export const getGoogleOAuthSetupStatus = (): GoogleOAuthSetupStatus => {
  const missingKeys: string[] = [];

  if (!getOptionalEnv("GOOGLE_CLIENT_ID")) {
    missingKeys.push("GOOGLE_CLIENT_ID");
  }

  if (!getOptionalEnv("GOOGLE_CLIENT_SECRET")) {
    missingKeys.push("GOOGLE_CLIENT_SECRET");
  }

  return {
    ready: missingKeys.length === 0,
    missingKeys,
    summary:
      missingKeys.length === 0
        ? "Google OAuth 준비 완료"
        : "Google OAuth 환경변수 설정 필요"
  };
};

export const getGoogleOAuthEnv = (): GoogleOAuthEnv => ({
  clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET")
});

export const getGoogleHostedDomain = (): string | null => getOptionalEnv("GOOGLE_HOSTED_DOMAIN");

export const getTeacherEmailAllowlist = (): string[] => parseCsvEnv("TEACHER_EMAIL_ALLOWLIST");

export const getStudentTeacherPin = (): string | null => getOptionalEnv("STUDENT_TEACHER_PIN");

export const hasStudentTeacherPin = (): boolean => Boolean(getStudentTeacherPin());

export const hasTeacherAccessConfig = (): boolean =>
  Boolean(getGoogleHostedDomain() || getTeacherEmailAllowlist().length > 0);

export const getTeacherAccessSetupStatus = (): TeacherAccessSetupStatus => {
  const hostedDomain = getGoogleHostedDomain();
  const allowlistCount = getTeacherEmailAllowlist().length;
  const ready = Boolean(hostedDomain || allowlistCount > 0);

  let summary = "로그인 허용 대상 설정 필요";

  if (hostedDomain) {
    summary = `${hostedDomain} 도메인`;
  } else if (allowlistCount > 0) {
    summary = `허용 이메일 ${allowlistCount}개`;
  }

  return {
    ready,
    hostedDomain,
    allowlistCount,
    summary
  };
};

export const isTeacherEmailAllowed = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const hostedDomain = getGoogleHostedDomain()?.trim().toLowerCase() ?? null;
  const allowlist = getTeacherEmailAllowlist();

  if (!hostedDomain && allowlist.length === 0) {
    return true;
  }

  const matchesHostedDomain = hostedDomain
    ? normalizedEmail.endsWith(`@${hostedDomain}`)
    : false;
  const matchesAllowlist = allowlist.includes(normalizedEmail);

  return matchesHostedDomain || matchesAllowlist;
};

export const getGoogleSheetsEnv = (): GoogleSheetsEnv => ({
  templateId: getOptionalEnv("GOOGLE_SHEETS_TEMPLATE_ID"),
  serviceAccountEmail: getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  serviceAccountPrivateKey: normalizeGoogleServiceAccountPrivateKey(
    getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
  )
});

export const getGoogleSheetsSetupStatus = (): GoogleSheetsSetupStatus => {
  const env = getGoogleSheetsEnv();
  const missingKeys: string[] = [];

  if (!env.templateId) {
    missingKeys.push("GOOGLE_SHEETS_TEMPLATE_ID");
  }

  if (!env.serviceAccountEmail) {
    missingKeys.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  }

  if (!env.serviceAccountPrivateKey) {
    missingKeys.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  return {
    templateConfigured: Boolean(env.templateId),
    serviceAccountConfigured: Boolean(
      env.serviceAccountEmail && env.serviceAccountPrivateKey
    ),
    serviceAccountEmail: env.serviceAccountEmail,
    missingKeys
  };
};

export const getGoogleSheetsOperationalStatus = (): GoogleSheetsOperationalStatus => {
  const status = getGoogleSheetsSetupStatus();

  return {
    ...status,
    ready: status.templateConfigured && status.serviceAccountConfigured,
    summary:
      status.templateConfigured && status.serviceAccountConfigured
        ? "서비스 계정 및 템플릿 준비 완료"
        : "Google Sheets 연동 설정 필요"
  };
};

export const getAppOperationalReadiness = (): AppOperationalReadiness => {
  const googleOAuth = getGoogleOAuthSetupStatus();
  const teacherAccess = getTeacherAccessSetupStatus();
  const googleSheets = getGoogleSheetsOperationalStatus();

  return {
    ready: googleOAuth.ready && teacherAccess.ready && googleSheets.ready,
    checks: {
      googleOAuth,
      teacherAccess,
      googleSheets
    }
  };
};
