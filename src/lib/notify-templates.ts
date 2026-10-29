import { courierLabel } from "@/lib/courier";
import { formatNGN } from "@/lib/currency";

/**
 * Message content for order notifications. Pure functions only (no env, no
 * network) so they're safe to import anywhere and trivial to read in one go.
 * Sending lives in actions/notify-server.ts.
 */

export type NotifyEvent =
  | "order_placed" // pay-on-delivery order received
  | "payment_received" // Paystack payment confirmed
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type NotifyOrder = {
  id: string;
  customerName: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  address: string; // already joined: "street, city, state"
  // price is per unit; for a box line, unit = "box" and bottlesPerUnit = N.
  items: {
    name: string;
    size: string;
    qty: number;
    price: number;
    unit?: "bottle" | "box";
    bottlesPerUnit?: number;
  }[];
  courier: {
    provider: string | null;
    trackingUrl: string | null;
    riderName: string | null;
    riderPhone: string | null;
  };
};

export type NotifyBrand = {
  name: string;
  supportEmail: string | null;
  supportPhone: string | null;
  siteUrl: string;
};

/** Same short reference the site shows everywhere (order page, admin, returns). */
export const orderRef = (id: string) => id.slice(0, 8).toUpperCase();

export const orderUrl = (brand: NotifyBrand, order: NotifyOrder) =>
  `${brand.siteUrl.replace(/\/$/, "")}/order-confirmation/${order.id}`;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const firstName = (full: string) => full.trim().split(/\s+/)[0] || "there";

type Detail = { label: string; value: string; href?: string };

function copy(event: NotifyEvent, order: NotifyOrder, payOnDelivery: boolean) {
  const ref = orderRef(order.id);
  switch (event) {
    case "order_placed":
      return {
        subject: `Order #${ref} received`,
        headline: `Thank you, ${firstName(order.customerName)}.`,
        intro: `We've received your order. You chose to pay on delivery, so please have ${formatNGN(order.total)} ready when it arrives. We'll message you again when it's on its way.`,
        details: [] as Detail[],
      };
    case "payment_received":
      return {
        subject: `Payment received — order #${ref} confirmed`,
        headline: "Payment received.",
        intro: `Thank you, ${firstName(order.customerName)} — your payment of ${formatNGN(order.total)} went through and your order is confirmed. We'll let you know as soon as it's on its way.`,
        details: [] as Detail[],
      };
    case "out_for_delivery": {
      const c = order.courier;
      const details: Detail[] = [];
      if (c.provider) details.push({ label: "Courier", value: courierLabel(c.provider) });
      if (c.riderName) details.push({ label: "Rider", value: c.riderName });
      if (c.riderPhone)
        details.push({ label: "Rider phone", value: c.riderPhone, href: `tel:${c.riderPhone}` });
      if (c.trackingUrl)
        details.push({ label: "Track your delivery", value: c.trackingUrl, href: c.trackingUrl });
      return {
        subject: `Your order #${ref} is on its way`,
        headline: "It's on its way.",
        intro: `Good news, ${firstName(order.customerName)} — your order has left us and is heading to you.${payOnDelivery ? ` Please have ${formatNGN(order.total)} ready for the rider.` : ""}`,
        details,
      };
    }
    case "delivered":
      return {
        subject: `Delivered — order #${ref}`,
        headline: "Delivered.",
        intro: `Your order has been delivered, ${firstName(order.customerName)}. We hope you enjoy every glass. If anything arrived damaged, report it from your order page as soon as you can — see our returns policy.`,
        details: [] as Detail[],
      };
    case "cancelled":
      return {
        subject: `Order #${ref} cancelled`,
        headline: "Your order was cancelled.",
        intro: `Your order has been cancelled. If you had already paid, contact us and we'll sort out your refund.`,
        details: [] as Detail[],
      };
  }
}

