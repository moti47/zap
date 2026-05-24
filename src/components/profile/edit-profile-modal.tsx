"use client";

import { useEffect, useState } from "react";
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
}

export function EditProfileModal({
  open,
  onOpenChange,
  initialName,
  initialBio,
}: EditProfileModalProps) {
  const override = useZapStore((s) => s.profileOverride);
  const updateProfile = useZapStore((s) => s.updateProfile);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [gradient, setGradient] = useState<string>(
    override.avatarGradient ?? GRADIENTS[0].value
  );

  useEffect(() => {
    if (open) {
      setName(override.name ?? initialName);
      setBio(override.bio ?? initialBio);
      setGradient(override.avatarGradient ?? GRADIENTS[0].value);
    }
  }, [open, initialName, initialBio, override]);

  const save = () => {
    updateProfile({
      name: name.trim() || undefined,
      bio: bio.slice(0, 280),
      avatarGradient: gradient,
    });
    toast.success("Profile saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-5 border-b border-[#2A2F3D]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription className="text-[#8B92A8]">
              Changes are stored locally on this device.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-[#0A0B0F] font-bold text-xl ring-4 ring-[#0A0B0F]"
              style={{ background: gradient }}
            >
              {(name || "Y").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-xs font-mono uppercase tracking-wider text-[#8B92A8] mb-1.5">
                Avatar
              </div>
              <div className="flex gap-2 flex-wrap">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-label={`Color ${g.id}`}
                    onClick={() => setGradient(g.value)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      gradient === g.value
                        ? "border-white scale-110"
                        : "border-[#2A2F3D]"
                    )}
                    style={{ background: g.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[#8B92A8]">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              className="mt-1"
              maxLength={50}
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono uppercase tracking-wider text-[#8B92A8]">
                Bio
              </label>
              <span className="text-[10px] font-mono text-[#5A6175] tabular-nums">
                {bio.length}/280
              </span>
            </div>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              rows={4}
              className="mt-1"
              placeholder="Tell people what you trade and how you think."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-[#2A2F3D]">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
