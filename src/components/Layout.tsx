import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { MobileTabBar } from "./MobileTabBar";
import { DiscoverStrip } from "./DiscoverStrip";
import { MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/queries/settings";
import { whatsappHref } from "@/lib/contact";

export function Layout({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";
  const contactHref = whatsappHref() ?? `mailto:${supportEmail}`;

  return (
    // overflow-x-clip: slide-in reveal animations (e.g. initial x: 30) sit off to the side until they
    // scroll into view, and that extends the page's scrollable width — on a phone the whole page
    // could be dragged sideways. `clip` (unlike `hidden`) doesn't create a scroll container, so
    // sticky elements and the pinned hero keep working.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main className="flex-1">{children}</main>
      <DiscoverStrip />
      <Footer />
      <CartDrawer />
      {/* Phones and tablets have the CONTACT tab in the bottom bar, so this floating button is
          desktop-only (it would only duplicate the tab and crowd the screen). */}
      <a
        href={contactHref}
        target="_blank"
        rel="noopener"
        aria-label="Contact support"
        className="fixed bottom-5 right-5 z-40 hidden h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow pulse-glow transition hover:scale-110 lg:grid"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
      <MobileTabBar />
    </div>
  );
}
