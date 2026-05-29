/**
 * Round-2 Item #4 — Single source of truth for category presentation.
 *
 * Every slug in `lib/types.ts CATEGORIES` is explicitly mapped here to:
 *   - `color`     — hex used for ring / halo / chip background tints
 *   - `textClass` — Tailwind class for foreground text (uses arbitrary
 *                   color so the palette stays exact)
 *   - `ringClass` — Tailwind class for `ring-*` usage
 *   - `icon`      — short emoji / glyph hint for chips that surface one
 *   - `name`      — human-readable label
 *
 * Why a single map: previously `categoryColor`, `categoryRingClass`,
 * and `categoryTextClass` lived in `lib/utils` and each only covered
 * the original 6 categories. Anything outside that list fell through
 * to neutral grey, which is why several markets cards rendered as a
 * dead-grey row. Centralizing here means adding a new slug is a one-
 * line change and EVERY surface (feed cards, post-card chips, market
 * grid, admin "Create market", category pages, expert ladders) picks
 * it up automatically.
 *
 * The hex palette has been chosen so categories within a thematic
 * family stay visually adjacent (e.g. all sports lean green, all
 * finance lean amber, all conflict / geopolitics lean red).
 */

import type { Category } from "@/lib/types";

export interface CategoryStyle {
  slug: Category;
  name: string;
  color: string;
  textClass: string;
  ringClass: string;
  icon: string;
  description?: string;
}

const NEUTRAL: Omit<CategoryStyle, "slug" | "name"> = {
  color: "#8B92A8",
  textClass: "text-[#8B92A8]",
  ringClass: "ring-[#8B92A8]",
  icon: "•",
};