export function renderEmail(
  event: NotifyEvent,
  order: NotifyOrder,
  brand: NotifyBrand,
  opts: { payOnDelivery?: boolean } = {},
): { subject: string; text: string; html: string } {
  const c = copy(event, order, !!opts.payOnDelivery);
  const url = orderUrl(brand, order);
  const lineTotal = (i: NotifyOrder["items"][number]) => formatNGN(i.price * i.qty);
  const itemLabel = (i: NotifyOrder["items"][number]) =>
    `${i.qty} × ${i.name}${
      i.size || i.unit === "box"
        ? ` (${[i.size, i.unit === "box" ? `box of ${i.bottlesPerUnit ?? 1}` : ""].filter(Boolean).join(", ")})`
        : ""
    }`;
  const support = [brand.supportEmail, brand.supportPhone].filter(Boolean).join(" · ");
  const ageLine =
    "Alcohol is for adults aged 18 and over — please have a valid ID ready when your order arrives.";
  const whyLine = `You're getting this email because you placed an order with ${brand.name} and chose to receive order updates by email.`;

  const text = [
    `Hi ${firstName(order.customerName)},`,
    "",
    c.intro,
    "",
    ...c.details.map((d) => `${d.label}: ${d.value}`),
    ...(c.details.length ? [""] : []),
    "Order summary",
    ...order.items.map((i) => `- ${itemLabel(i)} — ${lineTotal(i)}`),
    `Subtotal: ${formatNGN(order.subtotal)}`,
    ...(order.discount > 0 ? [`Discount: -${formatNGN(order.discount)}`] : []),
    `Delivery: ${order.shipping > 0 ? formatNGN(order.shipping) : "Free"}`,
    `Total: ${formatNGN(order.total)}`,
    "",
    `Delivering to: ${order.address}`,
    "",
    `View your order: ${url}`,
    "",
    ageLine,
    ...(support ? [`Questions? ${support}`] : []),
    "",
    whyLine,
  ].join("\n");

  const row = (left: string, right: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:#4a3a36;${bold ? "font-weight:700;" : ""}">${left}</td><td style="padding:6px 0;text-align:right;color:#2a1f1c;${bold ? "font-weight:700;" : ""}">${right}</td></tr>`;

  const detailsHtml = c.details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #eadfcf;border-radius:8px;background:#fbf7ef;"><tbody>${c.details
        .map(
          (d) =>
            `<tr><td style="padding:8px 14px;color:#6b5a55;font-size:13px;width:38%;">${esc(d.label)}</td><td style="padding:8px 14px;color:#2a1f1c;font-size:14px;">${
              d.href
                ? `<a href="${esc(d.href)}" style="color:#6b1f2c;word-break:break-all;">${esc(d.value)}</a>`
                : esc(d.value)
            }</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f2e9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2e9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
<tr><td style="background:#5b1a24;padding:22px 28px;"><span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:.04em;color:#f7f2e9;">${esc(brand.name)}</span></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:#2a1f1c;">${esc(c.headline)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a3a36;">${esc(c.intro)}</p>
${detailsHtml}
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#b08a3c;">Order #${esc(orderRef(order.id))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #eadfcf;border-bottom:1px solid #eadfcf;margin:0 0 20px;"><tbody>
${order.items.map((i) => row(esc(itemLabel(i)), esc(lineTotal(i)))).join("")}
</tbody></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 20px;"><tbody>
${row("Subtotal", esc(formatNGN(order.subtotal)))}
${order.discount > 0 ? row("Discount", `-${esc(formatNGN(order.discount))}`) : ""}
${row("Delivery", order.shipping > 0 ? esc(formatNGN(order.shipping)) : "Free")}
${row("Total", esc(formatNGN(order.total)), true)}
</tbody></table>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#b08a3c;">Delivering to</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#2a1f1c;">${esc(order.address)}</p>
<p style="margin:0 0 24px;"><a href="${esc(url)}" style="display:inline-block;background:#5b1a24;color:#f7f2e9;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:999px;">View your order</a></p>
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b5a55;">${esc(ageLine)}</p>
${support ? `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b5a55;">Questions? ${esc(support)}</p>` : ""}
<p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#8a7a75;">${esc(whyLine)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  return { subject: c.subject, text, html };
}

/**
 * SMS bodies. Plain ASCII on purpose ("NGN", not "₦"): a single non-GSM
 * character flips the whole message to UCS-2 and cuts a segment from 160 to
 * 70 characters, which doubles or triples the cost.
 */
export function renderSms(
  event: NotifyEvent,
  order: NotifyOrder,
  brand: NotifyBrand,
  opts: { payOnDelivery?: boolean } = {},
): string {
  const ref = orderRef(order.id);
  const url = orderUrl(brand, order);
  const amount = `NGN ${Math.round(order.total).toLocaleString("en-NG")}`;
  const b = brand.name;
  switch (event) {
    case "order_placed":
      return `${b}: order #${ref} received. Pay ${amount} on delivery. Details: ${url}`;
    case "payment_received":
      return `${b}: payment received, order #${ref} confirmed. Details: ${url}`;
    case "out_for_delivery": {
      const c = order.courier;
      const rider = [c.riderName, c.riderPhone].filter(Boolean).join(" ");
      const pay = opts.payOnDelivery ? ` Have ${amount} ready.` : "";
      return `${b}: order #${ref} is on its way.${rider ? ` Rider: ${rider}.` : ""}${pay} ${c.trackingUrl ? `Track: ${c.trackingUrl}` : `Details: ${url}`}`;
    }
    case "delivered":
      return `${b}: order #${ref} delivered. Enjoy! Details: ${url}`;
    case "cancelled":
      return `${b}: order #${ref} was cancelled. Contact us if you need help.`;
  }
}
