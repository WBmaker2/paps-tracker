"use client";

import { useEffect, useState } from "react";
import React from "react";

import Link from "next/link";

const NAV_ITEMS = [
  { href: "/teacher", label: "교사 홈" },
  { href: "/teacher/students", label: "학생" },
  { href: "/teacher/results", label: "결과" },
  { href: "/teacher/settings", label: "설정" }
];

function normalizePath(path: string) {
  return path.replace(/\/$/, "") || "/";
}

export function TeacherNavigation() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };

    syncPath();
    window.addEventListener("popstate", syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  return (
    <nav aria-label="교사 내비게이션" className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          aria-current={currentPath === item.href ? "page" : undefined}
          className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
          onClick={() => setCurrentPath(item.href)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
