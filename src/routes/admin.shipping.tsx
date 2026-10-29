import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Truck, Plus, Pencil, Trash2, MapPin, Package } from "lucide-react";
import {
  useAdminShippingZones,
  useAdminShippingRates,
  useToggleShippingZoneActive,
  useDeleteShippingZone,
  useToggleShippingRateActive,
  useDeleteShippingRate,
  type ShippingZone,
  type ShippingRate,
} from "@/lib/queries/shipping";
import { formatNGN } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ShippingZoneFormDialog } from "@/components/admin/ShippingZoneFormDialog";
import { ShippingRateFormDialog } from "@/components/admin/ShippingRateFormDialog";

export const Route = createFileRoute("/admin/shipping")({
  head: () => ({ meta: [{ title: "Shipping — Admin" }] }),
  component: ShippingPage,
});

function ratePriceLabel(rate: ShippingRate): string {
  return rate.priceNgn === 0 ? "Free" : formatNGN(rate.priceNgn);
}

function ShippingPage() {
  const { data: zones = [], isLoading: zonesLoading } = useAdminShippingZones();
  const { data: rates = [], isLoading: ratesLoading } = useAdminShippingRates();
  const toggleZoneActive = useToggleShippingZoneActive();
  const deleteZone = useDeleteShippingZone();
  const toggleRateActive = useToggleShippingRateActive();
  const deleteRate = useDeleteShippingRate();

  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [deleteZoneTarget, setDeleteZoneTarget] = useState<ShippingZone | null>(null);

  const [rateFormOpen, setRateFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [rateFormDefaultZoneId, setRateFormDefaultZoneId] = useState("");
  const [deleteRateTarget, setDeleteRateTarget] = useState<ShippingRate | null>(null);

  const loading = zonesLoading || ratesLoading;

  const ratesByZone = useMemo(() => {
    const map = new Map<string, ShippingRate[]>();
    for (const rate of rates) {
      const list = map.get(rate.zoneId) ?? [];
      list.push(rate);
      map.set(rate.zoneId, list);
    }
    return map;
  }, [rates]);

  const takenStates = useMemo(() => {
    const set = new Set<string>();
    for (const z of zones) {
      if (editingZone?.id === z.id) continue; // a zone editing itself doesn't conflict with its own states
      for (const s of z.states) set.add(s);
    }
    return set;
  }, [zones, editingZone]);

  const stats = useMemo(
    () => ({
      zones: zones.length,
      activeZones: zones.filter((z) => z.active).length,
      rates: rates.length,
      uncoveredStates: 37 - new Set(zones.flatMap((z) => z.states)).size,
    }),
    [zones, rates],
  );

  const openCreateZone = () => {
    setEditingZone(null);
    setZoneFormOpen(true);
  };
  const openEditZone = (z: ShippingZone) => {
    setEditingZone(z);
    setZoneFormOpen(true);
  };
  const openCreateRate = (zoneId: string) => {
    setEditingRate(null);
    setRateFormDefaultZoneId(zoneId);
    setRateFormOpen(true);
  };
  const openEditRate = (r: ShippingRate) => {
    setEditingRate(r);
    setRateFormDefaultZoneId(r.zoneId);
    setRateFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Shipping
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zones and rates checkout reads directly — nothing here is duplicated in code.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => openCreateRate(zones[0]?.id ?? "")}
            disabled={zones.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> New Rate
          </button>
          <button
            onClick={openCreateZone}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
          >
            <Plus className="h-4 w-4" /> New Zone
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<MapPin className="h-4 w-4" />} label="Zones" value={String(stats.zones)} />
        <StatCard
          icon={<MapPin className="h-4 w-4" />}
          label="Active Zones"
          value={String(stats.activeZones)}
        />
        <StatCard icon={<Truck className="h-4 w-4" />} label="Rates" value={String(stats.rates)} />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="States Uncovered"
          value={String(Math.max(0, stats.uncoveredStates))}
        />
      </div>

      {loading && (
        <div className="glass rounded-2xl py-16 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!loading && zones.length === 0 && (
        <EmptyState
          icon={Truck}
          title="No shipping zones yet"
          description="Create a zone (a group of states) and give it at least one rate — checkout won't show a delivery option until then."
          action={
            <button
              onClick={openCreateZone}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
            >
              <Plus className="h-4 w-4" /> New Zone
            </button>
          }
        />
      )}

      {!loading && zones.length > 0 && (
        <div className="space-y-4">
          {zones.map((zone) => {
            const zoneRates = ratesByZone.get(zone.id) ?? [];
            return (
              <div key={zone.id} className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold">{zone.name}</p>
                      <StatusBadge
                        label={zone.active ? "Active" : "Inactive"}
                        tone={zone.active ? "success" : "neutral"}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {zone.states.length === 37
                        ? "All of Nigeria"
                        : `${zone.states.length} state${zone.states.length === 1 ? "" : "s"}: ${zone.states.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openCreateRate(zone.id)}
                      className="text-xs font-bold text-primary hover:underline px-2"
                    >
                      + Rate
                    </button>
                    <button
                      onClick={() =>
                        toggleZoneActive.mutate(
                          { id: zone.id, active: !zone.active },
                          {
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                          },
                        )
                      }
                      className="text-xs font-medium text-muted-foreground hover:text-foreground px-2"
                    >
                      {zone.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => openEditZone(zone)}
                      className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteZoneTarget(zone)}
                      className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {zoneRates.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    No rates yet — this zone won't show a delivery option at checkout until one is
                    added.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {zoneRates.map((rate) => (
                      <div
                        key={rate.id}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{rate.name}</p>
                            {!rate.active && <StatusBadge label="Inactive" tone="neutral" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rate.estimatedDaysMin === rate.estimatedDaysMax
                              ? `${rate.estimatedDaysMin} day${rate.estimatedDaysMin === 1 ? "" : "s"}`
                              : `${rate.estimatedDaysMin}–${rate.estimatedDaysMax} days`}
                            {rate.freeShippingThresholdNgn != null &&
                              ` · free above ${formatNGN(rate.freeShippingThresholdNgn)}`}
                            {rate.minOrderNgn != null &&
                              ` · min order ${formatNGN(rate.minOrderNgn)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold">{ratePriceLabel(rate)}</span>
                          <button
                            onClick={() =>
                              toggleRateActive.mutate(
                                { id: rate.id, active: !rate.active },
                                {
                                  onError: (e) =>
                                    toast.error(e instanceof Error ? e.message : "Failed"),
                                },
                              )
                            }
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            {rate.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => openEditRate(rate)}
                            className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteRateTarget(rate)}
                            className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ShippingZoneFormDialog
        open={zoneFormOpen}
        onOpenChange={setZoneFormOpen}
        editing={editingZone}
        takenStates={takenStates}
      />
      <ShippingRateFormDialog
        open={rateFormOpen}
        onOpenChange={setRateFormOpen}
        editing={editingRate}
        zones={zones}
        defaultZoneId={rateFormDefaultZoneId}
      />

      <ConfirmDialog
        open={!!deleteZoneTarget}
        onOpenChange={(open) => !open && setDeleteZoneTarget(null)}
        title="Delete this zone?"
        description={`This deletes "${deleteZoneTarget?.name}" and all ${ratesByZone.get(deleteZoneTarget?.id ?? "")?.length ?? 0} of its rates. Customers in these states won't see a delivery option until they're reassigned to another zone. This can't be undone.`}
        confirmLabel="Delete Zone"
        loading={deleteZone.isPending}
        onConfirm={() => {
          if (!deleteZoneTarget) return;
          deleteZone.mutate(deleteZoneTarget.id, {
            onSuccess: () => {
              toast.success("Zone deleted.");
              setDeleteZoneTarget(null);
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete zone."),
          });
        }}
      />

      <ConfirmDialog
        open={!!deleteRateTarget}
        onOpenChange={(open) => !open && setDeleteRateTarget(null)}
        title="Delete this rate?"
        description={`This removes "${deleteRateTarget?.name}" as a delivery option. Orders that already used it keep their history — this only stops it being offered going forward.`}
        confirmLabel="Delete Rate"
        loading={deleteRate.isPending}
        onConfirm={() => {
          if (!deleteRateTarget) return;
          deleteRate.mutate(deleteRateTarget.id, {
            onSuccess: () => {
              toast.success("Rate deleted.");
              setDeleteRateTarget(null);
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete rate."),
          });
        }}
      />
    </div>
  );
}
