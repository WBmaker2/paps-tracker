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

export interface GoogleOAuthEnv {
  clientId: string;
  clientSecret: string;
}

export interface GoogleSheetsEnv {
  templateId: string | null;
  serviceAccountEmail: string | null;
  serviceAccountPrivateKey: string | null;
}

export const getNextAuthSecret = (): string | null => {
  const configuredSecret = getOptionalEnv("NEXTAUTH_SECRET");

  if (configuredSecret) {
    return configuredSecret;
  }

  return process.env.NODE_ENV === "production" ? null : "paps-tracker-dev-secret";
};

export const hasGoogleOAuthEnv = (): boolean =>
  Boolean(getOptionalEnv("GOOGLE_CLIENT_ID") && getOptionalEnv("GOOGLE_CLIENT_SECRET"));

export const getGoogleOAuthEnv = (): GoogleOAuthEnv => ({
  clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET")
});

export const getGoogleHostedDomain = (): string | null => getOptionalEnv("GOOGLE_HOSTED_DOMAIN");

export const getTeacherEmailAllowlist = (): string[] => parseCsvEnv("TEACHER_EMAIL_ALLOWLIST");

export const hasTeacherAccessConfig = (): boolean =>
  getTeacherEmailAllowlist().length > 0 || Boolean(getGoogleHostedDomain());

export const isTeacherEmailAllowed = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  const allowlist = getTeacherEmailAllowlist();

  if (allowlist.length > 0) {
    return allowlist.includes(normalizedEmail);
  }

  const hostedDomain = getGoogleHostedDomain()?.toLowerCase();

  if (hostedDomain) {
    return normalizedEmail.endsWith(`@${hostedDomain}`);
  }

  return false;
};

export const getGoogleSheetsEnv = (): GoogleSheetsEnv => ({
  templateId: getOptionalEnv("GOOGLE_SHEETS_TEMPLATE_ID"),
  serviceAccountEmail: getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  serviceAccountPrivateKey: getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.replace(
    /\\n/g,
    "\n"
  ) ?? null
});
