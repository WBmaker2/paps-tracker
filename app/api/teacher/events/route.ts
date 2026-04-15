import { NextRequest } from "next/server";

import { createTeacherLiveUpdateStream } from "../../../../src/lib/teacher-live-updates";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  return new Response(
    createTeacherLiveUpdateStream({
      teacherEmail: teacherSession.session.email,
      signal: request.signal
    }),
    {
      headers: {
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no"
      }
    }
  );
}
