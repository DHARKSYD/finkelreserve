import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// Evidence for a damage/wrong-item return claim — photos or a short video.
// Same upload pattern as avatar upload (src/lib/queries/profile.ts): direct
// client-side upload to Storage, relying on the bucket's own RLS rather
// than a server function. Unlike avatars, this bucket is private (see the
// migration) — photos of someone's delivery/home aren't the kind of thing
// that should be guessable by URL — so nothing here ever calls
// getPublicUrl(); display always goes through useEvidenceUrls() below.

const MAX_FILES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};

export function validateEvidenceFile(file: File): string | null {
  const kind = ALLOWED_TYPES[file.type];
  if (!kind) return "Please choose a JPG, PNG, WEBP photo or MP4/MOV/WEBM video.";
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max)
    return `${kind === "image" ? "Photos" : "Videos"} must be under ${max / 1024 / 1024}MB.`;
  return null;
}

export { MAX_FILES };

/**
 * Uploads one file to the customer's own folder in the private
 * return-evidence bucket and returns its storage path (not a URL — the
 * bucket isn't public). Random filename per upload: unlike the avatar's
 * fixed-name-plus-upsert pattern, there's no single "the" evidence file to
 * replace — a return can have several, and none of them get overwritten.
 */
export const useUploadReturnEvidence = () =>
  useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }): Promise<string> => {
      const validationError = validateEvidenceFile(file);
      if (validationError) throw new Error(validationError);

      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("return-evidence")
        .upload(path, file, { contentType: file.type });
      if (error) throwSafe(error, "Could not upload this file.");

      return path;
    },
  });

/**
 * Signed URLs for displaying evidence already on a return request — the
 * bucket is private, so a stored path only becomes viewable through a
 * time-limited signed URL generated per read, never a permanent link.
 * Batches into one Storage call rather than one per path.
 */
export const useEvidenceUrls = (paths: string[]) =>
  useQuery({
    queryKey: ["return-evidence", "signed-urls", paths],
    queryFn: async (): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage
        .from("return-evidence")
        .createSignedUrls(paths, 3600);
      if (error) throwSafe(error, "Could not load evidence files.");
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
    enabled: paths.length > 0,
    staleTime: 30 * 60_000, // signed URLs are valid 1hr; refetch well before they'd expire
  });

export const isVideoPath = (path: string) => /\.(mp4|mov|webm)$/i.test(path);
