import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "./rate-limit";

// These two forms used to insert straight from the browser into tables
// whose RLS policy is `with check (true)` (open by design — anyone should
// be able to send a message or subscribe without an account). That's fine
// for *access*, but it meant zero validation or rate limiting stood between
// a script and the table: any length, any "email", unlimited requests. This
// moves both behind a server function so there's a real gate in front of
// that open policy.

export type ContactResult = { ok: true } | { ok: false; error: string };

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  topic: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1).max(5000),
});

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }): Promise<ContactResult> => {
    const rate = await checkRateLimit("contact", 3, 10 * 60_000);
    if (!rate.ok) {
      return { ok: false, error: "Too many messages sent — please try again in a few minutes." };
    }

    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      topic: data.topic || null,
      message: data.message,
    });
    if (error) return { ok: false, error: "Could not send your message. Please try again." };
    return { ok: true };
  });

export type NewsletterResult = { ok: true } | { ok: false; error: string };

const newsletterSchema = z.object({
  email: z.string().trim().email().max(200),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => newsletterSchema.parse(data))
  .handler(async ({ data }): Promise<NewsletterResult> => {
    const rate = await checkRateLimit("newsletter", 3, 10 * 60_000);
    if (!rate.ok) {
      return { ok: false, error: "Too many attempts — please try again in a few minutes." };
    }

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email: data.email });
    if (error && error.code !== "23505") {
      // 23505 = unique violation = already subscribed — treat as success, not an error.
      return { ok: false, error: "Could not subscribe. Please try again." };
    }
    return { ok: true };
  });
