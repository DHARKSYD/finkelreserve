import { useQuery } from "@tanstack/react-query";
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
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit
const ALLOWED_TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};
// Some phones/file pickers hand over a file with an empty or generic MIME type (notably .mov and
// .mp4 on certain Android versions). Fall back to the extension so a perfectly good video isn't
// refused — the bucket itself only accepts the types above.
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** The accepted MIME type for this file (from its own type, else its extension), or null. */
export function evidenceMime(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? null;
}

export const evidenceKind = (file: File): "image" | "video" | null => {
  const mime = evidenceMime(file);
  return mime ? ALLOWED_TYPES[mime] : null;
};

export function validateEvidenceFile(file: File): string | null {
  const kind = evidenceKind(file);
  if (!kind) return "Please choose a JPG, PNG or WEBP photo, or an MP4, MOV or WEBM video.";
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max)
    return `${kind === "image" ? "Photos" : "Videos"} must be under ${max / 1024 / 1024}MB.`;
  return null;
}

export const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export { MAX_FILES };

/**
 * Uploads one file to the customer's own folder in the private
 * return-evidence bucket and returns its storage path (not a URL — the
 * bucket isn't public). Random filename per upload: unlike the avatar's
 * fixed-name-plus-upsert pattern, there's no single "the" evidence file to
 * replace — a return can have several, and none of them get overwritten.
 */
/**
 * Uploads one evidence file, reporting PROGRESS and supporting CANCEL — what a customer on a slow
 * mobile connection needs for a video of up to 50MB. supabase-js's upload() can't report
 * progress, so this sends the identical request the library does (checked against
 * @supabase/storage-js: a multipart body with `cacheControl` and the file under an empty field
 * name, POSTed to /storage/v1/object/<bucket>/<path> with the user's token and the API key) but
 * over XMLHttpRequest, whose upload events give us the percentage. Storage RLS applies exactly
 * as before — the path must start with the caller's own user id.
 *
 * Resolves with the storage path. Rejects with an Error whose message is safe to show; a
 * cancelled upload rejects with an AbortError (check `err.name === "AbortError"`).
 */
export async function uploadEvidenceFile(opts: {
  userId: string;
  file: File;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { userId, file, onProgress, signal } = opts;

  const problem = validateEvidenceFile(file);
  if (problem) throw new Error(problem);
  if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const mime = evidenceMime(file)!;
  // Re-wrap with the corrected type so the bucket's MIME allow-list sees a real one.
  const upload = file.type === mime ? file : new File([file], file.name, { type: mime });
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/return-evidence/${path}`;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false"); // never overwrite — every upload gets its own random name
    xhr.timeout = 15 * 60 * 1000; // 50MB on a weak connection can legitimately take minutes

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(path);
        return;
      }
      if (xhr.status === 401 || xhr.status === 403) {
        reject(new Error("Your session expired. Please sign in again."));
      } else if (xhr.status === 413) {
        reject(new Error("That file is too large to upload."));
      } else if (xhr.status === 400 || xhr.status === 415) {
        reject(
          new Error(
            "This file type isn't accepted. Please use a JPG, PNG, WEBP, MP4, MOV or WEBM file.",
          ),
        );
      } else {
        reject(new Error("Could not upload this file. Please try again."));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Network problem while uploading. Check your connection and try again."));
    xhr.ontimeout = () =>
      reject(new Error("The upload took too long. Try a shorter video, or a better connection."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", upload);
    xhr.send(form);
  });
}

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
