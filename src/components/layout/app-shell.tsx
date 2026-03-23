import React, { type ReactNode } from "react";

import Link from "next/link";

const NAV_ITEMS = [
  { href: "/teacher", label: "대시보드" },
  { href: "/teacher/students", label: "학생" },
  { href: "/teacher/sessions", label: "세션" },
  { href: "/teacher/results", label: "결과" },
  { href: "/teacher/settings", label: "설정" }
];

export function AppShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas px-6 py-8 text-ink sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-6 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
                {eyebrow}
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold">{title}</h1>
                <p className="max-w-3xl text-sm leading-7 text-ink/75">{description}</p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
