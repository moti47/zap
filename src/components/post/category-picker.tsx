"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Search } from "lucide-react";
import { Category, CATEGORIES } from "@/lib/types";
import { cn, categoryColor } from "@/lib/utils";

interface CategoryMeta {
  title: string;
  description: string;
  icon: string;
}

// Curated meta for the most popular categories. Anything not listed
// gets a default from `metaFor()` so the picker still renders nicely.
const CATEGORY_DETAILS: Record<string, CategoryMeta> = {
  politics:           { title: "Politics",           description: "Elections, policy, world affairs",       icon: "🏛️" },
  crypto:             { title: "Crypto",             description: "Tokens, protocols, on-chain markets",    icon: "🔗" },
  sports:             { title: "Sports",             description: "Leagues, matches, MVPs",                  icon: "🏆" },
  tech:               { title: "Tech",               description: "AI, hardware, product launches",          icon: "⚡" },
  economy:            { title: "Economy",            description: "Rates, inflation, macro calls",           icon: "📈" },
  entertainment:      { title: "Entertainment",      description: "Films, music, pop culture",                icon: "🎬" },
  ai:                 { title: "AI",                 description: "Models, labs, AGI timelines",              icon: "🤖" },
  stocks:             { title: "Stocks",             description: "Equities, earnings, IPOs",                 icon: "📊" },
  finance:            { title: "Finance",            description: "Markets, banks, capital flows",            icon: "💵" },
  elections:          { title: "Elections",          description: "Races, polls, voting outcomes",            icon: "🗳️" },
  geopolitics:        { title: "Geopolitics",        description: "Conflicts, alliances, foreign policy",     icon: "🌍" },
  climate:            { title: "Climate",            description: "Emissions, weather, transition",           icon: "🌡️" },
  science:            { title: "Science",            description: "Research, discoveries, papers",            icon: "🔬" },
  health:             { title: "Health",             description: "Drugs, trials, public health",             icon: "🩺" },
  covid:              { title: "COVID",              description: "Cases, variants, policy",                  icon: "🦠" },
  gaming:             { title: "Gaming",             description: "Releases, sales, awards",                  icon: "🎮" },
  esports:            { title: "Esports",            description: "Tournaments, teams, finals",               icon: "🕹️" },
  movies:             { title: "Movies",             description: "Box office, awards, sequels",              icon: "🎥" },
  tv:                 { title: "TV",                 description: "Shows, ratings, renewals",                 icon: "📺" },
  music:              { title: "Music",              description: "Charts, releases, tours",                  icon: "🎵" },
  celebrities:        { title: "Celebrities",        description: "People, drama, public figures",            icon: "⭐" },
  fashion:            { title: "Fashion",            description: "Brands, weeks, trends",                    icon: "👗" },
  art:                { title: "Art",                description: "Auctions, exhibits, artists",              icon: "🎨" },
  books:              { title: "Books",              description: "Releases, bestsellers, prizes",            icon: "📚" },
  education:          { title: "Education",          description: "Schools, policy, admissions",              icon: "🎓" },
  startups:           { title: "Startups",           description: "Founders, launches, exits",                icon: "🚀" },
  vc:                 { title: "VC",                 description: "Funds, rounds, IPOs",                      icon: "💼" },
  "real-estate":      { title: "Real Estate",        description: "Housing, rates, developments",             icon: "🏠" },
  energy:             { title: "Energy",             description: "Power, grid, fuels",                       icon: "⚡" },
  oil:                { title: "Oil",                description: "Crude, OPEC, refining",                    icon: "🛢️" },
  commodities:        { title: "Commodities",        description: "Wheat, copper, futures",                   icon: "🌾" },
  metals:             { title: "Metals",             description: "Gold, silver, copper",                     icon: "🥇" },
  macro:              { title: "Macro",              description: "GDP, central banks, cycles",               icon: "🏛️" },
  rates:              { title: "Rates",              description: "Fed, ECB, yield curves",                   icon: "📉" },
  inflation:          { title: "Inflation",          description: "CPI, PPI, expectations",                   icon: "📊" },
  jobs:               { title: "Jobs",               description: "NFP, unemployment, wages",                 icon: "💼" },
  trade:              { title: "Trade",              description: "Tariffs, treaties, exports",               icon: "🚢" },
  war:                { title: "War",                description: "Conflicts, ceasefires",                    icon: "⚔️" },
  space:              { title: "Space",              description: "Launches, missions, NASA / SpaceX",        icon: "🚀" },
  weather:            { title: "Weather",            description: "Storms, forecasts, seasons",               icon: "🌦️" },
  "natural-disasters":{ title: "Disasters",          description: "Quakes, fires, floods",                    icon: "🌪️" },
  olympics:           { title: "Olympics",           description: "Medals, hosts, records",                   icon: "🏅" },
  soccer:             { title: "Soccer",             description: "Leagues, transfers, World Cup",            icon: "⚽" },
  nba:                { title: "NBA",                description: "Games, playoffs, MVP",                     icon: "🏀" },
  nfl:                { title: "NFL",                description: "Games, playoffs, Super Bowl",              icon: "🏈" },
  mlb:                { title: "MLB",                description: "Season, World Series",                     icon: "⚾" },
  tennis:             { title: "Tennis",             description: "Slams, rankings, finals",                  icon: "🎾" },
  f1:                 { title: "F1",                 description: "Races, drivers, constructors",             icon: "🏎️" },
  ufc:                { title: "UFC",                description: "Cards, title fights, rankings",            icon: "🥋" },
  boxing:             { title: "Boxing",             description: "Bouts, belts, knockouts",                  icon: "🥊" },
};

