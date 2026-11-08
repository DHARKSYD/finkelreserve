import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/lib/theme-context";

// One toaster for the whole app (it used to be mounted only in the admin layout, so customers never
// saw a "saved"/error message from the account, address or return pages). Toasts appear at the
// top, below the header — the bottom is taken by the phone tab bar — and follow the theme.
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Toaster
      position="top-center"
      offset={84}
      mobileOffset={72}
      theme={mounted ? resolvedTheme : "light"}
    />
  );
}
