"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboardingAction } from "./actions";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Vote,
  Bitcoin,
  Trophy,
  Cpu,
  LineChart,
  Music,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { ZapLogo, ZapMark } from "@/components/zap-logo";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { ExpertBadge } from "@/components/expert-badge";
import { MarketCardCompact } from "@/components/market/market-card-compact";
import { useZapStore } from "@/lib/store";
import { CATEGORIES, type Category, users, markets } from "@/lib/fixtures";
import { cn, categoryColor, formatLargeNumber } from "@/lib/utils";

const ICON_MAP: Record<Category, any> = {
  politics: Vote,
  crypto: Bitcoin,
  sports: Trophy,
  tech: Cpu,
  economy: LineChart,
  entertainment: Music,
};

const STEPS = ["Welcome", "Categories", "Experts", "First trade"] as const;

export function OnboardingClient() {
  const router = useRouter();
  const setOnboarded = useZapStore((s) => s.setOnboarded);
  const setCats = useZapStore((s) => s.setOnboardingCategories);
  const toggleFollow = useZapStore((s) => s.toggleFollow);
  const followingIds = useZapStore((s) => s.followingUserIds);

  const [step, setStep] = useState(0);
  const [selectedCats, setSelectedCats] = useState<Category[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (step === 0) {
      // Fire confetti
      const dur = 1200;
      const end = Date.now() + dur;
      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#FFE600", "#FFB800", "#00D982"],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#FFE600", "#FFB800", "#00D982"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  }, [step]);

  const next = () => {
    if (step === 1) setCats(selectedCats);
    if (step === STEPS.length - 1) {
      // Persist to Supabase (best-effort) AND mark the local store as
      // onboarded so the prototype experience is consistent.
      setFinishing(true);
      const t = toast.loading("Saving your preferences…");
      startTransition(async () => {
        const res = await completeOnboardingAction({
          categories: selectedCats,
        });
        setOnboarded(true);
        if (res.ok) {
          toast.success("Welcome to Zap ⚡", { id: t });
        } else {
          // Onboarding still completes locally; backend may be offline.
          toast.success("Welcome to Zap ⚡ (offline mode)", { id: t });
        }
        router.push("/");
      });
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const expertsForCats = users
    .filter(
      (u) =>
        selectedCats.length === 0 || selectedCats.includes(u.primaryCategory)
    )
    .slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / progress */}
      <header className="px-4 lg:px-12 py-5 flex items-center justify-between max-w-[900px] w-full mx-auto">
        <ZapLogo size="md" />
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
          Step {step + 1} of {STEPS.length}
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 lg:px-12 max-w-[900px] w-full mx-auto">
        <div className="h-1 bg-[#2A2F3D] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FFE600] to-[#00D982]"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="mt-3 flex justify-between text-[11px] font-mono">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "uppercase tracking-widest transition-colors",
                i <= step ? "text-white" : "text-[#5A6175]"
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 flex items-center justify-center px-4 lg:px-12 py-8">
        <div className="max-w-[760px] w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              {step === 0 && (
                <Step1
                  onNext={next}
                />
              )}
              {step === 1 && (
                <Step2
                  selected={selectedCats}
                  toggle={(c) =>
                    setSelectedCats((prev) =>
                      prev.includes(c) ? prev.filter((p) => p !== c) : [...prev, c]
                    )
                  }
                  onNext={next}
                  onBack={back}
                />
              )}
              {step === 2 && (
                <Step3
                  experts={expertsForCats}
                  followingIds={followingIds}
                  toggleFollow={toggleFollow}
                  onNext={next}
                  onBack={back}
                />
              )}
              {step === 3 && (
                <Step4 onNext={next} onBack={back} finishing={finishing} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div
        className="inline-flex h-16 w-16 rounded-full items-center justify-center"
        style={{
          background:
            "radial-gradient(circle, rgba(255,230,0,0.3), rgba(255,184,0,0))",
        }}
      >
        <ZapLogo size="lg" withText={false} />
      </div>
      <h1 className="mt-5 text-4xl lg:text-5xl font-extrabold tracking-tight">
        Welcome to Zap.
      </h1>
      <p className="mt-3 text-lg text-[#8B92A8] max-w-md mx-auto">
        Here are 1,000 starting points to get you trading.
      </p>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="mt-7 inline-flex items-center gap-3 px-6 py-4 rounded-full bg-gradient-to-r from-[#FFE600]/15 to-[#FFB800]/15 border-2 border-[#FFE600]/40"
      >
        <Sparkles className="h-6 w-6 text-[#FFE600]" />
        <span className="text-3xl font-extrabold font-mono inline-flex items-center">
          1,000
          <ZapMark className="lg" />
        </span>
      </motion.div>
      <div className="mt-9">
        <Button size="xl" onClick={onNext}>
          Let's go <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Step2({
  selected,
  toggle,
  onNext,
  onBack,
}: {
  selected: Category[];
  toggle: (c: Category) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-center">
        What do you care about?
      </h1>
      <p className="mt-2 text-[#8B92A8] text-center">
        Pick at least 2. We'll personalize your feed and suggest experts.
      </p>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat];
          const active = selected.includes(cat);
          const color = categoryColor(cat);
          return (
            <motion.button
              key={cat}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(cat)}
              className={cn(
                "rounded-[14px] border-2 p-5 text-left transition-all relative overflow-hidden",
                active
                  ? "border-2 bg-[#1A1D26]"
                  : "border-[#2A2F3D] bg-[#14161D] hover:border-[#353B4D]"
              )}
              style={active ? { borderColor: color, background: `${color}08` } : undefined}
            >
              {active && (
                <span
                  className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ background: color, color: "#0A0B0F" }}
                >
                  <Check className="h-3 w-3" />
                </span>
              )}
              <Icon className="h-8 w-8" style={{ color }} />
              <div className="mt-3 font-bold text-base capitalize">{cat}</div>
              <div className="text-xs font-mono text-[#5A6175] mt-1">
                {Math.floor(Math.random() * 30) + 18} active markets
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#5A6175]">
            {selected.length}/6 selected
          </span>
          <Button onClick={onNext} disabled={selected.length < 2}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step3({
  experts,
  followingIds,
  toggleFollow,
  onNext,
  onBack,
}: {
  experts: typeof users;
  followingIds: string[];
  toggleFollow: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const followCount = followingIds.length;
  return (
    <div>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-center">
        Follow 3 experts.
      </h1>
      <p className="mt-2 text-[#8B92A8] text-center">
        Get their predictions in your feed. Unfollow anytime.
      </p>
      <div className="mt-8 grid sm:grid-cols-2 gap-3">
        {experts.map((u) => {
          const following = followingIds.includes(u.id);
          const score = u.expertScores[u.primaryCategory] ?? 50;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 p-4 rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26]"
            >
              <UserAvatar
                src={u.avatarUrl}
                name={u.name}
                category={u.primaryCategory}
                size="md"
                showScore={false}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{u.name}</div>
                <div className="text-[11px] font-mono text-[#5A6175]">
                  {formatLargeNumber(u.followers)} followers
                </div>
                <div className="mt-1">
                  <ExpertBadge category={u.primaryCategory} score={score} />
                </div>
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="sm"
                  variant={following ? "secondary" : "default"}
                  onClick={() => toggleFollow(u.id)}
                  className="h-8 px-3"
                >
                  {following ? (
                    <>
                      <Check className="h-3 w-3" /> Following
                    </>
                  ) : (
                    "Follow"
                  )}
                </Button>
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#5A6175]">
            Following {followCount}
          </span>
          <Button onClick={onNext} disabled={followCount < 1}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step4({
  onNext,
  onBack,
  finishing,
}: {
  onNext: () => void;
  onBack: () => void;
  finishing?: boolean;
}) {
  const market = markets[4]; // CPI market — popular pick
  return (
    <div>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-center">
        Make your first prediction.
      </h1>
      <p className="mt-2 text-[#8B92A8] text-center">
        Here's a curated market to start. Buy any amount of YES or NO — your 1,000⚡
        won't go far if you're careless.
      </p>
      <div className="mt-7">
        <MarketCardCompact market={market} />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={finishing}>
          Back
        </Button>
        <Button onClick={onNext} disabled={finishing}>
          {finishing ? "Saving…" : "Finish onboarding"}
          {!finishing && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
