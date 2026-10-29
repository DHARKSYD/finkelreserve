import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useSettings } from "@/lib/queries/settings";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Finkel Reserve" },
      {
        name: "description",
        content: "How Finkel Reserve collects, uses, and protects your personal information.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-xl mb-4 text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-sm">{children}</div>
    </div>
  );
}

function PrivacyPage() {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";

  return (
    <Layout>
      <div className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          {/* Header */}
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">Legal</p>
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter text-foreground mb-4">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
          </div>

          <div className="border-t border-border/60 pt-10">
            <Section title="1. Who We Are">
              <p>
                Finkel Reserve ("we", "us", "our") operates the online store at{" "}
                <strong className="text-foreground">finkelreserve.com</strong>, selling wines,
                whiskeys and fine beverages to customers in Nigeria.
              </p>
              <p>
                For privacy-related enquiries, contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                or via our Instagram and X accounts{" "}
                <span className="text-foreground font-medium">@finkelreserve</span>.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>
                We collect information you give us directly and information generated when you use
                our site.
              </p>

              <div className="mt-3 space-y-4">
                <div>
                  <p className="font-semibold text-foreground mb-1">Account information</p>
                  <p>
                    When you register, we collect your email address and a display name. Your
                    password is never stored by us — authentication is managed by Supabase, which
                    stores only a secure hash.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Order information</p>
                  <p>
                    When you place an order, we collect your full name, email address, phone number,
                    and delivery address. We also record the items ordered, quantities, prices,
                    coupon codes applied, and the shipping amount charged.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Payment information</p>
                  <p>
                    We do not store your card number, CVV, or bank account details. Payment
                    processing is handled by <strong className="text-foreground">Paystack</strong>,
                    which is PCI DSS compliant. We retain only a payment reference number and the
                    payment status (paid, pending, failed) from Paystack.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Product reviews</p>
                  <p>
                    If you submit a product review, we store your review text, rating, and a link to
                    your account.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Cart and wishlist</p>
                  <p>
                    Your shopping cart and wishlist are stored locally on your device using browser
                    storage (localStorage). This data stays on your device and is not sent to our
                    servers unless you complete a purchase.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">
                    Contact and newsletter submissions
                  </p>
                  <p>
                    If you send us a message via the contact form or subscribe to our newsletter, we
                    store your name, email address, and (for contact messages) your message content.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Technical information</p>
                  <p>
                    Our infrastructure may automatically log your IP address and browser/device
                    information as part of normal server operation. We do not currently run
                    third-party analytics scripts.
                  </p>
                </div>
              </div>
            </Section>

            <Section title="3. How We Use Your Information">
              <ul className="list-disc list-inside space-y-2">
                <li>To process and fulfil your orders</li>
                <li>To send you order confirmation and status updates</li>
                <li>To respond to enquiries you send us via the contact form</li>
                <li>To detect and prevent fraud and abuse</li>
                <li>To improve our product catalogue and store experience</li>
                <li>
                  To send marketing communications, if you have subscribed to our newsletter — you
                  can unsubscribe at any time by contacting us
                </li>
                <li>To comply with applicable legal obligations</li>
              </ul>
            </Section>

            <Section title="4. Service Providers">
              <p>
                We share data with the following third-party service providers where necessary to
                operate the store:
              </p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Supabase</p>
                  <p>
                    Our database and authentication provider. Customer accounts, orders, and product
                    data are stored on Supabase's infrastructure. Supabase operates data centres in
                    the US and EU.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Paystack</p>
                  <p>
                    Payment processing for online orders. Your billing and card details are entered
                    directly on Paystack's secure checkout — we never see or store them. Paystack is
                    registered and regulated in Nigeria and the US.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Cloudflare</p>
                  <p>
                    Web hosting and content delivery. Cloudflare may process request data (IP
                    address, headers) as part of routing traffic to our store.
                  </p>
                </div>
              </div>
              <p className="mt-3">We do not sell your personal data to any third party.</p>
            </Section>

            <Section title="5. Data Retention">
              <p>
                We retain order records for as long as required for accounting and legal compliance
                purposes. If you wish to have your account or personal data deleted, contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                and we will process your request. Note that we may be required to retain certain
                order records for tax or legal reasons even after account deletion.
              </p>
            </Section>

            <Section title="6. Your Rights">
              <p>
                Under applicable Nigerian data protection law (NDPR 2023), you have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data (subject to legal retention requirements)</li>
                <li>Withdraw consent to marketing communications at any time</li>
                <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC)</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>
                . We will respond within a reasonable timeframe.
              </p>
            </Section>

            <Section title="7. Cookies and Browser Storage">
              <p>
                We use browser localStorage to persist your shopping cart and wishlist across page
                visits. This data never leaves your device unless you complete a checkout. We do not
                use third-party advertising or tracking cookies.
              </p>
              <p>
                Authentication sessions use secure, HTTP-only mechanisms managed by Supabase. You
                can clear your session by signing out.
              </p>
            </Section>

            <Section title="8. Children's Privacy">
              <p>
                Our store is intended for customers aged 18 and above. We do not knowingly collect
                personal information from children. If you believe a child has provided us with
                personal information, please contact us and we will delete it promptly.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this
                page with an updated date at the top. Continued use of our store after changes are
                posted constitutes your acceptance of the revised policy.
              </p>
            </Section>

            <Section title="10. Contact">
              <p>
                For any questions about this Privacy Policy or how we handle your data, please
                contact us:
              </p>
              <div className="mt-3 p-4 rounded-xl bg-surface-2 border border-border/60">
                <p className="font-semibold text-foreground">Finkel Reserve</p>
                <p>
                  Email:{" "}
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                    {supportEmail}
                  </a>
                </p>
                <p>
                  Instagram / X: <span className="text-foreground font-medium">@finkelreserve</span>
                </p>
              </div>
            </Section>
          </div>

          {/* Back + sibling links */}
          <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">
              ← Home
            </Link>
            <a href="/terms" className="hover:text-primary">
              Terms &amp; Conditions
            </a>
            <a href="/shipping-policy" className="hover:text-primary">
              Shipping Policy
            </a>
            <a href="/returns-policy" className="hover:text-primary">
              Returns &amp; Refunds
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
