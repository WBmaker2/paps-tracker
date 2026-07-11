import type { ReactNode } from "react";
import React from "react";

type LiveStatusProps = {
  children: ReactNode;
  className?: string;
  politeness?: "polite" | "assertive" | "off";
};

export function LiveStatus({
  children,
  className,
  politeness = "polite"
}: LiveStatusProps) {
  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className={className}>
      {children}
    </div>
  );
}
