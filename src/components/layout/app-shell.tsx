import React, { type ReactNode } from "react";

import { TeacherNavigation } from "./teacher-navigation";

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
            <TeacherNavigation />
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
