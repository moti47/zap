"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useZapStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { updateMyProfileAction } from "@/app/profile/actions";

const GRADIENTS = [
  { id: "gold", value: "linear-gradient(135deg, #FFB800, #FF8A3D)" },
  { id: "green", value: "linear-gradient(135deg, #00D982, #36D399)" },
  { id: "red", value: "linear-gradient(135deg, #FF4757, #F7768E)" },
  { id: "blue", value: "linear-gradient(135deg, #4DA3FF, #5577FF)" },
  { id: "purple", value: "linear-gradient(135deg, #A371F7, #FF6FB5)" },
  { id: "yellow", value: "linear-gradient(135deg, #FFE600, #FFB800)" },
];

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  initialBio: string;
  initialAvatarUrl?: string | null;
  initialCoverGradient?: string | null;
  initialBannerUrl?: string | null;
  /**
   * When provided, persist edits to Supabase via the server action.
   * If omitted, falls back to the local-only Zustand `profileOverride`.
   */
  hasBackend?: boolean;
  username?: string;
}

export function EditProfileModal({
  open,
  onOpenChange,
  initialName,
  initialBio,
  initialAvatarUrl,
  initialCoverGradient,
  initialBannerUrl,
  hasBackend = false,
  username,
}: EditProfileModalProps) {
  const router = useRouter();
  const override = useZapStore((s) => s.profileOverride);
  const updateProfile = useZapStore((s) => s.updateProfile);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null,
  );
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initialBannerUrl ?? null,
  );
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [gradient, setGradient] = useState<string>(
    initialCoverGradient ?? override.avatarGradient ?? GRADIENTS[0].value,
  );
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName ?? override.name ?? "");
      setBio(initialBio ?? override.bio ?? "");
      setAvatarUrl(initialAvatarUrl ?? null);
      setBannerUrl(initialBannerUrl ?? null);
      setGradient(
        initialCoverGradient ?? override.avatarGradient ?? GRADIENTS[0].value,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPickAvatar = () => fileInputRef.current?.click();
  const onPickBanner = () => bannerInputRef.current?.click();

  const uploadBannerFile = async (file: File) => {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Banner too large — max 6MB");
      return;
    }
    if (
      file.type &&
      !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
        file.type.toLowerCase(),
      )
    ) {
      toast.error("Use PNG, JPEG or WebP for banners");
      return;
    }
    setUploadingBanner(true);
    const t = toast.loading("Uploading banner…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-banner", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Upload failed");
      }
      setBannerUrl(json.url);
      toast.success("Banner uploaded", { id: t });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast.error(m, { id: t });
    } finally {
      setUploadingBanner(false);
    }
  };

  const onBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadBannerFile(file);
  };

  const onBannerDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBannerDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadBannerFile(file);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image too large — max 4MB");
      return;
    }
    setUploading(true);
    const t = toast.loading("Uploading avatar…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Upload failed");
      }
      setAvatarUrl(json.url);
      toast.success("Avatar uploaded", { id: t });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast.error(m, { id: t });
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    const safeBio = bio.slice(0, 280);

    // Optimistic local update so the page reflects the change immediately.
    updateProfile({
      name: trimmed,
      bio: safeBio,
      avatarGradient: gradient,
      avatarSeed: avatarUrl ?? undefined,
    });

    if (!hasBackend) {
      toast.success("Profile saved");
      onOpenChange(false);
      return;
    }

    const t = toast.loading("Saving profile…");
    startTransition(async () => {
      const result = await updateMyProfileAction(
        {
          name: trimmed,
          bio: safeBio,
          avatar_url: avatarUrl,
          cover_gradient: gradient,
          banner_url: bannerUrl,
        },
        { username },
      );
      if (!result.ok) {
        toast.error(result.error || "Save failed", { id: t });
        return;
      }
      toast.success("Profile saved", { id: t });
      onOpenChange(false);
      router.refresh();
    });
  };

  const initial = (name || "Y").charAt(0).toUpperCase();
  const saving = isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[#2A2F3D]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription className="text-[#8B92A8]">
              {hasBackend
                ? "Updates are saved to your account."
                : "Changes are stored locally on this device."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Cover / banner preview — banner image wins when set, gradient fallback. */}
        <div
          className={cn(
            "relative h-28 w-full overflow-hidden transition-colors",
            bannerDragOver && "ring-2 ring-[#FFE600] ring-offset-0",
          )}
          style={!bannerUrl ? { background: gradient } : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setBannerDragOver(true);
          }}
          onDragLeave={() => setBannerDragOver(false)}
          onDrop={onBannerDrop}
        >
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Banner preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1A1D26]/80" />

          {/* Banner controls — top-right */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPickBanner}
              disabled={uploadingBanner || saving}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-black/55 hover:bg-black/70 backdrop-blur text-white text-[11px] font-semibold transition-colors"
            >
              {uploadingBanner ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5" />
                  {bannerUrl ? "Replace banner" : "Add banner"}
                </>
              )}
            </button>
            {bannerUrl && (
              <button
                type="button"
                onClick={() => setBannerUrl(null)}
                disabled={uploadingBanner || saving}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-black/55 hover:bg-[#FF4757]/80 backdrop-blur text-white transition-colors"
                aria-label="Remove banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {!bannerUrl && (
            <div className="absolute inset-x-0 bottom-2 text-center text-[10.5px] font-mono text-white/75 uppercase tracking-widest">
              Drop an image or click <span className="text-[#FFE600]">Add banner</span>
            </div>
          )}

          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={onBannerFile}
          />
        </div>

        <div className="p-5 space-y-5 -mt-10 relative">
          {/* Avatar row */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onPickAvatar}
              disabled={uploading || saving}
              className="relative group h-16 w-16 rounded-full overflow-hidden ring-4 ring-[#1A1D26] focus:outline-none focus:ring-[#FFE600]/60"
              aria-label="Upload new avatar"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center text-[#0A0B0F] font-bold text-2xl"
                  style={{ background: gradient }}
                >
                  {initial}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              onChange={onFile}
            />
            <div className="flex-1">
              <div className="text-xs font-mono uppercase tracking-wider text-[#8B92A8] mb-1.5">
                Avatar
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onPickAvatar}
                  disabled={uploading || saving}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Camera className="h-3.5 w-3.5" />
                      Upload
                    </>
                  )}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAvatarUrl(null)}
                    disabled={uploading || saving}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Cover gradient */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#8B92A8] mb-2">
              Cover gradient
            </div>
            <div className="flex gap-2 flex-wrap">
              {GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-label={`Cover ${g.id}`}
                  aria-pressed={gradient === g.value}
                  onClick={() => setGradient(g.value)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    gradient === g.value
                      ? "border-white scale-110 shadow-md"
                      : "border-[#2A2F3D] hover:border-[#5A6175]",
                  )}
                  style={{ background: g.value }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="profile-name"
              className="text-xs font-mono uppercase tracking-wider text-[#8B92A8]"
            >
              Display name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              className="mt-1"
              maxLength={50}
              disabled={saving}
              placeholder="Your name"
            />
          </div>

          {/* Bio */}
          <div>
            <div className="flex justify-between items-center">
              <label
                htmlFor="profile-bio"
                className="text-xs font-mono uppercase tracking-wider text-[#8B92A8]"
              >
                Bio
              </label>
              <span
                className={cn(
                  "text-[10px] font-mono tabular-nums",
                  bio.length >= 280
                    ? "text-[#FF4757]"
                    : bio.length > 240
                      ? "text-[#FFB800]"
                      : "text-[#5A6175]",
                )}
              >
                {bio.length}/280
              </span>
            </div>
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              rows={4}
              className="mt-1 resize-none"
              placeholder="Tell people what you trade and how you think."
              disabled={saving}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2 border-t border-[#2A2F3D]">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!name.trim() || saving || uploading}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
