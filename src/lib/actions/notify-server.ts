import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderEmail, renderSms, type NotifyEvent, type NotifyOrder } from "@/lib/notify-templates";
import { normalizeNgMobile } from "@/lib/phone";

/**
 * Customer notifications (server-only — never import this from a route or
 * component; it reads secrets from the environment).
 *
 *  - Email goes through SendGrid (Twilio's email product).
 *  - SMS goes through Twilio Programmable Messaging.
 *
 * Both are plain REST calls over fetch (no SDKs: they assume Node and add
 * weight to a Worker). Every send is recorded in notification_log, whose
 * unique (order, event, channel) key makes sending idempotent — the Paystack
 * webhook and the verify-on-return page both fire for one payment, and only
 * the first gets to send.
 *
 * notifyOrder() NEVER throws: a failed email must not fail a checkout, a
 * payment confirmation or an admin status change. Failures are written to the
 * log (visible in Admin → Orders, with a Resend button).
 */

export type NotifyChannel = "email" | "sms";

// types.ts doesn't know these tables/columns yet (documented gap — same
// pattern as src/lib/queries/settings.ts), so talk to them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
const db = supabaseAdmin as unknown as { from: (table: string) => any };

const env = (key: string) => (process.env[key] ?? "").trim();

/** Which channels this deployment can actually send on right now. */
export function notificationCapabilities(): { email: boolean; sms: boolean } {
  const email = Boolean(env("SENDGRID_API_KEY") && env("NOTIFY_FROM_EMAIL"));
  // SMS needs an explicit switch on top of credentials. Twilio's Nigeria rules prohibit
  // alcohol-related content and require a registered sender ID — turn this on only after
  // Twilio has confirmed in writing that your account may send these messages (README).
  const sms =
    env("NOTIFY_SMS_ENABLED") === "true" &&
    Boolean(
      env("TWILIO_ACCOUNT_SID") &&
      env("TWILIO_AUTH_TOKEN") &&
      (env("TWILIO_MESSAGING_SERVICE_SID") || env("TWILIO_FROM")),
    );
  return { email, sms };
}

