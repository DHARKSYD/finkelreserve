import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// types.ts hasn't been regenerated against live Supabase to include this
// table yet — same outstanding item tracked across every recent migration
// (see the audit doc; grep "documented types.ts gap" once it's regenerated).
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "store_settings") => any;
};

export type StoreSettings = {
  storeName: string;
  logoUrl: string | null;
  supportEmail: string;
  supportPhone: string | null;
  businessAddress: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  defaultLowStockThreshold: number;
  returnWindowDays: number;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
  updatedAt: number;
};

interface StoreSettingsRow {
  store_name: string;
  logo_url: string | null;
  support_email: string;
  support_phone: string | null;
  business_address: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  default_low_stock_threshold: number;
  return_window_days: number;
  seo_title: string;
  seo_description: string;
  og_image_url: string | null;
  updated_at: string;
}

function mapSettings(row: StoreSettingsRow): StoreSettings {
  return {
    storeName: row.store_name,
    logoUrl: row.logo_url,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    businessAddress: row.business_address,
    instagramUrl: row.instagram_url,
    twitterUrl: row.twitter_url,
    youtubeUrl: row.youtube_url,
    facebookUrl: row.facebook_url,
    defaultLowStockThreshold: row.default_low_stock_threshold,
    returnWindowDays: row.return_window_days,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    ogImageUrl: row.og_image_url,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/**
 * Readable by anyone — RLS allows public SELECT since nothing sensitive
 * lives in this table. Unlike shipping, that means this doesn't need a
 * server-function detour: the same query works from a route loader (SSR,
 * via queryClient.ensureQueryData(settingsQueryOptions())) or a component
 * (useSettings()) against the regular anon-key client either way.
 */
async function fetchSettings(): Promise<StoreSettings> {
  const { data, error } = await db.from("store_settings").select("*").eq("id", true).single();
  if (error) throwSafe(error, "Could not load store settings.");
  return mapSettings(data as StoreSettingsRow);
}

export const settingsQueryOptions = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });

export const useSettings = () => useQuery(settingsQueryOptions());

export type StoreSettingsInput = {
  storeName: string;
  logoUrl: string | null;
  supportEmail: string;
  supportPhone: string | null;
  businessAddress: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  defaultLowStockThreshold: number;
  returnWindowDays: number;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
};

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StoreSettingsInput) => {
      const { error } = await db
        .from("store_settings")
        .update({
          store_name: input.storeName,
          logo_url: input.logoUrl,
          support_email: input.supportEmail,
          support_phone: input.supportPhone,
          business_address: input.businessAddress,
          instagram_url: input.instagramUrl,
          twitter_url: input.twitterUrl,
          youtube_url: input.youtubeUrl,
          facebook_url: input.facebookUrl,
          default_low_stock_threshold: input.defaultLowStockThreshold,
          return_window_days: input.returnWindowDays,
          seo_title: input.seoTitle,
          seo_description: input.seoDescription,
          og_image_url: input.ogImageUrl,
        })
        .eq("id", true);
      if (error) throwSafe(error, "Could not save settings.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
};