function metaFor(slug: string): CategoryMeta {
  return (
    CATEGORY_DETAILS[slug] ?? {
      title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "—",
      icon: "🏷️",
    }
  );
}

interface CategoryPickerProps {
  open: boolean;
  onClose: () => void;
  value: Category | "";
  onChange: (next: Category) => void;
}

export function CategoryPicker({
  open,
  onClose,
  value,
  onChange,
}: CategoryPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filtered list, derived from search query.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter((c) => {
      const m = metaFor(c);
      return (
        c.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Reset cursor on open + when filter changes.
  useEffect(() => {
    if (!open) return;
    const idx = value
      ? Math.max(0, filtered.indexOf(value as Category))
      : 0;
    setActiveIndex(idx);
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, value, filtered]);

  // Keyboard nav.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cat = filtered[activeIndex];
        if (cat) {
          onChange(cat);
          onClose();
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, filtered, onChange, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-[#0A0B0F]/70 backdrop-blur-md"
            aria-hidden
          />

          <motion.div
            key="panel"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal
            aria-label="Pick a category"
            initial={{
              opacity: 0,
              y:
                typeof window !== "undefined" && window.innerWidth < 640
                  ? 600
                  : 16,
              scale: 0.96,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y:
                typeof window !== "undefined" && window.innerWidth < 640
                  ? 600
                  : 12,
              scale: 0.97,
            }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            drag={
              typeof window !== "undefined" && window.innerWidth < 640
                ? "y"
                : false
            }
            dragConstraints={{ top: 0, bottom: 240 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "fixed z-[101] outline-none",
              "left-0 right-0 bottom-0 sm:bottom-auto",
              "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
              "w-full sm:w-[680px] max-w-full",
            )}
          >
            <div
              className={cn(
                "bg-gradient-to-b from-[#1A1D26] to-[#14161D]",
                "border border-[#2A2F3D]",
                "shadow-[0_-20px_60px_rgba(0,0,0,0.7)] sm:shadow-[0_30px_120px_rgba(0,0,0,0.7)]",
                "rounded-t-[20px] sm:rounded-[18px]",
                "max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col",
              )}
            >
              <div className="sm:hidden flex justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#353B4D]" />
              </div>

              <header className="px-5 py-4 flex items-center justify-between border-b border-[#2A2F3D]">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#FFE600]">
                    Pick category
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    Choose where your post lives
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 -m-2 rounded-md text-[#8B92A8] hover:text-white hover:bg-[#20232E]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Search */}
              <div className="px-5 pt-3 pb-2 border-b border-[#2A2F3D]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6175]" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search categories…"
                    className="w-full rounded-md bg-[#0E1016] border border-[#2A2F3D] focus:border-[#FFE600] outline-none pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-[#5A6175]"
                  />
                </div>
              </div>

              {/* Grid (scrollable) */}
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto flex-1 thin-scrollbar">
                {filtered.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-[12px] text-[#8B92A8]">
                    No matches for “{query}”
                  </div>
                ) : (
                  filtered.map((c, i) => {
                    const active = value === c;
                    const focused = i === activeIndex;
                    const meta = metaFor(c);
                    const color = categoryColor(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(c);
                          onClose();
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={cn(
                          "relative group text-left rounded-[14px] border p-3.5 transition-all",
                          "flex items-start gap-3",
                          active ? "scale-[1.01]" : "hover:scale-[1.01]",
                        )}
                        style={{
                          borderColor:
                            active || focused ? color : "#2A2F3D",
                          background: active
                            ? `linear-gradient(135deg, ${color}18, transparent 60%)`
                            : focused
                              ? `linear-gradient(135deg, ${color}0c, transparent 60%)`
                              : "#14161D",
                          boxShadow: active
                            ? `0 0 0 3px ${color}30, 0 8px 28px ${color}22`
                            : focused
                              ? `0 0 0 2px ${color}22`
                              : undefined,
                        }}
                      >
                        <div
                          className="text-xl shrink-0 grid place-items-center h-10 w-10 rounded-[10px]"
                          style={{
                            background: `${color}1a`,
                            border: `1px solid ${color}30`,
                          }}
                          aria-hidden
                        >
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[14px] font-bold capitalize truncate"
                            style={{ color: active ? color : "white" }}
                          >
                            {meta.title}
                          </div>
                          <div className="text-[11.5px] text-[#8B92A8] mt-0.5 leading-snug truncate">
                            {meta.description}
                          </div>
                        </div>
                        {active && (
                          <div
                            className="grid place-items-center h-6 w-6 rounded-full shrink-0"
                            style={{ background: color, color: "#0A0B0F" }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <footer className="px-5 py-3 border-t border-[#2A2F3D] flex items-center justify-between text-[10.5px] font-mono text-[#5A6175]">
                <span>↑↓ ← → navigate · ⏎ select · esc close</span>
                <span>
                  {filtered.length} / {CATEGORIES.length}
                </span>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
