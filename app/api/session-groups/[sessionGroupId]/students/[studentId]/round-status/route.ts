import { NextRequest, NextResponse } from "next/server";

import { loadStudentRoundStatusFromSheet } from "../../../../../../../src/lib/google/sheet-student-round-status";
import { resolveStudentSessionAccessToken } from "../../../../../../../src/lib/student-session-access";

type Context = {
  params: Promise<{
    sessionGroupId: string;
    studentId: string;
  }>;
};

const json = (payload: unknown, status = 200) =>
  NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store"
    }
  });

export async function GET(request: NextRequest, context: Context) {
  const accessToken = request.headers.get("x-paps-student-access-token")?.trim() ?? "";

  if (!accessToken) {
    return json({ error: "Student session access token is required." }, 401);
  }

  const { sessionGroupId, studentId } = await context.params;

  try {
    const access = resolveStudentSessionAccessToken(accessToken);

    if (access.sessionGroupId !== sessionGroupId) {
      return json({ error: "Student session access token does not match this session." }, 403);
    }

    const result = await loadStudentRoundStatusFromSheet({
      spreadsheetId: access.spreadsheetId,
      sessionGroupId,
      studentId
    });

    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load round status.";

    if (message === "Invalid student session access token.") {
      return json({ error: message }, 401);
    }

    if (message.includes("not found")) {
      return json({ error: "Round status was not found." }, 404);
    }

    return json({ error: "Could not load round status." }, 400);
  }
}
