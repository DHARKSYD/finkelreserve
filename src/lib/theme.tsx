import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DARK_QUERY,
  STORAGE_KEY,
  THEME_COLOURS,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme-context";

// Keeps the <html class="dark"> and the stored preference in sync (see theme-context.ts for the
// design notes and the inline script that sets the class before first paint).

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system"; // storage blocked (private mode, etc.) — just follow the device
  }
}

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialisers read the real values on the client; nothing rendered depends on these
  // during SSR (ThemeToggle waits until mounted), so there is no hydration mismatch.
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", onChange);
    // Another tab changed the theme.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStoredTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOURS[resolvedTheme]);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — the choice still applies for this visit */
    }
  }, []);

  const toggle = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
