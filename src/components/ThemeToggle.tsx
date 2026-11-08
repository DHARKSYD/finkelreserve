import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

// Light/dark switch. Until mounted it renders the "light" state so the server HTML and the
// first client render agree (the real theme is only known in the browser).
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`grid h-10 w-10 place-items-center rounded-full transition hover:bg-surface-2 ${className}`}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
