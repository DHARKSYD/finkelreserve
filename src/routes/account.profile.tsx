import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyProfile,
  useUpdateProfile,
  useUpdateAvatar,
  useRemoveAvatar,
} from "@/lib/queries/profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account/profile")({
  head: () => ({ meta: [{ title: "Profile — My Account" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile(user?.id);
  const updateProfile = useUpdateProfile();
  const updateAvatar = useUpdateAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailForm, setEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  if (!user || isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const handleSave = () => {
    if (!displayName.trim()) return toast.error("Name is required.");
    updateProfile.mutate(
      { userId: user.id, displayName: displayName.trim(), phone: phone.trim() },
      {
        onSuccess: () => toast.success("Profile updated."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save changes."),
      },
    );
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    updateAvatar.mutate(
      { userId: user.id, file },
      {
        onSuccess: () => toast.success("Photo updated."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed."),
      },
    );
  };

  // Supabase Auth handles email changes itself — this sends a confirmation
  // link rather than writing straight to auth.users, which is the whole
  // point of not treating it like a normal database field: the address
  // isn't actually changed until the customer clicks that link.
  const handleEmailChange = async () => {
    if (!newEmail.trim() || newEmail === user.email) return;
    setEmailSubmitting(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Check ${newEmail} to confirm the change.`);
    setEmailForm(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display font-bold text-lg">Profile</h2>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-xl">
                {(displayName || "C").charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={updateAvatar.isPending}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-60"
              title="Change photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarPick}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {updateAvatar.isPending ? "Uploading…" : "Profile photo"}
            </p>
            {profile?.avatarUrl && (
              <button
                onClick={() =>
                  removeAvatar.mutate(user.id, {
                    onError: (e) =>
                      toast.error(e instanceof Error ? e.message : "Could not remove photo."),
                  })
                }
                disabled={removeAvatar.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Full name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Not set"
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending}
          className="mt-5 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {updateProfile.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="glass rounded-2xl p-6">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Email</p>
        <p className="text-sm mb-3">{user.email}</p>

        {!emailForm ? (
          <button
            onClick={() => {
              setNewEmail(user.email ?? "");
              setEmailForm(true);
            }}
            className="text-xs font-bold text-primary hover:underline"
          >
            Change email
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary flex-1 w-full sm:w-auto"
            />
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleEmailChange}
                disabled={emailSubmitting}
                className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold disabled:opacity-60"
              >
                {emailSubmitting ? "Sending…" : "Send confirmation"}
              </button>
              <button
                onClick={() => setEmailForm(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {emailForm && (
          <p className="text-[11px] text-muted-foreground mt-2">
            We'll send a confirmation link to the new address — it only takes effect once you click
            it.
          </p>
        )}
      </div>
    </div>
  );
}
