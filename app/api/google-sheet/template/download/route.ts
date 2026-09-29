import { NextResponse } from "next/server";

import { buildBlankPapsTemplateWorkbook } from "../../../../../src/lib/google/blank-template-xlsx";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const workbook = buildBlankPapsTemplateWorkbook();

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "content-type": XLSX_CONTENT_TYPE,
      "content-disposition": 'attachment; filename="paps-empty-template-v0.2.xlsx"',
      "cache-control": "private, no-store"
    }
  });
}
