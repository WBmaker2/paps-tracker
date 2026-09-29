import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsSchoolConnectionCard } from "../../src/components/teacher/settings-school-connection-card";

describe("settings blank template recovery CTA", () => {
  it("offers a blank workbook and explains conversion even when no template is configured", () => {
    render(
      <SettingsSchoolConnectionCard
        sheetConnected={false}
        sheetSetupStatus={{
          templateConfigured: false,
          serviceAccountConfigured: true,
          serviceAccountEmail: "paps@example.invalid",
          missingKeys: ["GOOGLE_SHEETS_TEMPLATE_ID"]
        }}
        schoolName=""
        sheetUrl=""
        schoolMessage={null}
        teacherInviteRequired={false}
        teacherInviteToken=""
        canIssueInvite={false}
        inviteTargetEmail=""
        issuedInviteToken=""
        inviteMessage={null}
        isSchoolPending={false}
        isTemplatePending={false}
        isInvitePending={false}
        onSchoolNameChange={vi.fn()}
        onSheetUrlChange={vi.fn()}
        onTeacherInviteTokenChange={vi.fn()}
        onInviteTargetEmailChange={vi.fn()}
        onOpenTemplateCopy={vi.fn()}
        onConnectWithTeacherInvite={vi.fn()}
        onSaveSchool={vi.fn()}
        onIssueTeacherInvite={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: "빈 PAPS 시트 다운로드" })).toHaveAttribute(
      "href",
      "/api/google-sheet/template/download"
    );
    expect(screen.getByText(/측정 기록은 없습니다/)).toBeInTheDocument();
    expect(screen.getAllByText(/Google Sheets로 변환/)).toHaveLength(2);
  });
});
