import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, X, ChevronDown, ChevronRight, Package } from "lucide-react";
import {
  PRODUCT_GROUPS,
  PRODUCT_TYPES,
  productTypeLabel,
  type Product,
  type ProductType,
  type ProductBadge,
} from "@/lib/products";
import {
  useAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type NewProductInput,
} from "@/lib/queries/products";
import { formatNGN } from "@/lib/currency";
import {
  DEFAULT_BOTTLES_PER_BOX,
  MAX_BOTTLES_PER_BOX,
  MIN_BOTTLES_PER_BOX,
  boxPricing,
  isValidBottlesPerBox,
  isValidBoxDiscount,
} from "@/lib/box";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ProductVariantsEditor } from "@/components/admin/ProductVariantsEditor";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products — Admin" }] }),
  component: ProductsPage,
});

const BADGES: ProductBadge[] = ["new", "limited", "hot", "sale"];
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type ProductFormState = {
  name: string;
  slug: string;
  producer: string;
  productType: ProductType;
  region: string;
  country: string;
  grapeVariety: string;
  vintage: string; // "" = non-vintage (NV)
  abv: string;
  price: string;
  // Box packaging: sellByBox off = bottles only. When on, customers can also buy a box.
  sellByBox: boolean;
  bottlesPerBox: string;
  boxDiscountPercent: string;
  oldPrice: string;
  stock: string;
  badge: ProductBadge | "";
  description: string;
  tastingNotes: string;
  foodPairing: string;
  appearance: string;
  nose: string;
  palate: string;
  finish: string;
  servingNotes: string;
  cellaringNotes: string;
  producerNotes: string;
  winemakingNotes: string;
  images: string;
  bottleSizes: string;
  active: boolean;
  sku: string;
  costPrice: string;
  lowStockThreshold: string;
  featured: boolean;
  tags: string;
  seoTitle: string;
  seoDescription: string;
};

const emptyForm: ProductFormState = {
  name: "",
  slug: "",
  producer: "",
  productType: "red",
  region: "",
  country: "",
  grapeVariety: "",
  vintage: "",
  abv: "",
  price: "",
  // New products offer a box of 6 by default (the usual case); the admin can change the
  // size, set a discount, or untick it for bottles-only.
  sellByBox: true,
  bottlesPerBox: String(DEFAULT_BOTTLES_PER_BOX),
  boxDiscountPercent: "0",
  oldPrice: "",
  stock: "50",
  badge: "",
  description: "",
  tastingNotes: "",
  foodPairing: "",
  appearance: "",
  nose: "",
  palate: "",
  finish: "",
  servingNotes: "",
  cellaringNotes: "",
  producerNotes: "",
  winemakingNotes: "",
  images: "",
  bottleSizes: "750ml",
  active: true,
  sku: "",
  costPrice: "",
  lowStockThreshold: "15",
  featured: false,
  tags: "",
  seoTitle: "",
  seoDescription: "",
};

