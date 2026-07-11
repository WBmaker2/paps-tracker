"use client";

import { useRef, useState } from "react";

import type { UpdateHistoryEntry } from "../../lib/update-history";
import { AccessibleDialog } from "../ui/accessible-dialog";

type UpdateInfoDialogProps = {
  updates: UpdateHistoryEntry[];
};

export function UpdateInfoDialog({ updates }: UpdateInfoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        className="rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70 shadow-sm backdrop-blur transition hover:border-accent/50 hover:text-accent"
        onClick={() => setIsOpen(true)}
      >
        Update info
      </button>

      <AccessibleDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        titleId="update-info-title"
        descriptionId="update-info-description"
        initialFocusRef={closeButtonRef}
        className="relative max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
      >
            <div className="flex flex-col gap-4 border-b border-ink/10 bg-canvas/70 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
                  Release notes
                </p>
                <h2 id="update-info-title" className="mt-3 text-2xl font-semibold">
                  업데이트 기록
                </h2>
                <p id="update-info-description" className="mt-2 text-sm leading-6 text-ink/65">
                  PAPS Tracker가 초기 MVP에서 현재 운영 가능한 흐름까지 발전한 과정을
                  최신순으로 정리했습니다.
                </p>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                className="w-fit rounded-full border border-ink/15 bg-white px-5 py-2 text-sm font-semibold text-ink/75 transition hover:border-accent/50 hover:text-accent"
                onClick={() => setIsOpen(false)}
              >
                닫기
              </button>
            </div>

            <ol className="max-h-[58vh] space-y-4 overflow-y-auto px-6 py-6">
              {updates.map((entry) => (
                <li key={entry.version} className="rounded-[1.5rem] border border-ink/10 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      {entry.version}
                    </span>
                    {entry.date ? (
                      <time dateTime={entry.date} className="text-xs font-medium text-ink/55">
                        {entry.date}
                      </time>
                    ) : null}
                    <h3 className="text-lg font-semibold">{entry.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/70">{entry.summary}</p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-ink/65">
                    {entry.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
      </AccessibleDialog>
    </>
  );
}
