import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Store, Mail, ShoppingBag, Search, Save, RotateCcw } from "lucide-react";
import { useSettings, useUpdateSettings, type StoreSettingsInput } from "@/lib/queries/settings";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
  component: SettingsPage,
});

function toForm(s: NonNullable<ReturnType<typeof useSettings>["data"]>): StoreSettingsInput {
  return {
    storeName: s.storeName,
    logoUrl: s.logoUrl,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    businessAddress: s.businessAddress,
    instagramUrl: s.instagramUrl,
    twitterUrl: s.twitterUrl,
    youtubeUrl: s.youtubeUrl,
    facebookUrl: s.facebookUrl,
    defaultLowStockThreshold: s.defaultLowStockThreshold,
    returnWindowDays: s.returnWindowDays,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
    ogImageUrl: s.ogImageUrl,
  };
}

function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<StoreSettingsInput | null>(null);

  // Only sync from the fetched row when we don't already have local edits in
  // flight — otherwise a background refetch (e.g. tab refocus) would stomp
  // whatever the admin is mid-typing.
  useEffect(() => {
    if (settings && !form) setForm(toForm(settings));
  }, [settings, form]);

  const set = <K extends keyof StoreSettingsInput>(key: K, value: StoreSettingsInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const nullableText = (v: string) => (v.trim() === "" ? null : v.trim());

  const handleSave = () => {
    if (!form) return;
    if (!form.storeName.trim()) return toast.error("Store name is required.");
    if (!form.supportEmail.trim()) return toast.error("Support email is required.");
    if (!form.seoTitle.trim() || !form.seoDescription.trim())
      return toast.error("SEO title and description are required.");
    if (form.defaultLowStockThreshold < 0)
      return toast.error("Low-stock default can't be negative.");

    update.mutate(
      {
        ...form,
        storeName: form.storeName.trim(),
        supportEmail: form.supportEmail.trim(),
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        supportPhone: form.supportPhone ? nullableText(form.supportPhone) : null,
        businessAddress: form.businessAddress ? nullableText(form.businessAddress) : null,
        instagramUrl: form.instagramUrl ? nullableText(form.instagramUrl) : null,
        twitterUrl: form.twitterUrl ? nullableText(form.twitterUrl) : null,
        youtubeUrl: form.youtubeUrl ? nullableText(form.youtubeUrl) : null,
        facebookUrl: form.facebookUrl ? nullableText(form.facebookUrl) : null,
        logoUrl: form.logoUrl ? nullableText(form.logoUrl) : null,
        ogImageUrl: form.ogImageUrl ? nullableText(form.ogImageUrl) : null,
      },
      {
        onSuccess: () => toast.success("Settings saved."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings."),
      },
    );
  };

  if (isLoading || !form) {
    return (
      <div className="space-y-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Settings</h1>
        <div className="glass rounded-2xl py-16 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The footer, legal pages, and page metadata all read from here — nothing about your store
            info is hardcoded anymore.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold disabled:opacity-60 shrink-0"
        >
          <Save className="h-4 w-4" /> {update.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <SettingsSection
        icon={Store}
        title="Store Identity"
        description="Shown across the site and in structured data / SEO."
      >
        <Field label="Store name" value={form.storeName} onChange={(v) => set("storeName", v)} />
        <Field
          label="Logo URL"
          value={form.logoUrl ?? ""}
          onChange={(v) => set("logoUrl", v)}
          placeholder="https://…"
        />
      </SettingsSection>

      <SettingsSection
        icon={Mail}
        title="Contact & Social"
        description="Powers the support link in the footer and the contact details on every legal page."
      >
        <Field
          label="Support email"
          value={form.supportEmail}
          onChange={(v) => set("supportEmail", v)}
          type="email"
        />
        <Field
          label="Support phone"
          value={form.supportPhone ?? ""}
          onChange={(v) => set("supportPhone", v)}
          placeholder="Not set"
        />
        <Field
          label="Business address"
          value={form.businessAddress ?? ""}
          onChange={(v) => set("businessAddress", v)}
          placeholder="Not set"
          full
        />
        <Field
          label="Instagram URL"
          value={form.instagramUrl ?? ""}
          onChange={(v) => set("instagramUrl", v)}
          placeholder="https://instagram.com/…"
        />
        <Field
          label="X (Twitter) URL"
          value={form.twitterUrl ?? ""}
          onChange={(v) => set("twitterUrl", v)}
          placeholder="https://x.com/…"
        />
        <Field
          label="YouTube URL"
          value={form.youtubeUrl ?? ""}
          onChange={(v) => set("youtubeUrl", v)}
          placeholder="https://youtube.com/…"
        />
        <Field
          label="Facebook URL"
          value={form.facebookUrl ?? ""}
          onChange={(v) => set("facebookUrl", v)}
          placeholder="https://facebook.com/…"
        />
      </SettingsSection>

      <SettingsSection
        icon={ShoppingBag}
        title="Commerce"
        description="Currency isn't listed here — the app is NGN throughout and isn't actually switchable, so a toggle for it wouldn't do anything."
      >
        <Field
          label="Default low-stock threshold"
          value={String(form.defaultLowStockThreshold)}
          onChange={(v) => set("defaultLowStockThreshold", Math.max(0, Math.round(Number(v) || 0)))}
          type="number"
          hint="Pre-fills this value when creating a new product. Doesn't change the threshold on existing products."
        />
      </SettingsSection>

      <SettingsSection
        icon={RotateCcw}
        title="Returns"
        description="The window customers can request a return in, counted from when an order is marked delivered. Shown live on the Returns Policy page and enforced server-side — not just display text."
      >
        <Field
          label="Return window (days)"
          value={String(form.returnWindowDays)}
          onChange={(v) => set("returnWindowDays", Math.max(1, Math.round(Number(v) || 1)))}
          type="number"
        />
      </SettingsSection>

      <SettingsSection
        icon={Search}
        title="SEO Defaults"
        description="Used for the homepage and any page without its own specific title/description (e.g. product pages fall back to this only if a product has none set)."
      >
        <Field label="Site title" value={form.seoTitle} onChange={(v) => set("seoTitle", v)} full />
        <Field
          label="Site description"
          value={form.seoDescription}
          onChange={(v) => set("seoDescription", v)}
          textarea
          full
        />
        <Field
          label="Social share image URL"
          value={form.ogImageUrl ?? ""}
          onChange={(v) => set("ogImageUrl", v)}
          placeholder="Not set — falls back to no og:image tag"
          full
        />
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
  full = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
  full?: boolean;
  hint?: string;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
        />
      )}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
