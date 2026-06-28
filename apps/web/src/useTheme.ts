import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "wr-theme";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Light/dark theme toggle, persisted to localStorage, applied via `.dark` on <html>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => current());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return { theme, toggle };
}
