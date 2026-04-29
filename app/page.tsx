import Link from "next/link";

import { UpdateInfoDialog } from "../src/components/home/update-info-dialog";
import { APP_VERSION, UPDATE_HISTORY } from "../src/lib/update-history";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(179,92,46,0.24),transparent_58%)]" />
        <div className="absolute inset-0 bg-paper-grid bg-grid opacity-50" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
          <header className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
                PAPS Tracker
              </p>
              <span className="rounded-full border border-ink/10 bg-white/65 px-3 py-1 text-xs font-semibold text-ink/55">
                {APP_VERSION}
              </span>
              <UpdateInfoDialog updates={UPDATE_HISTORY} />
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              학생 기록은 빠르게,
              <br />
              PAPS 운영은 한 흐름으로.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
              교사는 학교·학급·학생 명단을 준비하고 세션을 열어 기록 입력부터
              대표값 검토, Google Sheets 동기화까지 관리할 수 있습니다. 학생은
              선생님이 안내한 세션 링크 또는 QR 코드로 접속해 측정 기록을 제출합니다.
            </p>
          </header>

          <section className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <Link
              href="/teacher"
              className="group rounded-[2rem] border border-accent/30 bg-white/90 p-8 shadow-panel backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-accent/60"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                Teacher Start
              </p>
              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">교사 홈으로 시작</h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-ink/70 sm:text-base">
                    학교 설정, 학생 명단, 세션 운영, 대표값 선택, 시트 동기화를 한 화면에서
                    관리합니다.
                  </p>
                </div>
                <span className="w-fit rounded-full border border-accent/30 px-5 py-3 text-sm font-semibold text-accent transition group-hover:bg-accent group-hover:text-white">
                  바로가기
                </span>
              </div>
            </Link>

            <article className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                Student Flow
              </p>
              <h2 className="mt-5 text-2xl font-semibold">학생 입력 안내</h2>
              <p className="mt-4 text-sm leading-7 text-ink/70 sm:text-base">
                학생은 선생님이 열어 준 세션 링크 또는 QR 코드로 접속합니다.
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/65 sm:text-base">
                학생 입력 링크는 교사 홈에서 세션을 연 뒤 안내할 수 있습니다.
              </p>
            </article>
          </section>

          <div className="mt-auto pt-12" />
        </div>
      </div>
    </main>
  );
}
