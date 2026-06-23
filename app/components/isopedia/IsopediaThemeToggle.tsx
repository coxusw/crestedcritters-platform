"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "isopedia-theme";

type Theme = "dark" | "light";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

function getSavedTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isTheme(savedTheme) ? savedTheme : "dark";
}

export default function IsopediaThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.isopediaTheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      suppressHydrationWarning
      className="isopedia-theme-toggle rounded-xl border border-white/10 bg-[#07130c] px-4 py-2 text-sm font-black text-white transition hover:bg-[#18291d]"
    >
      {label}
    </button>
  );
}