const RAW: CategoryStyle[] = [
  // Original 6
  { slug: "politics",      name: "Politics",      color: "#A371F7", textClass: "text-[#A371F7]", ringClass: "ring-[#A371F7]", icon: "🏛️" },
  { slug: "crypto",        name: "Crypto",        color: "#FF8A3D", textClass: "text-[#FF8A3D]", ringClass: "ring-[#FF8A3D]", icon: "🪙" },
  { slug: "sports",        name: "Sports",        color: "#36D399", textClass: "text-[#36D399]", ringClass: "ring-[#36D399]", icon: "🏟️" },
  { slug: "tech",          name: "Tech",          color: "#4DA3FF", textClass: "text-[#4DA3FF]", ringClass: "ring-[#4DA3FF]", icon: "💻" },
  { slug: "economy",       name: "Economy",       color: "#F7768E", textClass: "text-[#F7768E]", ringClass: "ring-[#F7768E]", icon: "📈" },
  { slug: "entertainment", name: "Entertainment", color: "#FF6FB5", textClass: "text-[#FF6FB5]", ringClass: "ring-[#FF6FB5]", icon: "🎬" },

  // Polish 2 expansion (44 more) — explicit color per slug.
  { slug: "ai",                name: "AI",                color: "#7DD3FC", textClass: "text-[#7DD3FC]", ringClass: "ring-[#7DD3FC]", icon: "🤖" },
  { slug: "stocks",            name: "Stocks",            color: "#FBBF24", textClass: "text-[#FBBF24]", ringClass: "ring-[#FBBF24]", icon: "📊" },
  { slug: "finance",           name: "Finance",           color: "#F59E0B", textClass: "text-[#F59E0B]", ringClass: "ring-[#F59E0B]", icon: "💰" },
  { slug: "elections",         name: "Elections",         color: "#C084FC", textClass: "text-[#C084FC]", ringClass: "ring-[#C084FC]", icon: "🗳️" },
  { slug: "geopolitics",       name: "Geopolitics",       color: "#F87171", textClass: "text-[#F87171]", ringClass: "ring-[#F87171]", icon: "🌐" },
  { slug: "climate",           name: "Climate",           color: "#34D399", textClass: "text-[#34D399]", ringClass: "ring-[#34D399]", icon: "🌍" },
  { slug: "science",           name: "Science",           color: "#60A5FA", textClass: "text-[#60A5FA]", ringClass: "ring-[#60A5FA]", icon: "🧪" },
  { slug: "health",            name: "Health",            color: "#F472B6", textClass: "text-[#F472B6]", ringClass: "ring-[#F472B6]", icon: "🩺" },
  { slug: "covid",             name: "Covid",             color: "#FB7185", textClass: "text-[#FB7185]", ringClass: "ring-[#FB7185]", icon: "🦠" },
  { slug: "gaming",            name: "Gaming",            color: "#A78BFA", textClass: "text-[#A78BFA]", ringClass: "ring-[#A78BFA]", icon: "🎮" },
  { slug: "esports",           name: "Esports",           color: "#8B5CF6", textClass: "text-[#8B5CF6]", ringClass: "ring-[#8B5CF6]", icon: "🕹️" },
  { slug: "movies",            name: "Movies",            color: "#F472B6", textClass: "text-[#F472B6]", ringClass: "ring-[#F472B6]", icon: "🎥" },
  { slug: "tv",                name: "TV",                color: "#FB7185", textClass: "text-[#FB7185]", ringClass: "ring-[#FB7185]", icon: "📺" },
  { slug: "music",             name: "Music",             color: "#F9A8D4", textClass: "text-[#F9A8D4]", ringClass: "ring-[#F9A8D4]", icon: "🎵" },
  { slug: "celebrities",       name: "Celebrities",       color: "#FDE68A", textClass: "text-[#FDE68A]", ringClass: "ring-[#FDE68A]", icon: "🌟" },
  { slug: "fashion",           name: "Fashion",           color: "#E879F9", textClass: "text-[#E879F9]", ringClass: "ring-[#E879F9]", icon: "👗" },
  { slug: "art",               name: "Art",               color: "#FDBA74", textClass: "text-[#FDBA74]", ringClass: "ring-[#FDBA74]", icon: "🎨" },
  { slug: "books",             name: "Books",             color: "#A8A29E", textClass: "text-[#A8A29E]", ringClass: "ring-[#A8A29E]", icon: "📚" },
  { slug: "education",         name: "Education",         color: "#FCD34D", textClass: "text-[#FCD34D]", ringClass: "ring-[#FCD34D]", icon: "🎓" },
  { slug: "startups",          name: "Startups",          color: "#22D3EE", textClass: "text-[#22D3EE]", ringClass: "ring-[#22D3EE]", icon: "🚀" },
  { slug: "vc",                name: "VC",                color: "#06B6D4", textClass: "text-[#06B6D4]", ringClass: "ring-[#06B6D4]", icon: "💼" },
  { slug: "real-estate",       name: "Real Estate",       color: "#84CC16", textClass: "text-[#84CC16]", ringClass: "ring-[#84CC16]", icon: "🏠" },
  { slug: "energy",            name: "Energy",            color: "#EAB308", textClass: "text-[#EAB308]", ringClass: "ring-[#EAB308]", icon: "⚡" },
  { slug: "oil",               name: "Oil",               color: "#CA8A04", textClass: "text-[#CA8A04]", ringClass: "ring-[#CA8A04]", icon: "🛢️" },
  { slug: "commodities",       name: "Commodities",       color: "#D97706", textClass: "text-[#D97706]", ringClass: "ring-[#D97706]", icon: "📦" },
  { slug: "metals",            name: "Metals",            color: "#94A3B8", textClass: "text-[#94A3B8]", ringClass: "ring-[#94A3B8]", icon: "🥇" },
  { slug: "macro",             name: "Macro",             color: "#FBBF24", textClass: "text-[#FBBF24]", ringClass: "ring-[#FBBF24]", icon: "🌎" },
  { slug: "rates",             name: "Rates",             color: "#F59E0B", textClass: "text-[#F59E0B]", ringClass: "ring-[#F59E0B]", icon: "📉" },
  { slug: "inflation",         name: "Inflation",         color: "#FB923C", textClass: "text-[#FB923C]", ringClass: "ring-[#FB923C]", icon: "🔥" },
  { slug: "jobs",              name: "Jobs",              color: "#22C55E", textClass: "text-[#22C55E]", ringClass: "ring-[#22C55E]", icon: "🧑‍💼" },
  { slug: "trade",             name: "Trade",             color: "#10B981", textClass: "text-[#10B981]", ringClass: "ring-[#10B981]", icon: "🚢" },
  { slug: "war",               name: "War",               color: "#DC2626", textClass: "text-[#DC2626]", ringClass: "ring-[#DC2626]", icon: "⚔️" },
  { slug: "space",             name: "Space",             color: "#818CF8", textClass: "text-[#818CF8]", ringClass: "ring-[#818CF8]", icon: "🛰️" },
  { slug: "weather",           name: "Weather",           color: "#38BDF8", textClass: "text-[#38BDF8]", ringClass: "ring-[#38BDF8]", icon: "⛅" },
  { slug: "natural-disasters", name: "Natural Disasters", color: "#EF4444", textClass: "text-[#EF4444]", ringClass: "ring-[#EF4444]", icon: "🌋" },
  { slug: "olympics",          name: "Olympics",          color: "#F59E0B", textClass: "text-[#F59E0B]", ringClass: "ring-[#F59E0B]", icon: "🏅" },
  { slug: "soccer",            name: "Soccer",            color: "#15803D", textClass: "text-[#15803D]", ringClass: "ring-[#15803D]", icon: "⚽" },
  { slug: "nba",               name: "NBA",               color: "#EA580C", textClass: "text-[#EA580C]", ringClass: "ring-[#EA580C]", icon: "🏀" },
  { slug: "nfl",               name: "NFL",               color: "#7F1D1D", textClass: "text-[#7F1D1D]", ringClass: "ring-[#7F1D1D]", icon: "🏈" },
  { slug: "mlb",               name: "MLB",               color: "#0EA5E9", textClass: "text-[#0EA5E9]", ringClass: "ring-[#0EA5E9]", icon: "⚾" },
  { slug: "tennis",            name: "Tennis",            color: "#A3E635", textClass: "text-[#A3E635]", ringClass: "ring-[#A3E635]", icon: "🎾" },
  { slug: "f1",                name: "F1",                color: "#E11D48", textClass: "text-[#E11D48]", ringClass: "ring-[#E11D48]", icon: "🏎️" },
  { slug: "ufc",               name: "UFC",               color: "#B91C1C", textClass: "text-[#B91C1C]", ringClass: "ring-[#B91C1C]", icon: "🥊" },
  { slug: "boxing",            name: "Boxing",            color: "#991B1B", textClass: "text-[#991B1B]", ringClass: "ring-[#991B1B]", icon: "🥊" },

  // General / catch-all
  { slug: "general",           name: "General",           color: "#8B92A8", textClass: "text-[#8B92A8]", ringClass: "ring-[#8B92A8]", icon: "•" },
];

const BY_SLUG: Record<string, CategoryStyle> = RAW.reduce((acc, s) => {
  acc[s.slug.toLowerCase()] = s;
  return acc;
}, {} as Record<string, CategoryStyle>);

export const CATEGORY_STYLE_MAP: Readonly<Record<string, CategoryStyle>> = BY_SLUG;

/**
 * Resolve a slug to its style. Unknown slugs render a styled neutral
 * fallback (label = title-cased slug) so the UI never falls through to
 * a dead grey row — even brand-new DB rows get a usable presentation.
 */
export function getCategoryStyle(slug: string | null | undefined): CategoryStyle {
  if (!slug) {
    return { slug: "general", name: "General", ...NEUTRAL };
  }
  const key = slug.toLowerCase();
  const hit = BY_SLUG[key];
  if (hit) return hit;
  const titleCased = slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { slug, name: titleCased || slug, ...NEUTRAL };
}

export function getAllCategoryStyles(): CategoryStyle[] {
  return RAW;
}
