import { createContext, useContext } from "react";

// Light / dark theme — shared pieces (the provider component lives in theme.tsx).
//
//   · The customer's choice is stored in localStorage under "theme" ("light" | "dark"). With no
//     choice yet we follow the device's own setting ("system") and keep following it live.
//   · The <html> element gets the `dark` class (see .dark in styles.css). THEME_INIT_SCRIPT runs
//     inline in <head> before the first paint, so a dark-mode visitor never sees a white flash —
//     the provider then just keeps the class in sync afterwards.

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
export const THEME_COLOURS: Record<ResolvedTheme, string> = { light: "#f7f2e9", dark: "#1b1513" };

/** Inline script for <head>: sets the class + colour-scheme before React hydrates. Keep it tiny and dependency-free. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||((t!=="light")&&window.matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${THEME_COLOURS.dark}":"${THEME_COLOURS.light}");}catch(e){}})();`;

export type ThemeContextValue = {
  /** The stored preference (or "system"). */
  theme: Theme;
  /** What is actually showing right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Switch to the opposite of what is showing now (and remember it). */
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);
