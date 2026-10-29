import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { sizeWithUnit } from "@/lib/box";
import { Layout } from "@/components/Layout";
import { useCart, cartKey } from "@/lib/store";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  Truck,
  CreditCard,
  AlertCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatNGN } from "@/lib/currency";
import { useValidateCoupon } from "@/lib/queries/coupons";
import { placeOrder } from "@/lib/actions/checkout";
import { getNotificationOptions } from "@/lib/actions/delivery";
import { normalizeNgMobile } from "@/lib/phone";
import { getShippingOptions, type ShippingOption } from "@/lib/actions/shipping";
import { formatDeliveryEstimate } from "@/lib/queries/shipping";
import { initializePaystackPayment } from "@/lib/actions/paystack";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import { useAuth } from "@/hooks/use-auth";
import { useMyAddresses, useCreateAddress } from "@/lib/queries/addresses";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Finkel Reserve" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    freeShipping: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    deliveryInstructions: "",
  });
  const [payment, setPayment] = useState<"delivery" | "paystack">("delivery");
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  // "Order updates" consent. Email is order-related (not marketing) so it starts ticked; texts are
  // opt-in and only offered when this deployment can actually send them (see notify-server.ts).
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const notificationOptions = useQuery({
    queryKey: ["notification-options"],
    queryFn: () => getNotificationOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const smsOffered = notificationOptions.data?.sms === true;
  const phoneCanReceiveSms = normalizeNgMobile(form.phone) !== null;

  const { user } = useAuth();
  const { data: savedAddresses = [] } = useMyAddresses();
  const createAddress = useCreateAddress();

  // First saved address auto-selected on load; email pre-filled from the
  // account either way, since it's the customer's own regardless of which
  // delivery address they pick.
  useEffect(() => {
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email! }));
  }, [user]);

  // Only ever touches state setters (all stable across renders), so this
  // can safely be a dependency without the effect below re-running every
  // render the way a plain function redeclaration would cause.
  const applyAddress = useCallback((addr: (typeof savedAddresses)[number]) => {
    setSelectedAddressId(addr.id);
    setForm((f) => ({
      ...f,
      name: addr.recipientName,
      phone: addr.phone,
      addressLine: addr.addressLine,
      city: addr.city,
      state: addr.state,
      deliveryInstructions: addr.deliveryInstructions ?? "",
    }));
    setSelectedRateId(null);
  }, []);

  useEffect(() => {
    if (selectedAddressId !== null) return;
    const defaultAddr = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (defaultAddr) applyAddress(defaultAddr);
  }, [savedAddresses, selectedAddressId, applyAddress]);

  const validateCoupon = useValidateCoupon();

  const sub = subtotal();
  const discount = appliedCoupon?.discount ?? 0;

  const shippingOptions = useQuery({
    queryKey: ["shipping-options", form.state, sub],
    queryFn: () => getShippingOptions({ data: { state: form.state, subtotalNgn: sub } }),
    enabled: form.state.length > 0,
    staleTime: 15_000,
  });

  // Keep the selection valid as options change (state picked, subtotal moved
  // a rate across its free-shipping threshold, etc.) — auto-pick when there's
  // exactly one option so the common case needs no extra click, but never
  // silently keep a selection that's no longer in the list.
  useEffect(() => {
    const options = shippingOptions.data;
    if (!options) return;
    if (selectedRateId && options.some((o) => o.rateId === selectedRateId)) return;
    setSelectedRateId(options.length > 0 ? options[0].rateId : null);
  }, [shippingOptions.data, selectedRateId]);

  const selectedOption = shippingOptions.data?.find((o) => o.rateId === selectedRateId) ?? null;
  const shipping = appliedCoupon?.freeShipping ? 0 : (selectedOption?.priceNgn ?? 0);
  const total = sub - discount + shipping;

  const applyCoupon = () => {
    if (!code.trim() || validateCoupon.isPending) return;
    setCouponError(null);
    validateCoupon.mutate(
      {
        code,
        // Server prices each line (incl. the box discount) from the DB — we only say what is in the bag.
        items: items.map((i) => ({
          productId: i.productId,
          size: i.size,
          unit: i.unit,
          qty: i.qty,
        })),
        customerEmail: form.email || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.valid) {
            setAppliedCoupon({
              code: result.code,
              discount: result.discount,
              freeShipping: result.freeShipping,
            });
            setCouponError(null);
          } else {
            setAppliedCoupon(null);
            setCouponError(result.error);
          }
        },
        onError: () => {
          setAppliedCoupon(null);
          setCouponError("Could not check that code — please try again.");
        },
      },
    );
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCode("");
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRateId) throw new Error("Please choose a shipping option.");
      const result = await placeOrder({
        data: {
          items: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            unit: i.unit,
            qty: i.qty,
          })),
          customer: form,
          shippingRateId: selectedRateId,
          promoCode: appliedCoupon ? appliedCoupon.code : undefined,
          paymentMethod: payment,
          notifications: { email: notifyEmail, sms: smsOffered && notifySms && phoneCanReceiveSms },
        },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async (result) => {
      clear(); // the order now exists server-side — don't let a resubmit double it up

      // Non-blocking: a failed address save shouldn't undo or interrupt an
      // order that already succeeded. Only fires for a genuinely new
      // address — re-selecting an existing saved one never shows the
      // checkbox, so this can't create duplicates.
      if (user && saveAddress && selectedAddressId === "new") {
        createAddress.mutate({
          input: {
            recipientName: form.name,
            phone: form.phone,
            addressLine: form.addressLine,
            city: form.city,
            state: form.state,
            deliveryInstructions: form.deliveryInstructions.trim() || null,
            isDefault: savedAddresses.length === 0,
          },
          customerId: user.id,
        });
      }

      if (result.paymentMethod === "delivery") {
        navigate({ to: "/order-confirmation/$id", params: { id: result.orderId } });
        return;
      }

      const init = await initializePaystackPayment({
        data: {
          orderId: result.orderId,
          callbackUrl: `${window.location.origin}/order-confirmation/${result.orderId}`,
        },
      });
      if (init.ok) {
        window.location.href = init.authorizationUrl;
      } else {
        // Order exists (payment_status: pending) — let them retry from the confirmation page.
        navigate({ to: "/order-confirmation/$id", params: { id: result.orderId } });
      }
    },
  });

  return (
    <Layout>
      <div className="pt-32" />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Checkout</p>
        <h1 className="mt-2 font-display font-black text-5xl md:text-6xl tracking-tighter">
          Your Bag
        </h1>

        {items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-20 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-surface-2 grid place-items-center mb-5">
              <ShoppingBag className="h-9 w-9 text-muted-foreground" />
            </div>
            <h2 className="font-display font-bold text-2xl">Nothing here yet</h2>
            <p className="text-muted-foreground mt-2">Time to grab something fresh.</p>
            <Link
              to="/shop"
              className="mt-6 inline-block rounded-full bg-primary text-primary-foreground px-7 py-3 font-bold"
            >
              Shop the range
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid lg:grid-cols-[1fr_420px] gap-10">
            <div className="space-y-3">
              {items.map((i) => {
                const k = cartKey(i);
                return (
                  <div key={k} className="glass rounded-2xl p-4 flex gap-4">
                    <img src={i.image} alt={i.name} className="h-32 w-28 object-cover rounded-xl" />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-display font-bold text-lg leading-tight">{i.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {sizeWithUnit(i.size, i.unit, i.bottlesPerUnit)}
                          </p>
                        </div>
                        <p className="font-display font-black text-xl">
                          {formatNGN(i.price * i.qty)}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center bg-surface-2 rounded-full p-1">
                          <button
                            onClick={() => setQty(k, i.qty - 1)}
                            className="h-7 w-7 grid place-items-center rounded-full hover:bg-background"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold">{i.qty}</span>
                          <button
                            onClick={() => setQty(k, i.qty + 1)}
                            className="h-7 w-7 grid place-items-center rounded-full hover:bg-background"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => remove(k)}
                          className="text-muted-foreground hover:text-destructive text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="glass rounded-2xl p-6 space-y-5">
                <h3 className="font-display font-black text-xl">Order summary</h3>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-mono font-bold">{appliedCoupon.code}</span>
                      <span className="text-muted-foreground">applied</span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove coupon"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-surface-2 rounded-full px-4">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          if (couponError) setCouponError(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                        placeholder="Promo code"
                        className="flex-1 bg-transparent py-3 text-sm outline-none"
                      />
                    </div>
                    <button
                      onClick={applyCoupon}
                      disabled={!code.trim() || validateCoupon.isPending}
                      className="rounded-full bg-secondary px-4 text-sm font-bold disabled:opacity-50"
                    >
                      {validateCoupon.isPending ? "Checking…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {couponError}
                  </p>
                )}

                <div className="space-y-2 text-sm border-t border-border pt-4">
                  <Row label="Subtotal" value={formatNGN(sub)} />
                  {appliedCoupon && discount > 0 && (
                    <Row label="Discount" value={`-${formatNGN(discount)}`} positive />
                  )}
                  <Row label="Shipping" value={shipping === 0 ? "Free" : formatNGN(shipping)} />
                </div>
                <div className="border-t border-border pt-4 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display font-black text-3xl">{formatNGN(total)}</span>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Delivery details
                  </p>

                  {user && savedAddresses.length > 0 && (
                    <div className="space-y-1.5 pb-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => applyAddress(addr)}
                          className={`w-full text-left rounded-xl border p-2.5 text-xs transition ${selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                        >
                          <span className="font-semibold">{addr.recipientName}</span>
                          {addr.isDefault && (
                            <span className="ml-1.5 text-primary font-bold">· Default</span>
                          )}
                          <p className="text-muted-foreground truncate">
                            {addr.addressLine}, {addr.city}, {addr.state}
                          </p>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAddressId("new");
                          setForm((f) => ({
                            ...f,
                            name: "",
                            phone: "",
                            addressLine: "",
                            city: "",
                            state: "",
                            deliveryInstructions: "",
                          }));
                          setSelectedRateId(null);
                        }}
                        className={`w-full text-left rounded-xl border p-2.5 text-xs font-semibold transition ${selectedAddressId === "new" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                      >
                        + Enter a new address
                      </button>
                    </div>
                  )}

                  <Field
                    placeholder="Full name"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                  />
                  <Field
                    placeholder="Email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                  />
                  <Field
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                  <Field
                    placeholder="Delivery address"
                    value={form.addressLine}
                    onChange={(v) => setForm({ ...form, addressLine: v })}
                  />
                  <Field
                    placeholder="City"
                    value={form.city}
                    onChange={(v) => setForm({ ...form, city: v })}
                  />
                  <select
                    value={form.state}
                    onChange={(e) => {
                      setForm({ ...form, state: e.target.value });
                      setSelectedRateId(null); // force re-pick against the new state's options
                    }}
                    className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary text-foreground"
                  >
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Field
                    placeholder="Delivery instructions (optional) — gate code, landmark, etc."
                    value={form.deliveryInstructions}
                    onChange={(v) => setForm({ ...form, deliveryInstructions: v })}
                  />

                  {user && (!selectedAddressId || selectedAddressId === "new") && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                      />
                      Save this address for next time
                    </label>
                  )}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Order updates
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                    />
                    <span>
                      Email me about this order
                      <span className="block text-xs text-muted-foreground">
                        Confirmation, when it's on its way, and when it's delivered — sent to{" "}
                        {form.email || "your email"}. Order updates only, never marketing.
                      </span>
                    </span>
                  </label>
                  {smsOffered && (
                    <label
                      className={`flex items-start gap-2 text-sm ${phoneCanReceiveSms ? "" : "opacity-60"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={notifySms && phoneCanReceiveSms}
                        disabled={!phoneCanReceiveSms}
                        onChange={(e) => setNotifySms(e.target.checked)}
                      />
                      <span>
                        Text me delivery updates
                        <span className="block text-xs text-muted-foreground">
                          {phoneCanReceiveSms
                            ? `A short SMS to ${form.phone} when your order is confirmed, on its way and delivered.`
                            : "Add a Nigerian mobile number above to get texts."}
                        </span>
                      </span>
                    </label>
                  )}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Shipping method
                  </p>
                  {!form.state && (
                    <p className="text-xs text-muted-foreground">
                      Choose a state above to see delivery options.
                    </p>
                  )}
                  {form.state && shippingOptions.isLoading && (
                    <p className="text-xs text-muted-foreground">Loading delivery options…</p>
                  )}
                  {form.state && shippingOptions.isError && (
                    <p className="text-xs text-destructive">
                      Couldn't load delivery options. Please try again.
                    </p>
                  )}
                  {form.state &&
                    !shippingOptions.isLoading &&
                    !shippingOptions.isError &&
                    (shippingOptions.data?.length ?? 0) === 0 && (
                      <p className="text-xs text-destructive">
                        We don't currently deliver to {form.state}. Contact us if that's unexpected.
                      </p>
                    )}
                  {shippingOptions.data?.map((option: ShippingOption) => (
                    <ShippingOptionRow
                      key={option.rateId}
                      option={option}
                      active={selectedRateId === option.rateId}
                      onClick={() => setSelectedRateId(option.rateId)}
                    />
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Payment
                  </p>
                  <PaymentOption
                    icon={Truck}
                    label="Pay on delivery"
                    desc="Cash or transfer when your order arrives"
                    active={payment === "delivery"}
                    onClick={() => setPayment("delivery")}
                  />
                  <PaymentOption
                    icon={CreditCard}
                    label="Pay online"
                    desc="Card, bank, or USSD via Paystack"
                    active={payment === "paystack"}
                    onClick={() => setPayment("paystack")}
                  />
                </div>

                {checkoutMutation.isError && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 text-destructive text-xs p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {checkoutMutation.error instanceof Error
                        ? checkoutMutation.error.message
                        : "Something went wrong. Please try again."}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => checkoutMutation.mutate()}
                  disabled={
                    !form.name ||
                    !form.email ||
                    !form.addressLine ||
                    !form.city ||
                    !form.state ||
                    !selectedRateId ||
                    checkoutMutation.isPending
                  }
                  className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkoutMutation.isPending ? "Placing order…" : "Place order"}
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Secure checkout · Pay on delivery available
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={positive ? "text-primary font-semibold" : ""}>{value}</span>
    </div>
  );
}

function Field({
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
    />
  );
}

function ShippingOptionRow({
  option,
  active,
  onClick,
}: {
  option: ShippingOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{option.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatDeliveryEstimate(option.estimatedDaysMin, option.estimatedDaysMax)}
        </p>
      </div>
      <span className="text-sm font-semibold shrink-0">
        {option.priceNgn === 0 ? (
          <span className="text-primary">Free</span>
        ) : (
          formatNGN(option.priceNgn)
        )}
      </span>
    </button>
  );
}

function PaymentOption({
  icon: Icon,
  label,
  desc,
  active,
  onClick,
}: {
  icon: typeof Truck;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <div
        className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
      </div>
    </button>
  );
}
