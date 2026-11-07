import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { Mail, MessageCircle, Instagram, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useSendContactMessage } from "@/lib/queries/contact";
import { useSettings } from "@/lib/queries/settings";
import { whatsappHref } from "@/lib/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — Finkel Reserve" }] }),
  component: ContactPage,
});

const TOPICS = ["Order support", "Press & media", "Partnerships", "Other"];

function ContactPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const send = useSendContactMessage();
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";
  const whatsapp = whatsappHref("Hello Finkel Reserve, I need help with…");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    send.mutate(
      { name: `${firstName} ${lastName}`.trim(), email, topic, message },
      {
        onSuccess: () => {
          setFirstName("");
          setLastName("");
          setEmail("");
          setMessage("");
        },
      },
    );
  };

  return (
    <Layout>
      <div className="pt-32" />
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Talk to us</p>
          <h1 className="mt-3 font-display font-black text-5xl md:text-7xl tracking-tighter leading-[0.9]">
            Get in <span className="text-gradient-wine">touch</span>.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-md leading-relaxed">
            Order help, partnerships, or just want to talk wine and whiskey — drop us a line or DM
            us on socials.
          </p>

          <div className="mt-10 space-y-4">
            {/* The fastest way to reach us — only shown once a real WhatsApp number is configured
                (VITE_WHATSAPP_NUMBER); we never link to a made-up number. */}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener"
                className="glass flex min-w-0 items-center gap-4 rounded-2xl border border-primary/40 p-4 transition hover:border-primary"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Chat on WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Fastest reply — order help and questions
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
              </a>
            )}
            <a
              href={`mailto:${supportEmail}`}
              className="glass flex min-w-0 items-center gap-4 rounded-2xl p-4 transition hover:border-primary/40"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{supportEmail}</p>
                <p className="text-xs text-muted-foreground">Email us</p>
              </div>
            </a>
            {[
              { Icon: Instagram, t: "@finkelreserve", s: "Instagram DM" },
              { Icon: MessageCircle, t: "@finkelreserve", s: "X (Twitter) DM" },
            ].map(({ Icon, t, s }) => (
              <div key={s} className="glass flex min-w-0 items-center gap-4 rounded-2xl p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="glass min-w-0 rounded-3xl p-5 sm:p-8 space-y-4 self-start"
        >
          <h2 className="font-display font-black text-2xl">Send a message</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary"
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary"
          />
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary"
          >
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <textarea
            required
            rows={5}
            placeholder="Tell us more…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-input rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary resize-none"
          />
          {send.isError && (
            <p className="text-xs text-destructive">Couldn't send — please try again.</p>
          )}
          <button
            disabled={send.isPending}
            className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-60"
          >
            {send.isPending ? "Sending…" : send.isSuccess ? "✓ Message sent" : "Send message"}
          </button>
        </form>
      </section>
    </Layout>
  );
}
