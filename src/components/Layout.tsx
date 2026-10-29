import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/queries/settings";

// Set VITE_WHATSAPP_NUMBER (full international format, digits only, e.g.
// 2348012345678) to point this at the real support line. Without it, the
// button falls back to email rather than linking to a fake number.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;

export function Layout({
  children,
  hideFabOnMobile,
}: {
  children: ReactNode;
  /** For pages with their own mobile-only fixed bottom bar (currently just
   *  the product page's sticky Add to Cart) — without this, the FAB and
   *  that bar visually collide and the FAB becomes unreachable under it.
   *  Unaffected on desktop, where no such bar exists. */
  hideFabOnMobile?: boolean;
}) {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";
  const contactHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}`
    : `mailto:${supportEmail}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <a
        href={contactHref}
        target="_blank"
        rel="noopener"
        aria-label="Contact support"
        className={`fixed bottom-5 right-5 z-40 h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow pulse-glow hover:scale-110 transition ${
          hideFabOnMobile ? "hidden lg:grid" : "grid"
        }`}
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
