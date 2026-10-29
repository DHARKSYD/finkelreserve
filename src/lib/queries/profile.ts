import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// profiles.phone isn't in generated types.ts yet — documented types.ts gap,
// same as every other recent migration (see the audit doc). Everything else
// on this table (id, display_name, avatar_url) already was typed.
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "profiles") => any;
};

export type Profile = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export const useMyProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await db
        .from("profiles")
        .select("display_name, phone, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) throwSafe(error, "Could not load your profile.");
      return {
        displayName: data?.display_name ?? null,
        phone: data?.phone ?? null,
        avatarUrl: data?.avatar_url ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      displayName,
      phone,
    }: {
      userId: string;
      displayName: string;
      phone: string;
    }) => {
      const { error } = await db
        .from("profiles")
        .update({ display_name: displayName, phone: phone || null })
        .eq("id", userId);
      if (error) throwSafe(error, "Could not update your profile.");
    },
    onSuccess: (_, { userId }) => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const useUpdateAvatar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        throw new Error("Please choose a JPG, PNG, or WEBP image.");
      }
      if (file.size > MAX_AVATAR_BYTES) {
        throw new Error("Image must be under 5MB.");
      }

      // Fixed filename per user (not the original name) + upsert: re-uploading
      // replaces the old file at the same path instead of accumulating
      // orphaned avatars over time. Path starts with the user's own ID,
      // which is exactly what the storage policies require for a write.
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throwSafe(uploadError, "Could not upload this image.");

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust: the URL itself doesn't change on re-upload (fixed
      // filename), so without this the browser/CDN would keep showing the
      // old cached image after a real update.
      const bustedUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await db
        .from("profiles")
        .update({ avatar_url: bustedUrl })
        .eq("id", userId);
      if (updateError)
        throwSafe(updateError, "Image uploaded, but could not save it to your profile.");

      return bustedUrl;
    },
    onSuccess: (_, { userId }) => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });
};

export const useRemoveAvatar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await db.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throwSafe(error, "Could not remove your photo.");
      // Storage object is left in place rather than deleted — harmless
      // (avatar_url no longer points to it, so nothing shows it), and
      // avoids a second network call with its own failure mode on every
      // "remove photo" click for a low-stakes cleanup.
    },
    onSuccess: (_, userId) => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });
};
