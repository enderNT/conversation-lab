"use client";

import { useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "conversation-lab-theme";

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
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="button-secondary min-w-[152px] justify-center"
      onClick={() => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      aria-pressed={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      suppressHydrationWarning
    >
      {isDark ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}