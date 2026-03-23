import type { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "../auth";
import { isTeacherEmailAllowed } from "./env";

export interface TeacherSession {
  email: string;
  name: string | null;
  image: string | null;
}

const toTeacherSession = async (): Promise<TeacherSession | null> => {
  const session = await auth();
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase();

  if (!email || !isTeacherEmailAllowed(email)) {
    return null;
  }

  return {
    email,
    name: user?.name ?? null,
    image: user?.image ?? null
  };
};

export const getTeacherSession = async (): Promise<TeacherSession | null> => toTeacherSession();

export const requireTeacherSession = async (): Promise<TeacherSession> => {
  const session = await toTeacherSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return session;
};

export const requireTeacherRouteSession = async (): Promise<
  | {
      ok: true;
      session: TeacherSession;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> => {
  const { NextResponse } = await import("next/server");
  const session = await toTeacherSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  return {
    ok: true,
    session
  };
};
