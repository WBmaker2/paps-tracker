import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import {
  getNextAuthSecret,
  getGoogleHostedDomain,
  getGoogleOAuthEnv,
  hasGoogleOAuthEnv,
  isTeacherEmailAllowed
} from "./lib/env";

const hostedDomain = getGoogleHostedDomain();
const googleProvider = hasGoogleOAuthEnv()
  ? Google({
      clientId: getGoogleOAuthEnv().clientId,
      clientSecret: getGoogleOAuthEnv().clientSecret,
      authorization: hostedDomain
        ? {
            params: {
              hd: hostedDomain
            }
          }
        : undefined
    })
  : null;

const nextAuth = NextAuth({
  trustHost: true,
  secret: getNextAuthSecret() ?? undefined,
  session: {
    strategy: "jwt"
  },
  providers: googleProvider ? [googleProvider] : [],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();

      if (!email) {
        return false;
      }

      return isTeacherEmailAllowed(email);
    }
  }
});

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
