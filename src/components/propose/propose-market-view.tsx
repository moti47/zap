"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Calendar,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ImagePlus,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, type Category } from "@/lib/fixtures";
import { categoryColor, cn } from "@/lib/utils";
import { submitProposalAction } from "@/app/propose/actions";

interface ProposalRow {
  id: string;
  question: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reject_reason: string | null;
  created_at: string;
  category?: { slug: string; name: string; color: string } | null;
  approved_market_id?: string | null;
  initial_yes_price: number;
  resolution_date: string;
}

interface Props {
  initialProposals: ProposalRow[];
  /**
   * When provided, exposes a map of category slugs → ids. Without this
   * (no Supabase env), the form runs in "preview mode": users can fill
   * in the proposal and see the validation flow, but submission shows a
   * "connect Supabase to submit" toast instead of hitting the backend.
   */
  categoryIdsBySlug?: Record<string, string>;
}

const STATUS_META: Record<
  ProposalRow["status"],
  {
    icon: React.ComponentType<{
      className?: string;
      style?: React.CSSProperties;
    }>;
    color: string;
    label: string;
  }
> = {
  pending: { icon: Clock, color: "#FFB800", label: "Pending review" },
  approved: { icon: CheckCircle2, color: "#36D399", label: "Approved" },
  rejected: { icon: XCircle, color: "#FF4757", label: "Rejected" },
  withdrawn: { icon: XCircle, color: "#5A6175", label: "Withdrawn" },
};

