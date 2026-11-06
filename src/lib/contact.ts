// Set VITE_WHATSAPP_NUMBER (full international format, digits only, e.g. 2348012345678) to point
// the site at the real support line. Without it there is simply no WhatsApp link — we never link
// to a made-up number — and callers fall back to email.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;

/** A wa.me chat link (optionally pre-filled), or null if no WhatsApp number is configured. */
export function whatsappHref(prefilledText?: string): string | null {
  const digits = WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${prefilledText ? `?text=${encodeURIComponent(prefilledText)}` : ""}`;
}
