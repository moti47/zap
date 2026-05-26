"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Link as LinkIcon,
  ImagePlus,
  Loader2,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, type Category } from "@/lib/fixtures";
import { categoryColor, cn } from "@/lib/utils";
import { adminCreateMarketAction } from "@/app/admin/actions";

interface Props {
  /** Map of category slug → uuid id (from server). Optional in demo mode. */
  categoryIdsBySlug?: Record<string, string>;
}

export function AdminCreateMarketForm({ categoryIdsBySlug }: Props) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [resolutionSource, setResolutionSource] = useState("");
  const [yesPrice, setYesPrice] = useState(50);
  const [seedLiquidity, setSeedLiquidity] = useState(1000);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resolutionDate) return;
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(12, 0, 0, 0);
    setResolutionDate(
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16),
    );
  }, [resolutionDate]);

  const canSubmit =
    question.trim().length >= 8 &&
    !!category &&
    !!resolutionDate &&
    resolutionSource.trim().length >= 4 &&
    yesPrice >= 1 &&
    yesPrice <= 99 &&
    !isPending;

  const uploadHero = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image too large — max 4MB");
      return;
    }
    setUploading(true);
    const t = toast.loading("Uploading hero image…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Upload failed");
      setHeroUrl(json.url);
      toast.success("Hero image attached", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { id: t });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = () => {
    if (!canSubmit) return;
    const categoryId = categoryIdsBySlug?.[category];
    if (!categoryId) {
      toast.info("Connect Supabase to create live markets.", {
        description:
          "category.id can only resolve once 0001/0003/0004 migrations are applied.",
      });
      return;
    }
    const t = toast.loading("Creating market…");
    startTransition(async () => {
      const result = await adminCreateMarketAction({
        question: question.trim(),
        description: description.trim(),
        category_id: categoryId,
        resolution_date: new Date(resolutionDate).toISOString(),
        resolution_source: resolutionSource.trim(),
        initial_yes_price: yesPrice,
        hero_image_url: heroUrl,
        seed_liquidity: seedLiquidity,
      });
      if (!result.ok) {
        toast.error(result.error, { id: t });
        return;
      }
      toast.success("Market live", { id: t });
      router.push(`/market/${result.id}`);
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600] inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Admin · new market
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Create a market
        </h1>
        <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[560px]">
          Goes live immediately. For community-submitted ideas, use the
          proposals queue instead.
        </p>
      </header>

      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 sm:p-6 space-y-5">
        <Field
          label="Question"
          hint={`${question.length}/280 · use clear YES/NO phrasing`}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
            placeholder="Will SpaceX launch Starship V3 by Q3 2026?"
            rows={2}
            className="w-full resize-none rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none p-3 text-[15px] text-white placeholder:text-[#5A6175]"
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const active = c === category;
              const color = categoryColor(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-semibold capitalize transition-all",
                    active ? "scale-[1.03]" : "hover:scale-[1.02]",
                  )}
                  style={{
                    borderColor: active ? color : "#2A2F3D",
                    color: active ? color : "#8B92A8",
                    background: active ? `${color}14` : "transparent",
                    boxShadow: active ? `0 0 0 2px ${color}33` : undefined,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Description" hint="Resolution criteria, sources, edge cases">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="Resolves YES if Starship's V3 prototype completes a successful orbital insertion + reentry before 2026-09-30."
            className="w-full resize-none rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none p-3 text-[14px] text-white placeholder:text-[#5A6175]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resolution date" icon={<Calendar className="h-3.5 w-3.5" />}>
            <input
              type="datetime-local"
              value={resolutionDate}
              onChange={(e) => setResolutionDate(e.target.value)}
              className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none px-3 py-2.5 text-[14px] text-white"
            />
          </Field>
          <Field label="Resolution source" icon={<LinkIcon className="h-3.5 w-3.5" />}>
            <input
              type="text"
              value={resolutionSource}
              onChange={(e) => setResolutionSource(e.target.value.slice(0, 200))}
              placeholder="spacex.com news / official launch broadcast"
              className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none px-3 py-2.5 text-[14px] text-white placeholder:text-[#5A6175]"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Initial YES price · ${yesPrice}¢`}>
            <input
              type="range"
              min={1}
              max={99}
              value={yesPrice}
              onChange={(e) => setYesPrice(parseInt(e.target.value, 10))}
              className="w-full accent-[#FFE600]"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#36D399]">YES {yesPrice}¢</span>
              <span className="text-[#FF4757]">NO {100 - yesPrice}¢</span>
            </div>
          </Field>
          <Field
            label="Seed liquidity (⚡)"
            hint="Volume the market opens with"
          >
            <input
              type="number"
              min={0}
              step={100}
              value={seedLiquidity}
              onChange={(e) =>
                setSeedLiquidity(Math.max(0, parseInt(e.target.value || "0", 10)))
              }
              className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none px-3 py-2.5 text-[14px] text-white"
            />
          </Field>
        </div>

        <Field label="Hero image (optional)">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              disabled={uploading || isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0E1016] border border-[#2A2F3D] hover:border-[#FFE600]/40 text-[12px] text-white transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5" />
                  {heroUrl ? "Replace image" : "Upload image"}
                </>
              )}
            </button>
            {heroUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroUrl}
                  alt="Hero preview"
                  className="h-12 w-20 object-cover rounded-md border border-[#2A2F3D]"
                />
                <button
                  type="button"
                  onClick={() => setHeroUrl(null)}
                  className="text-[11px] text-[#8B92A8] hover:text-[#FF4757]"
                >
                  Remove
                </button>
              </>
            )}
            <input
              ref={heroInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) await uploadHero(file);
              }}
            />
          </div>
        </Field>

        <div className="flex items-center justify-end pt-2 border-t border-[#2A2F3D]">
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-bold transition-all",
              canSubmit
                ? "bg-[#FFE600] text-[#0E1016] hover:scale-[1.02]"
                : "bg-[#20232E] text-[#5A6175] cursor-not-allowed",
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <PlusCircle className="h-3.5 w-3.5" />
                Create market
              </>
            )}
          </motion.button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase tracking-widest text-[#8B92A8] mb-1.5 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      {children}
      {hint && <div className="mt-1 text-[10.5px] text-[#5A6175]">{hint}</div>}
    </label>
  );
}
