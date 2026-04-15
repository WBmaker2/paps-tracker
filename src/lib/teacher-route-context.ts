import { NextRequest, NextResponse } from "next/server";

import type { PAPSTeacher } from "./paps/types";
import type { TeacherBootstrap } from "./store/paps-store-types";

type TeacherBootstrapStore = {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
};

export type AuthorizedTeacherRouteContext<TStore extends TeacherBootstrapStore> = {
  store: TStore;
  teacher: PAPSTeacher;
  bootstrap: TeacherBootstrap;
};

export const forbiddenTeacherRouteResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
    }
  );

export const notFoundTeacherRouteResponse = (message: string) =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 404
    }
  );

export const getAuthorizedTeacherRouteContext = async <
  TStore extends TeacherBootstrapStore
>({
  request,
  teacherEmail,
  createStore
}: {
  request: NextRequest;
  teacherEmail: string;
  createStore: (request: NextRequest, teacherEmail: string) => Promise<TStore>;
}): Promise<AuthorizedTeacherRouteContext<TStore>> => {
  const store = await createStore(request, teacherEmail);
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail });
  const teacher = bootstrap.teacher;

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher,
    bootstrap
  };
};
