import Link from "next/link";

const entryPoints = [
  {
    href: "/teacher",
    label: "교사 관리 영역",
    eyebrow: "Teacher",
    description:
      "학교 설정, 학생 명단, 세션 운영, 대표값 선택, 시트 동기화를 관리하는 공간입니다."
  },
  {
    href: "/session/demo",
    label: "학생 입력 영역",
    eyebrow: "Student",
    description:
      "세션에 참여한 학생이 이름을 고르고 측정 기록을 입력하는 흐름을 준비하는 공간입니다."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(179,92,46,0.24),transparent_58%)]" />
        <div className="absolute inset-0 bg-paper-grid bg-grid opacity-50" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
          <header className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
              PAPS Tracker MVP
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              학생 기록 수집은 단순하게,
              <br />
              세션 운영은 교사 중심으로.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
              이 첫 화면은 PAPS 학생 기록 시스템 MVP의 진입점입니다. 다음 작업에서
              교사 대시보드와 학생 세션 입력 화면이 이어서 추가될 수 있도록 구조를
              가볍게 열어 둡니다.
            </p>
          </header>

          <section className="mt-12 grid gap-5 lg:grid-cols-2">
            {entryPoints.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="group rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-accent/40"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                  {entry.eyebrow}
                </p>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold">{entry.label}</h2>
                  <span className="rounded-full border border-ink/10 px-4 py-2 text-sm text-ink/70 transition group-hover:border-accent/40 group-hover:text-accent">
                    바로가기
                  </span>
                </div>
                <p className="mt-4 max-w-md text-sm leading-7 text-ink/70 sm:text-base">
                  {entry.description}
                </p>
              </Link>
            ))}
          </section>

          <section className="mt-auto pt-12">
            <div className="rounded-[2rem] border border-ink/10 bg-ink px-6 py-6 text-white shadow-panel sm:px-8">
              <p className="text-sm uppercase tracking-[0.24em] text-white/60">
                Ready For Next Tasks
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">
                다음 단계에서는 교사용 `/teacher` 화면과 학생용 `/session/[sessionId]`
                경로를 실제 페이지로 연결하고, 세션 규칙과 PAPS 기록 도메인 로직을
                추가합니다.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
