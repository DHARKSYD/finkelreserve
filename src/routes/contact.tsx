import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { Mail, MessageCircle, Instagram } from "lucide-react";
import { useState } from "react";
import { useSendContactMessage } from "@/lib/queries/contact";

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
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 grid md:grid-cols-2 gap-12">
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
            {[
              { Icon: Mail, t: "hello@finkelreserve.com", s: "Email us" },
              { Icon: Instagram, t: "@finkelreserve", s: "Instagram DM" },
              { Icon: MessageCircle, t: "@finkelreserve", s: "X (Twitter) DM" },
            ].map(({ Icon, t, s }) => (
              <div key={s} className="glass rounded-2xl p-4 flex items-center gap-4">
                <div className="h-11 w-11 grid place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-4 self-start">
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
