"use client";

import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
  type RefObject
} from "react";
import React from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") {
        return false;
      }

      const styles = window.getComputedStyle(element);
      return styles.visibility !== "hidden" && styles.display !== "none";
    }
  );
}

type AccessibleDialogProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
};

export function AccessibleDialog({
  open,
  onClose,
  titleId,
  descriptionId,
  initialFocusRef,
  className,
  children
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !dialogRef.current) {
      return undefined;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusableElements = getFocusableElements(dialogRef.current);
    const requestedFocusTarget = initialFocusRef?.current;
    const initialFocusTarget =
      requestedFocusTarget && focusableElements.includes(requestedFocusTarget)
        ? requestedFocusTarget
        : focusableElements[0];
    (initialFocusTarget ?? dialogRef.current).focus();

    return () => {
      if (previouslyFocusedElementRef.current?.isConnected) {
        previouslyFocusedElementRef.current.focus();
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [initialFocusRef, open]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={className}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>
  );
}