function ProductsPage() {
  const { data: products = [], isLoading } = useAdminProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      producer: p.producer,
      productType: p.productType,
      region: p.region ?? "",
      country: p.country ?? "",
      grapeVariety: p.grapeVariety.join(", "),
      vintage: p.vintage ? String(p.vintage) : "",
      abv: p.abv != null ? String(p.abv) : "",
      price: String(p.price),
      // Editing keeps what is saved: a product that was never sold by the box stays that way
      // unless the admin ticks the box option.
      sellByBox: p.bottlesPerBox !== null,
      bottlesPerBox: String(p.bottlesPerBox ?? DEFAULT_BOTTLES_PER_BOX),
      boxDiscountPercent: String(p.boxDiscountPercent ?? 0),
      oldPrice: p.oldPrice ? String(p.oldPrice) : "",
      stock: String(p.stock),
      badge: p.badge ?? "",
      description: p.description,
      tastingNotes: p.tastingNotes ?? "",
      foodPairing: p.foodPairing ?? "",
      appearance: p.appearance ?? "",
      nose: p.nose ?? "",
      palate: p.palate ?? "",
      finish: p.finish ?? "",
      servingNotes: p.servingNotes ?? "",
      cellaringNotes: p.cellaringNotes ?? "",
      producerNotes: p.producerNotes ?? "",
      winemakingNotes: p.winemakingNotes ?? "",
      images: p.images.join("\n"),
      bottleSizes: p.bottleSizes.join(", "),
      active: p.active,
      sku: p.sku ?? "",
      costPrice: p.costPrice ? String(p.costPrice) : "",
      lowStockThreshold: String(p.lowStockThreshold),
      featured: p.featured,
      tags: p.tags.join(", "),
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    // Box packaging: validate here so the admin gets a clear message instead of a database
    // constraint error (the same ranges are enforced in the database).
    const bottlesPerBox = form.sellByBox ? Number(form.bottlesPerBox) : null;
    const boxDiscountPercent = form.sellByBox ? Number(form.boxDiscountPercent || 0) : 0;
    if (bottlesPerBox !== null && !isValidBottlesPerBox(bottlesPerBox)) {
      toast.error(
        `Bottles per box must be a whole number from ${MIN_BOTTLES_PER_BOX} to ${MAX_BOTTLES_PER_BOX}.`,
      );
      return;
    }
    if (!isValidBoxDiscount(boxDiscountPercent)) {
      toast.error("Box discount must be a percentage from 0 up to (but not including) 100.");
      return;
    }

    const input: NewProductInput = {
      name: form.name.trim(),
      slug: form.slug.trim() ? slugify(form.slug) : slugify(form.name),
      producer: form.producer.trim() || "Finkel Reserve",
      productType: form.productType,
      region: form.region.trim() || null,
      country: form.country.trim() || null,
      grapeVariety: form.grapeVariety
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      vintage: form.vintage.trim() ? Math.round(Number(form.vintage)) : null,
      abv: form.abv.trim() ? Number(form.abv) : null,
      price: Number(form.price) || 0,
      bottlesPerBox,
      boxDiscountPercent,
      oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined,
      stock: Math.max(0, Number(form.stock) || 0),
      badge: form.badge || undefined,
      description: form.description.trim(),
      tastingNotes: form.tastingNotes.trim() || null,
      foodPairing: form.foodPairing.trim() || null,
      appearance: form.appearance.trim() || null,
      nose: form.nose.trim() || null,
      palate: form.palate.trim() || null,
      finish: form.finish.trim() || null,
      servingNotes: form.servingNotes.trim() || null,
      cellaringNotes: form.cellaringNotes.trim() || null,
      producerNotes: form.producerNotes.trim() || null,
      winemakingNotes: form.winemakingNotes.trim() || null,
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      bottleSizes: form.bottleSizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      active: form.active,
      sku: form.sku.trim() || undefined,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 15),
      featured: form.featured,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      seoTitle: form.seoTitle.trim() || undefined,
      seoDescription: form.seoDescription.trim() || undefined,
    };
    if (!input.images.length)
      input.images = [
        "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=800&q=80",
      ];

    const onDone = () => {
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Product updated." : "Product created.");
    };
    const onErr = () => toast.error("Could not save the product.");
    if (editingId)
      updateProduct.mutate({ id: editingId, patch: input }, { onSuccess: onDone, onError: onErr });
    else createProduct.mutate(input, { onSuccess: onDone, onError: onErr });
  };

  const saving = createProduct.isPending || updateProduct.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={open ? () => setOpen(false) : startAdd}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold"
        >
          {open ? (
            <>
              <X className="h-4 w-4" /> Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add product
            </>
          )}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="glass rounded-2xl p-5 mb-6 space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-mono">
            — {editingId ? "Edit product" : "New product"}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <LabeledInput
              label="Name"
              required
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <LabeledInput
              label="Slug (optional — auto from name)"
              value={form.slug}
              onChange={(v) => setForm({ ...form, slug: v })}
            />
            <LabeledInput
              label="Producer / winery / distillery"
              value={form.producer}
              onChange={(v) => setForm({ ...form, producer: v })}
            />
            <Select
              label="Type"
              value={form.productType}
              onChange={(v) => setForm({ ...form, productType: v as ProductType })}
            >
              {PRODUCT_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {PRODUCT_TYPES.filter((w) => w.group === g.key).map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <LabeledInput
              label="Region (optional)"
              value={form.region}
              onChange={(v) => setForm({ ...form, region: v })}
            />
            <LabeledInput
              label="Country (optional)"
              value={form.country}
              onChange={(v) => setForm({ ...form, country: v })}
            />
            <LabeledInput
              label="Vintage / year (optional — blank = non-vintage)"
              type="number"
              value={form.vintage}
              onChange={(v) => setForm({ ...form, vintage: v })}
            />
            <LabeledInput
              label="ABV % (optional)"
              type="number"
              value={form.abv}
              onChange={(v) => setForm({ ...form, abv: v })}
            />
            <LabeledInput
              label="Price (₦)"
              type="number"
              required
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
            />
            <LabeledInput
              label="Compare-at price (₦, optional)"
              type="number"
              value={form.oldPrice}
              onChange={(v) => setForm({ ...form, oldPrice: v })}
            />
            <LabeledInput
              label="Starting stock (new products only)"
              type="number"
              required
              value={form.stock}
              onChange={(v) => setForm({ ...form, stock: v })}
            />
            <Select
              label="Badge"
              value={form.badge}
              onChange={(v) => setForm({ ...form, badge: v as ProductBadge | "" })}
            >
              <option value="">None</option>
              {BADGES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>

          <BoxPackagingSection form={form} setForm={setForm} />

          <LabeledInput
            label="Grape variety or key ingredients (comma-separated — e.g. Merlot, or Malted barley)"
            value={form.grapeVariety}
            onChange={(v) => setForm({ ...form, grapeVariety: v })}
          />
          <LabeledInput
            label="Bottle sizes (comma-separated — e.g. 750ml, 1.5L, 700ml)"
            value={form.bottleSizes}
            onChange={(v) => setForm({ ...form, bottleSizes: v })}
          />
          <TextArea
            label="Description"
            rows={2}
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextArea
              label="Tasting notes (optional)"
              rows={2}
              value={form.tastingNotes}
              onChange={(v) => setForm({ ...form, tastingNotes: v })}
            />
            <TextArea
              label="Food pairing (optional)"
              rows={2}
              value={form.foodPairing}
              onChange={(v) => setForm({ ...form, foodPairing: v })}
            />
          </div>
          <div className="pt-1 border-t border-border/40">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-mono mb-1 mt-4">
              — Tasting profile (shown on the product page)
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              All optional — the page shows only what you fill in. Write from the producer's own
              information or your own tasting; don't paste another retailer's copy.
            </p>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <TextArea
                  label="Appearance (colour, clarity)"
                  rows={2}
                  value={form.appearance}
                  onChange={(v) => setForm({ ...form, appearance: v })}
                />
                <TextArea
                  label="Nose (aromas)"
                  rows={2}
                  value={form.nose}
                  onChange={(v) => setForm({ ...form, nose: v })}
                />
                <TextArea
                  label="Palate (taste, body, structure)"
                  rows={2}
                  value={form.palate}
                  onChange={(v) => setForm({ ...form, palate: v })}
                />
                <TextArea
                  label="Finish (length, aftertaste)"
                  rows={2}
                  value={form.finish}
                  onChange={(v) => setForm({ ...form, finish: v })}
                />
              </div>
              <TextArea
                label="Serving (temperature, decanting, glassware)"
                rows={2}
                value={form.servingNotes}
                onChange={(v) => setForm({ ...form, servingNotes: v })}
              />
              <TextArea
                label="Cellaring (drink now or keep?)"
                rows={2}
                value={form.cellaringNotes}
                onChange={(v) => setForm({ ...form, cellaringNotes: v })}
              />
              <TextArea
                label="About the producer"
                rows={3}
                value={form.producerNotes}
                onChange={(v) => setForm({ ...form, producerNotes: v })}
              />
              <TextArea
                label="How it's made (vineyard or distillery, fermentation, ageing)"
                rows={3}
                value={form.winemakingNotes}
                onChange={(v) => setForm({ ...form, winemakingNotes: v })}
              />
            </div>
          </div>
          <TextArea
            label="Image URLs (one per line)"
            rows={2}
            mono
            placeholder="https://…"
            value={form.images}
            onChange={(v) => setForm({ ...form, images: v })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-primary h-4 w-4"
            />
            Visible on the storefront
          </label>

          <div className="pt-1 border-t border-border/40">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-mono mb-3 mt-4">
              — Inventory & merchandising
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <LabeledInput
                label="SKU (optional)"
                value={form.sku}
                onChange={(v) => setForm({ ...form, sku: v })}
              />
              <LabeledInput
                label="Cost price (₦, optional)"
                type="number"
                value={form.costPrice}
                onChange={(v) => setForm({ ...form, costPrice: v })}
              />
              <LabeledInput
                label="Low-stock threshold"
                type="number"
                value={form.lowStockThreshold}
                onChange={(v) => setForm({ ...form, lowStockThreshold: v })}
              />
              <LabeledInput
                label="Tags (comma-separated)"
                value={form.tags}
                onChange={(v) => setForm({ ...form, tags: v })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="accent-primary h-4 w-4"
              />
              Feature on the homepage
            </label>
          </div>

          <div className="pt-1 border-t border-border/40">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-mono mb-3 mt-4">
              — SEO
            </p>
            <LabeledInput
              label="SEO title (optional)"
              value={form.seoTitle}
              onChange={(v) => setForm({ ...form, seoTitle: v })}
            />
            <div className="mt-3">
              <TextArea
                label="SEO description (optional)"
                rows={2}
                value={form.seoDescription}
                onChange={(v) => setForm({ ...form, seoDescription: v })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto glass rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No products yet — add your first one above.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-b border-border/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.images[0]}
                          alt=""
                          className="h-10 w-9 object-cover rounded-md shrink-0"
                        />
                        <span className="font-semibold truncate max-w-[220px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {productTypeLabel(p.productType)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatNGN(p.price)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedStock(expandedStock === p.id ? null : p.id)}
                        className={`inline-flex items-center gap-1 hover:text-primary ${
                          p.stock === 0
                            ? "text-destructive font-bold"
                            : p.stock < p.lowStockThreshold
                              ? "text-primary font-bold"
                              : ""
                        }`}
                        title="Show stock by bottle size"
                      >
                        {expandedStock === p.id ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {p.stock}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          updateProduct.mutate(
                            { id: p.id, patch: { active: !p.active } },
                            { onError: () => toast.error("Could not update visibility.") },
                          )
                        }
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${p.active ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"}`}
                      >
                        {p.active ? "Live" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:bg-primary hover:text-primary-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedStock === p.id && (
                    <tr className="border-b border-border/40 bg-surface-2/20">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                          Stock by bottle size
                        </p>
                        <ProductVariantsEditor productId={p.id} bottlesPerBox={p.bottlesPerBox} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This removes the product and its tracked bottle sizes. This can't be undone."
        confirmLabel="Delete product"
        loading={deleteProduct.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProduct.mutate(deleteTarget.id, {
            onSuccess: () => toast.success("Product deleted."),
            onError: () => toast.error("Could not delete the product."),
            onSettled: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}

// "Also sell by the box": the box size and discount are properties of the PRODUCT, set here
// when filling it in. The price above stays the price of ONE bottle; the preview shows what a
// customer would pay for a box, using the same function the storefront and checkout use.
function BoxPackagingSection({
  form,
  setForm,
}: {
  form: ProductFormState;
  setForm: (f: ProductFormState) => void;
}) {
  const bottlePrice = Number(form.price) || 0;
  const perBox = Number(form.bottlesPerBox);
  const discount = Number(form.boxDiscountPercent || 0);
  const valid = isValidBottlesPerBox(perBox) && isValidBoxDiscount(discount);
  const pricing = valid && bottlePrice > 0 ? boxPricing(bottlePrice, perBox, discount) : null;

  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/30 p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.sellByBox}
          onChange={(e) => setForm({ ...form, sellByBox: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Package className="h-4 w-4 text-primary" /> Also sell by the box
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Customers can buy a whole box instead of single bottles, at a discount you set. The
            price above stays the price of one bottle.
          </span>
        </span>
      </label>

      {form.sellByBox && (
        <div className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <LabeledInput
              label={`Bottles per box (${MIN_BOTTLES_PER_BOX}–${MAX_BOTTLES_PER_BOX}, usually ${DEFAULT_BOTTLES_PER_BOX})`}
              type="number"
              required
              value={form.bottlesPerBox}
              onChange={(v) => setForm({ ...form, bottlesPerBox: v })}
            />
            <LabeledInput
              label="Box discount (%) — off the price of those bottles"
              type="number"
              value={form.boxDiscountPercent}
              onChange={(v) => setForm({ ...form, boxDiscountPercent: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {pricing ? (
              <>
                A box of {perBox} costs{" "}
                <strong className="text-foreground">{formatNGN(pricing.price)}</strong> (
                {formatNGN(Math.round(pricing.perBottle))} a bottle)
                {pricing.saving > 0 ? (
                  <>
                    {" "}
                    — customers save {formatNGN(pricing.saving)} ({pricing.percent}%) compared with{" "}
                    {perBox} single bottles at {formatNGN(pricing.regular)}.
                  </>
                ) : (
                  <> — no discount, the same as {perBox} single bottles.</>
                )}
              </>
            ) : bottlePrice > 0 ? (
              "Enter a whole number of bottles and a discount between 0 and 99.99 to see the box price."
            ) : (
              "Enter the bottle price above to see the box price."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-input rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-input rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary capitalize"
      >
        {children}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 2,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`mt-1 w-full bg-input rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary resize-none ${mono ? "font-mono text-xs" : ""}`}
      />
    </div>
  );
}
