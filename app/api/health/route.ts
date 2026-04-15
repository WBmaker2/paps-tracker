import { NextResponse } from "next/server";

import { getAppOperationalReadiness } from "../../../src/lib/env";

export function GET() {
  const readiness = getAppOperationalReadiness();

  return NextResponse.json({
    ok: true,
    service: "paps-tracker",
    ready: readiness.ready,
    checks: readiness.checks
  });
}