async function timedFetch(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendEmail(
  to: string,
  msg: { subject: string; text: string; html: string },
  brandName: string,
): Promise<{ id: string | null }> {
  const replyTo = env("NOTIFY_REPLY_TO");
  const res = await timedFetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SENDGRID_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env("NOTIFY_FROM_EMAIL"), name: env("NOTIFY_FROM_NAME") || brandName },
      ...(replyTo ? { reply_to: { email: replyTo } } : {}),
      subject: msg.subject,
      // SendGrid requires text/plain before text/html.
      content: [
        { type: "text/plain", value: msg.text },
        { type: "text/html", value: msg.html },
      ],
      // Order updates are transactional: no click-wrapping of the tracking link.
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    }),
  });
  if (res.status !== 202) {
    throw new Error(`SendGrid ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  return { id: res.headers.get("x-message-id") };
}

async function sendSms(to: string, body: string): Promise<{ id: string | null }> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const params = new URLSearchParams({ To: to, Body: body });
  const service = env("TWILIO_MESSAGING_SERVICE_SID");
  if (service) params.set("MessagingServiceSid", service);
  else params.set("From", env("TWILIO_FROM"));

  const res = await timedFetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );
  const json = (await res.json().catch(() => null)) as {
    sid?: string;
    code?: number;
    message?: string;
  } | null;
  if (!res.ok) {
    throw new Error(
      `Twilio ${res.status}${json?.code ? ` (${json.code})` : ""}: ${(json?.message ?? "").slice(0, 300)}`,
    );
  }
  return { id: json?.sid ?? null };
}

/**
 * Claim the right to send (order, event, channel). Returns the log row id if
 * this caller should send, or null if it's already been (or is being) handled.
 * A row left in 'failed' can be taken over for a retry.
 */
async function claim(
  orderId: string,
  event: NotifyEvent,
  channel: NotifyChannel,
  recipient: string,
  provider: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("notification_log")
    .insert({ order_id: orderId, event, channel, recipient, provider, status: "pending" })
    .select("id")
    .maybeSingle();
  if (!error && data) return data.id as string;
  if (error && error.code !== "23505") {
    console.error("notification_log insert failed", orderId, event, channel, error.message);
    return null;
  }
  // Unique violation: somebody already has it. Only a previously FAILED send may be retried.
  const { data: claimed } = await db
    .from("notification_log")
    .update({ status: "pending", error: null, recipient, provider })
    .eq("order_id", orderId)
    .eq("event", event)
    .eq("channel", channel)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  return (claimed?.id as string | undefined) ?? null;
}

async function finish(
  id: string,
  result:
    { status: "sent"; messageId: string | null } | { status: "failed" | "skipped"; error: string },
) {
  const patch =
    result.status === "sent"
      ? { status: "sent", provider_message_id: result.messageId, sent_at: new Date().toISOString() }
      : { status: result.status, error: result.error.slice(0, 500) };
  const { error } = await db.from("notification_log").update(patch).eq("id", id);
  if (error) console.error("notification_log update failed", id, error.message);
}

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  subtotal: number | string;
  shipping: number | string;
  discount: number | string;
  total: number | string;
  payment_method: string;
  notify_email: boolean | null;
  notify_sms: boolean | null;
  courier_provider: string | null;
  courier_tracking_url: string | null;
  courier_rider_name: string | null;
  courier_rider_phone: string | null;
};

/**
 * Send the notification for `event` on every channel the customer opted into
 * and this deployment is configured for. Safe to call from anywhere, any
 * number of times — see claim().
 */
export async function notifyOrder(
  orderId: string,
  event: NotifyEvent,
  opts: { channels?: NotifyChannel[] } = {},
): Promise<void> {
  try {
    const cap = notificationCapabilities();
    const wanted = opts.channels ?? (["email", "sms"] as NotifyChannel[]);

    const [{ data: row }, { data: items }, { data: settings }] = await Promise.all([
      db.from("orders").select("*").eq("id", orderId).maybeSingle(),
      db
        .from("order_items")
        .select("name, size, qty, price, unit, bottles_per_unit")
        .eq("order_id", orderId),
      db
        .from("store_settings")
        .select("store_name, support_email, support_phone")
        .eq("id", true)
        .maybeSingle(),
    ]);
    const o = row as OrderRow | null;
    if (!o) return;

    const brand = {
      name: (settings?.store_name as string | undefined) || "Finkel Reserve",
      supportEmail: (settings?.support_email as string | undefined) || null,
      supportPhone: (settings?.support_phone as string | undefined) || null,
      siteUrl: env("SITE_URL") || "https://finkelreserve.com",
    };
    const order: NotifyOrder = {
      id: o.id,
      customerName: o.customer_name,
      total: Number(o.total),
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      discount: Number(o.discount),
      address: [o.shipping_address, o.shipping_city, o.shipping_state]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(", "),
      items: (
        (items ?? []) as {
          name: string;
          size: string | null;
          qty: number;
          price: number;
          unit: string | null;
          bottles_per_unit: number | null;
        }[]
      ).map((i) => ({
        name: i.name,
        size: i.size ?? "",
        qty: i.qty,
        price: Number(i.price),
        unit: i.unit === "box" ? ("box" as const) : ("bottle" as const),
        bottlesPerUnit: i.bottles_per_unit ?? 1,
      })),
      courier: {
        provider: o.courier_provider,
        trackingUrl: o.courier_tracking_url,
        riderName: o.courier_rider_name,
        riderPhone: o.courier_rider_phone,
      },
    };
    const payOnDelivery = o.payment_method === "delivery";

    // ---- email
    if (wanted.includes("email") && o.notify_email !== false && o.customer_email) {
      const logId = await claim(orderId, event, "email", o.customer_email, "sendgrid");
      if (logId) {
        if (!cap.email) {
          await finish(logId, {
            status: "skipped",
            error: "Email isn't configured (SENDGRID_API_KEY / NOTIFY_FROM_EMAIL)",
          });
        } else {
          try {
            const msg = renderEmail(event, order, brand, { payOnDelivery });
            const { id } = await sendEmail(o.customer_email, msg, brand.name);
            await finish(logId, { status: "sent", messageId: id });
          } catch (err) {
            await finish(logId, {
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    // ---- sms (only if the customer opted in AND the number is a Nigerian mobile)
    if (wanted.includes("sms") && o.notify_sms === true) {
      const to = normalizeNgMobile(o.customer_phone);
      if (to) {
        const logId = await claim(orderId, event, "sms", to, "twilio");
        if (logId) {
          if (!cap.sms) {
            await finish(logId, {
              status: "skipped",
              error: "SMS isn't enabled on this deployment",
            });
          } else {
            try {
              const { id } = await sendSms(to, renderSms(event, order, brand, { payOnDelivery }));
              await finish(logId, { status: "sent", messageId: id });
            } catch (err) {
              await finish(logId, {
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // Never let a notification problem escape into checkout / payment / admin flows.
    console.error("notifyOrder failed", orderId, event, err instanceof Error ? err.message : err);
  }
}