export function ProposeMarketView({ initialProposals, categoryIdsBySlug }: Props) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [resolutionSource, setResolutionSource] = useState("");
  const [yesPrice, setYesPrice] = useState(50);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mine, setMine] = useState<ProposalRow[]>(initialProposals);
  const heroInputRef = useRef<HTMLInputElement>(null);

  // Suggest a default resolution date: 7 days out at noon local.
  useEffect(() => {
    if (resolutionDate) return;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(12, 0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    setResolutionDate(iso);
  }, [resolutionDate]);

  const canSubmit =
    question.trim().length >= 8 &&
    question.trim().length <= 280 &&
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

  const onHeroPick = () => heroInputRef.current?.click();
  const onHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadHero(file);
  };

  const reset = () => {
    setQuestion("");
    setDescription("");
    setCategory("");
    setResolutionSource("");
    setYesPrice(50);
    setHeroUrl(null);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(12, 0, 0, 0);
    setResolutionDate(
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16),
    );
  };

  const onSubmit = () => {
    if (!canSubmit) return;
    const categoryId = categoryIdsBySlug?.[category];
    if (!categoryId) {
      toast.info("Connect Supabase to submit proposals to the live queue.", {
        description: "Migration 0004 must be applied so categories.id can resolve.",
      });
      // Optimistic local entry so the user still sees the flow render.
      const stub: ProposalRow = {
        id: `local-${Date.now()}`,
        question: question.trim(),
        description: description.trim(),
        status: "pending",
        reject_reason: null,
        created_at: new Date().toISOString(),
        category: {
          slug: category,
          name: category,
          color: categoryColor(category),
        },
        initial_yes_price: yesPrice,
        resolution_date: new Date(resolutionDate).toISOString(),
      };
      setMine([stub, ...mine]);
      reset();
      return;
    }

    const t = toast.loading("Submitting proposal…");
    startTransition(async () => {
      const result = await submitProposalAction({
        question: question.trim(),
        description: description.trim(),
        category_id: categoryId,
        resolution_date: new Date(resolutionDate).toISOString(),
        resolution_source: resolutionSource.trim(),
        initial_yes_price: yesPrice,
        hero_image_url: heroUrl,
      });
      if (!result.ok) {
        toast.error(result.error, { id: t });
        return;
      }
      toast.success("Proposal submitted — admin will review.", { id: t });
      reset();
      const stub: ProposalRow = {
        id: result.id,
        question: question.trim(),
        description: description.trim(),
        status: "pending",
        reject_reason: null,
        created_at: new Date().toISOString(),
        category: {
          slug: category,
          name: category,
          color: categoryColor(category),
        },
        initial_yes_price: yesPrice,
        resolution_date: new Date(resolutionDate).toISOString(),
      };
      setMine([stub, ...mine]);
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600]">
          Propose
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          Propose a market
        </h1>
        <p className="text-[13px] text-[#8B92A8] mt-1 max-w-[560px]">
          Suggest a question for the community to trade. Markets are
          reviewed by an admin before going live — clear, resolvable
          questions with a reliable source get approved faster.
        </p>
      </header>

      {/* Form */}
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 sm:p-6 space-y-5">
        <Field
          label="Question"
          hint={`${question.length}/280 · "Will X happen by Y?" works best`}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
            placeholder="Will the Fed cut rates by ≥50 bps before July 31?"
            rows={2}
            className="w-full resize-none rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none p-3 text-[15px] text-white placeholder:text-[#5A6175]"
          />
        </Field>

        <Field label="Category" hint="Pick where this market belongs">
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
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Description (optional)"
          hint="Add resolution criteria, edge cases, helpful links."
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            placeholder="The market resolves YES if the FOMC announces a target rate ≥50 bps below the current 5.25%–5.50% band before July 31, 2026 at 11:59pm ET."
            rows={4}
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
          <Field
            label="Resolution source"
            icon={<LinkIcon className="h-3.5 w-3.5" />}
            hint="A URL or named source that will decide YES/NO"
          >
            <input
              type="text"
              value={resolutionSource}
              onChange={(e) => setResolutionSource(e.target.value.slice(0, 200))}
              placeholder="federalreserve.gov / ESPN box score / official press release"
              className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none px-3 py-2.5 text-[14px] text-white placeholder:text-[#5A6175]"
            />
          </Field>
        </div>

        <Field
          label={`Initial YES probability · ${yesPrice}%`}
          hint="Where do you think YES should open? (NO is auto-priced)"
        >
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={99}
              value={yesPrice}
              onChange={(e) => setYesPrice(parseInt(e.target.value, 10))}
              className="flex-1 accent-[#FFE600]"
            />
            <div className="flex items-center gap-1">
              <span className="text-[14px] font-bold text-[#36D399] tabular-nums w-10 text-right">
                YES {yesPrice}%
              </span>
              <span className="text-[#5A6175] text-[12px] mx-1">/</span>
              <span className="text-[14px] font-bold text-[#FF4757] tabular-nums w-10">
                NO {100 - yesPrice}%
              </span>
            </div>
          </div>
        </Field>

        <Field label="Hero image (optional)" hint="Shown at the top of the market page">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onHeroPick}
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
              onChange={onHeroFile}
            />
          </div>
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-[#2A2F3D]">
          <div className="text-[11px] text-[#8B92A8]">
            Submitted proposals are reviewed by an admin before becoming open
            markets.
          </div>
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
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Submit proposal
              </>
            )}
          </motion.button>
        </div>
      </section>

      {/* My proposals */}
      <section className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        <header className="px-5 py-3 border-b border-[#2A2F3D] flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FFE600]" />
          <h2 className="text-sm font-semibold text-white">Your proposals</h2>
          <span className="text-[10px] font-mono text-[#5A6175] ml-auto">
            {mine.length} total
          </span>
        </header>
        {mine.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-[#8B92A8]">
            No proposals yet. Submit one above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-[#20232E]">
            {mine.map((p) => {
              const meta = STATUS_META[p.status];
              const Icon = meta.icon;
              return (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <Icon
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: meta.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-white leading-snug">
                        {p.question}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10.5px] font-mono text-[#5A6175]">
                        <span style={{ color: meta.color }}>{meta.label}</span>
                        <span>·</span>
                        <span>
                          opens {p.initial_yes_price}% YES
                        </span>
                        <span>·</span>
                        <span>
                          resolves{" "}
                          {new Date(p.resolution_date).toLocaleDateString()}
                        </span>
                      </div>
                      {p.status === "rejected" && p.reject_reason && (
                        <div className="mt-1.5 text-[11px] text-[#FF4757] italic">
                          “{p.reject_reason}”
                        </div>
                      )}
                      {p.status === "approved" && p.approved_market_id && (
                        <a
                          href={`/market/${p.approved_market_id}`}
                          className="mt-1.5 inline-block text-[11px] font-mono text-[#36D399] hover:underline"
                        >
                          Open live market →
                        </a>
                      )}
                    </div>
                    {p.category && (
                      <span
                        className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border shrink-0"
                        style={{
                          color: p.category.color || "#FFE600",
                          borderColor: `${p.category.color || "#FFE600"}55`,
                          background: `${p.category.color || "#FFE600"}10`,
                        }}
                      >
                        {p.category.slug}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
      {hint && (
        <div className="mt-1 text-[10.5px] text-[#5A6175]">{hint}</div>
      )}
    </label>
  );
}
