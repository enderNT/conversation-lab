"use client";

import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "conversation-lab-theme";
const THEME_EVENT = "conversation-lab-theme-change";

function readTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const currentTheme = document.documentElement.dataset.theme;

    if (currentTheme === "dark" || currentTheme === "light") {
      return currentTheme;
    }
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => onStoreChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener(THEME_EVENT, handleChange);
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(THEME_EVENT, handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/78 text-[var(--foreground)] shadow-[0_8px_24px_rgba(24,35,47,0.08)] transition hover:-translate-y-px hover:bg-white/92"
      onClick={() => {
        const nextTheme = isDark ? "light" : "dark";
        applyTheme(nextTheme);
      }}
      aria-pressed={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 3v2.2" strokeLinecap="round" />
          <path d="M12 18.8V21" strokeLinecap="round" />
          <path d="M5.64 5.64l1.56 1.56" strokeLinecap="round" />
          <path d="M16.8 16.8l1.56 1.56" strokeLinecap="round" />
          <path d="M3 12h2.2" strokeLinecap="round" />
          <path d="M18.8 12H21" strokeLinecap="round" />
          <path d="M5.64 18.36l1.56-1.56" strokeLinecap="round" />
          <path d="M16.8 7.2l1.56-1.56" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4.2" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
          <path d="M14.94 2.75a.75.75 0 0 0-.82 1.03c.39.92.6 1.93.6 2.99 0 4.23-3.44 7.67-7.67 7.67-1.06 0-2.07-.21-2.99-.6a.75.75 0 0 0-1.03.82A10 10 0 1 0 14.94 2.75Z" />
        </svg>
      )}
    </button>
  );
}
