import Link from "next/link";
import { TrendingUp, ShieldCheck, Users, ArrowRight, Sparkles } from "lucide-react";
import { ZapLogo, ZapMark } from "@/components/zap-logo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { AmbientFeed } from "@/components/landing/ambient-feed";
import { users } from "@/lib/fixtures";
import { UserAvatar } from "@/components/user-avatar";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="px-4 lg:px-12 py-5 flex items-center justify-between max-w-[1280px] mx-auto">
        <ZapLogo size="md" />
        <nav className="hidden md:flex items-center gap-7 text-sm text-[#8B92A8]">
          <Link href="#features" className="hover:text-white">Features</Link>
          <Link href="#how" className="hover:text-white">How it works</Link>
          <Link href="#faq" className="hover:text-white">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/onboarding">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 lg:px-12 pt-12 lg:pt-20 pb-20 max-w-[1280px] mx-auto">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-[#FFE600]/8 blur-3xl pointer-events-none -z-10" />
        <div className="absolute -top-20 -left-40 w-[500px] h-[500px] rounded-full bg-[#00D982]/8 blur-3xl pointer-events-none -z-10" />

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE600]/10 border border-[#FFE600]/30 text-[#FFE600] text-[11px] font-mono font-semibold uppercase tracking-widest">
              <Sparkles className="h-3 w-3" /> New: Live trade ticker
            </div>
            <h1 className="mt-5 text-5xl lg:text-7xl font-extrabold tracking-tight leading-[0.95]">
              Put your money <br />
              where your <span className="text-[#FFE600]">mouth</span> is.
            </h1>
            <p className="mt-5 text-lg lg:text-xl text-[#8B92A8] leading-relaxed max-w-xl">
              Zap is where opinions become predictions, predictions become positions,
              and your accuracy becomes your reputation.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button size="xl" asChild className="text-base">
                <Link href="/onboarding">
                  Get started — it's free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/">Watch the demo</Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="ring-2 ring-[#0A0B0F] rounded-full">
                    <UserAvatar
                      src={u.avatarUrl}
                      name={u.name}
                      size="xs"
                      showScore={false}
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm font-mono text-[#8B92A8]">
                <span className="text-white font-bold">12,000+</span> predictors already on Zap
              </div>
            </div>
          </div>

          <div className="relative">
            <AmbientFeed />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 lg:px-12 py-20 max-w-[1280px] mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
            What you get
          </div>
          <h2 className="mt-2 text-3xl lg:text-5xl font-bold tracking-tight">
            Three reasons to bet on yourself.
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <Feature
            icon={TrendingUp}
            title="Trade on what you believe"
            body="Pick a side. YES or NO. Put points down on what you think will happen — Fed cuts, elections, market levels, sports, anything."
            color="#00D982"
          />
          <Feature
            icon={ShieldCheck}
            title="Build verified expertise"
            body="Every prediction is scored. Categories you nail get a public score. Bad takes don't disappear — your record follows you."
            color="#FFE600"
          />
          <Feature
            icon={Users}
            title="Follow proven experts"
            body="Don't take advice from someone who's never been right. Follow predictors with 90+ accuracy in your category."
            color="#4DA3FF"
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 lg:px-12 py-20 max-w-[1280px] mx-auto">
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              title: "Sign up, get points",
              body: "Create an account, claim 50 starting Zaps, and earn more through daily quests, streaks, and accurate predictions.",
            },
            {
              n: "02",
              title: "Take a position",
              body: "Markets resolve YES or NO. Buy YES at 38% probability → if it resolves YES you get 1.00 per share. Up to 2.6× profit.",
            },
            {
              n: "03",
              title: "Get scored",
              body: "Your record builds over time. Categories where you're right become your expertise. Others follow you for those.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-6"
            >
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFE600]">
                Step {s.n}
              </div>
              <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-[#8B92A8] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="px-4 lg:px-12 py-20 max-w-[1280px] mx-auto">
        <div className="rounded-[18px] border border-[#2A2F3D] bg-gradient-to-br from-[#1A1D26] to-[#14161D] p-8 lg:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#FFE600]/8 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
              Trusted by predictors who put up
            </div>
            <div className="mt-2 text-4xl lg:text-6xl font-extrabold tracking-tight inline-flex items-baseline">
              42.8M
              <ZapMark className="lg ml-1" />
            </div>
            <div className="mt-1 text-base text-[#8B92A8]">
              traded across 240+ markets last week
            </div>
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <div className="flex -space-x-2">
                {users.slice(0, 8).map((u) => (
                  <div key={u.id} className="ring-2 ring-[#1A1D26] rounded-full">
                    <UserAvatar
                      src={u.avatarUrl}
                      name={u.name}
                      size="sm"
                      category={u.primaryCategory}
                      showScore={false}
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm font-mono text-[#8B92A8]">
                <span className="text-white font-bold">+12,000</span> more
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 lg:px-12 py-20 max-w-[800px] mx-auto">
        <div className="text-center">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#5A6175]">
            FAQ
          </div>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
            Questions, answered.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          <AccordionItem value="1">
            <AccordionTrigger>Is this real money?</AccordionTrigger>
            <AccordionContent>
              No. Zap uses points (⚡), an internal currency. There is no cash out, no payout
              for real-money winnings — this is a skill-tracking and reputation platform for
              prediction makers.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="2">
            <AccordionTrigger>How do markets resolve?</AccordionTrigger>
            <AccordionContent>
              Every market has a clearly stated resolution source — an SEC filing, an FOMC
              statement, a final-standings page, an artist announcement, etc. When the
              resolution date passes, an oracle verifies the outcome and the market settles.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="3">
            <AccordionTrigger>What is an Expert Score?</AccordionTrigger>
            <AccordionContent>
              An Expert Score (0-100) measures how calibrated your predictions are in a given
              category. We weight resolved markets only, penalize overconfidence (the Brier
              score), and reward you for being right on hard markets. Predict in a category,
              improve your score there.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="4">
            <AccordionTrigger>Can I follow other predictors?</AccordionTrigger>
            <AccordionContent>
              Yes — that's a key part of Zap. You can follow anyone, subscribe to their
              prediction notifications, and see how their positions move in real time. Build
              your own portfolio of trusted experts.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="5">
            <AccordionTrigger>How do I earn points?</AccordionTrigger>
            <AccordionContent>
              You start with 50 Zaps. You earn more by completing daily quests, keeping
              a streak alive, winning predictions, and ranking in the weekly leaderboard.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 rounded-[18px] border border-[#FFE600]/30 bg-gradient-to-br from-[#1F1A0E] to-[#14161D] p-8 text-center">
          <h3 className="text-2xl font-bold">Ready to bet on yourself?</h3>
          <p className="mt-2 text-[#8B92A8]">
            Sign up and place your first prediction in under 60 seconds.
          </p>
          <Button size="xl" className="mt-5" asChild>
            <Link href="/onboarding">
              Start predicting <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 lg:px-12 py-10 border-t border-[#2A2F3D] max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <ZapLogo size="sm" />
          <div className="text-[11px] font-mono text-[#5A6175]">
            © 2026 Zap · Predictions, not financial advice.
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-[#5A6175]">
            <Link href="#" className="hover:text-white">Terms</Link>
            <Link href="#" className="hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-white">X</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  color,
}: {
  icon: any;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div
      className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-6 relative overflow-hidden group hover:border-[#353B4D] transition-colors"
      style={{ boxShadow: `inset 0 1px 0 0 ${color}10` }}
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-20 blur-2xl transition-opacity pointer-events-none"
        style={{ background: color }}
      />
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center mb-3"
        style={{ background: `${color}15`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-[#8B92A8] leading-relaxed">{body}</p>
    </div>
  );
}
