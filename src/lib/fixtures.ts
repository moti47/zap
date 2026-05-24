/**
 * Phase 10 — Demo fixtures.
 *
 * `lib/mock-data.ts` (860 lines of seeded fake data) was deleted in
 * Phase 10. Everything that genuinely needs sample content for the
 * prototype demo paths (landing ambient feed, right rail, leaderboard,
 * decorative previews) imports from here instead. Real product surfaces
 * read from Supabase via `lib/db/*`.
 *
 * Keep this file small and honest: the data should clearly be sample
 * content, not production seeds.
 */

import type {
  Market,
  Post,
  Trade,
  User,
  Notification,
  Category,
  SeededComment,
  Comment,
} from "./types";
import { CATEGORIES } from "./types";
import { generatePriceHistory } from "./utils";

// Phase 10 transitional re-exports — every former `@/lib/fixtures` consumer
// now imports types + values from here, so nothing needs to know whether a
// name is a type or a runtime value.
export { CATEGORIES };
export type {
  Market,
  Post,
  PostBase,
  PredictionPost,
  MarketPost,
  MarketLaunchPost,
  GeneralPost,
  Trade,
  User,
  Notification,
  Category,
  ExpertScores,
  SeededComment,
  Comment,
} from "./types";

export const CURRENT_USER_ID = "u-current";

const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

// ---------------- Deterministic RNG so renders are stable across runs

function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rng = pseudoRandom(20250524);

// ---------------- Users

const NAMES: ReadonlyArray<readonly [string, string, Category]> = [
  ["Sarah Kowalski", "skowalski", "crypto"],
  ["Marcus Chen", "marcusc", "economy"],
  ["Jules Tan", "jules", "sports"],
  ["Rohan Bhatt", "rohanbhatt", "tech"],
  ["Mara Reyes", "maracroft", "economy"],
  ["Dani Rosen", "danirosen", "politics"],
  ["Theo Park", "theop", "crypto"],
  ["Alicia Vance", "alicia", "tech"],
  ["Naveen Iyer", "naveen", "politics"],
  ["Yara Osei", "yaraosei", "sports"],
  ["Felix Bauer", "felixb", "economy"],
  ["Priya Singh", "priya", "crypto"],
  ["Owen Carter", "owen", "sports"],
  ["Lena Voss", "lvoss", "tech"],
  ["Diego Marini", "diegom", "politics"],
  ["Iris Tanaka", "irist", "entertainment"],
  ["Kofi Mensah", "kofim", "economy"],
  ["Hana Lee", "hanalee", "crypto"],
  ["Tomás Ruiz", "tomasr", "tech"],
  ["Ava Lindberg", "avalin", "politics"],
];

function makeCalibration(skew: number) {
  const buckets: User["calibration"] = [];
  for (let i = 1; i <= 10; i++) {
    const predicted = i * 10;
    const noise = (rng() - 0.5) * 12;
    const skewEffect = skew * (predicted < 50 ? -5 : 5);
    const actual = Math.max(0, Math.min(100, predicted + noise + skewEffect));
    buckets.push({
      bucket: i,
      predicted,
      actual: Math.round(actual),
      count: Math.floor(rng() * 80) + 20,
    });
  }
  return buckets;
}

export const users: User[] = NAMES.map(([name, username, primary], idx) => {
  const id = `u-${idx + 1}`;
  const primaryCat = primary;
  const expertScores: User["expertScores"] = {};
  const brierScores: User["brierScores"] = {};
  const predictionsByCategory: User["predictionsByCategory"] = {};
  CATEGORIES.forEach((cat) => {
    const base = cat === primaryCat ? 75 : 45;
    const score = Math.min(99, Math.max(20, Math.round(base + (rng() - 0.3) * 28)));
    expertScores[cat] = score;
    brierScores[cat] = Math.round((0.4 - score / 400) * 1000) / 1000;
    predictionsByCategory[cat] =
      Math.floor(rng() * (cat === primaryCat ? 280 : 60)) + 5;
  });
  const skew = (rng() - 0.5) * 1.4;
  return {
    id,
    username,
    name,
    avatarUrl: "",
    bio:
      idx % 4 === 0
        ? `Trading ${primaryCat} markets since 2022. Mostly right, occasionally early.`
        : idx % 4 === 1
          ? `${primaryCat[0].toUpperCase()}${primaryCat.slice(1)} obsessive. Calibrated > confident.`
          : idx % 4 === 2
            ? `Former analyst → full-time predictor. Lean into edges others ignore.`
            : `I trade on what I'd bet real money on. Skin in the game.`,
    joined: new Date(2024, idx % 12, ((idx * 7) % 28) + 1).toISOString(),
    followers: Math.floor(rng() * 18000) + 200,
    following: Math.floor(rng() * 400) + 40,
    totalPredictions: CATEGORIES.reduce(
      (a, c) => a + (predictionsByCategory[c] ?? 0),
      0,
    ),
    pointsWon: Math.floor(rng() * 50000) + 2000,
    expertScores,
    brierScores,
    predictionsByCategory,
    primaryCategory: primaryCat,
    verified: idx < 8,
    calibration: makeCalibration(skew),
  };
});

export const currentUser: User = {
  id: CURRENT_USER_ID,
  username: "you",
  name: "You",
  avatarUrl: "",
  bio: "New here. Watching, learning, predicting.",
  joined: new Date().toISOString(),
  followers: 12,
  following: 0,
  totalPredictions: 0,
  pointsWon: 0,
  expertScores: {
    politics: 50,
    crypto: 50,
    sports: 50,
    tech: 50,
    economy: 50,
    entertainment: 50,
  },
  brierScores: {},
  predictionsByCategory: {},
  primaryCategory: "tech",
  verified: false,
  calibration: makeCalibration(0),
};

export function getUser(id: string): User | undefined {
  if (id === CURRENT_USER_ID) return currentUser;
  return users.find((u) => u.id === id);
}

// ---------------- Markets

const MARKET_DEFS: Array<{
  question: string;
  description: string;
  category: Category;
  daysOut: number;
  resolutionSource: string;
  startPrice: number;
  vol: number;
}> = [
  {
    question: "Will Bitcoin close above $200,000 by December 31, 2026?",
    description: "Resolves YES if BTC/USD closes above $200,000 on any major exchange on or before Dec 31, 2026 UTC.",
    category: "crypto",
    daysOut: 224,
    resolutionSource: "Coinbase BTC-USD daily close",
    startPrice: 38,
    vol: 1_245_000,
  },
  {
    question: "Will ETH close above 5,000 by July 31, 2026?",
    description: "Resolves YES if ETH/USD closes above $5,000 on a daily candle on or before July 31, 2026.",
    category: "crypto",
    daysOut: 71,
    resolutionSource: "Binance ETH-USDT daily close",
    startPrice: 28,
    vol: 842_000,
  },
  {
    question: "Will the Lakers finish top-6 in the Western Conference?",
    description: "Resolves YES if the LA Lakers finish the 2025-26 regular season in seeds 1-6.",
    category: "sports",
    daysOut: 23,
    resolutionSource: "NBA.com final standings",
    startPrice: 41,
    vol: 418_000,
  },
  {
    question: "Will OpenAI release GPT-6 before December 31, 2026?",
    description: "Resolves YES if OpenAI publicly releases a product branded as GPT-6 before Dec 31, 2026.",
    category: "tech",
    daysOut: 224,
    resolutionSource: "Official OpenAI announcement",
    startPrice: 42,
    vol: 612_000,
  },
  {
    question: "Will May CPI come in below 3.2% headline?",
    description: "Resolves YES if the BLS-reported headline CPI year-over-year for May 2026 is below 3.2%.",
    category: "economy",
    daysOut: 22,
    resolutionSource: "BLS CPI release",
    startPrice: 58,
    vol: 2_180_000,
  },
  {
    question: "Will the Fed cut rates by 25bps at the June FOMC?",
    description: "Resolves YES if the Federal Reserve announces a 25bps cut at the June 2026 FOMC meeting.",
    category: "economy",
    daysOut: 47,
    resolutionSource: "FOMC statement",
    startPrice: 52,
    vol: 1_640_000,
  },
  {
    question: "Will the next NYC mayoral primary winner be a Democrat?",
    description: "Resolves YES if a Democratic candidate wins the next NYC mayoral primary election.",
    category: "politics",
    daysOut: 92,
    resolutionSource: "NYC Board of Elections",
    startPrice: 84,
    vol: 540_000,
  },
  {
    question: "Will Manchester City win the Premier League this season?",
    description: "Resolves YES if Manchester City finishes 1st in the 2025-26 Premier League final table.",
    category: "sports",
    daysOut: 38,
    resolutionSource: "Premier League final table",
    startPrice: 33,
    vol: 720_000,
  },
  {
    question: "Will Apple announce a folding iPhone by WWDC 2026?",
    description: "Resolves YES if Apple announces a foldable iPhone product at or before WWDC 2026.",
    category: "tech",
    daysOut: 14,
    resolutionSource: "Apple official announcement",
    startPrice: 18,
    vol: 290_000,
  },
  {
    question: "Will Taylor Swift announce a 2026 stadium tour?",
    description: "Resolves YES if Taylor Swift officially announces a 2026 stadium tour with confirmed dates.",
    category: "entertainment",
    daysOut: 60,
    resolutionSource: "Official artist or label announcement",
    startPrice: 62,
    vol: 187_000,
  },
  {
    question: "Will the S&P 500 close above 7,000 in 2026?",
    description: "Resolves YES if SPX closes above 7000 on any trading day in 2026.",
    category: "economy",
    daysOut: 224,
    resolutionSource: "S&P closing print",
    startPrice: 57,
    vol: 1_975_000,
  },
  {
    question: "Will Solana flip Ethereum in 24h DEX volume any day in 2026?",
    description: "Resolves YES if Solana's 24h DEX volume exceeds Ethereum's on any single day in 2026.",
    category: "crypto",
    daysOut: 224,
    resolutionSource: "DeFiLlama 24h DEX volume",
    startPrice: 47,
    vol: 463_000,
  },
];

export const markets: Market[] = MARKET_DEFS.map((m, idx) => {
  const id = `m-${idx + 1}`;
  const yesPrice = m.startPrice;
  const noPrice = 100 - yesPrice;
  const history = generatePriceHistory(yesPrice, 30, 5);
  history[history.length - 1] = {
    timestamp: iso(0),
    yesPrice,
  };
  return {
    id,
    question: m.question,
    description: m.description,
    category: m.category,
    resolutionDate: iso(m.daysOut * 86_400_000),
    resolutionSource: m.resolutionSource,
    createdAt: iso(-30 * 86_400_000),
    currentYesPrice: yesPrice,
    currentNoPrice: noPrice,
    volume24h: Math.floor(m.vol * 0.06),
    totalVolume: m.vol,
    traders: Math.floor(m.vol / 250),
    priceHistory: history,
    topHolders: {
      yes: users.slice(0, 5).map((u) => ({
        userId: u.id,
        shares: Math.floor(rng() * 8000) + 800,
        avgPrice: Math.round(yesPrice + (rng() - 0.5) * 10),
      })),
      no: users.slice(5, 10).map((u) => ({
        userId: u.id,
        shares: Math.floor(rng() * 6000) + 600,
        avgPrice: Math.round(noPrice + (rng() - 0.5) * 10),
      })),
    },
  };
});

export function getMarket(id: string): Market | undefined {
  return markets.find((m) => m.id === id);
}

// ---------------- Posts

const POST_BODIES: Array<{ type: Post["type"]; text: string; cat?: Category }> = [
  { type: "prediction", text: "I think the market is sleeping on this one. Loading up." },
  { type: "prediction", text: "ETH at 28¢ for clearing 5K by July is a steal IF you believe in the ETF flow narrative. I don't." },
  { type: "general", text: "Lakers without LeBron are structurally different. Play-in is in play.", cat: "sports" },
  { type: "general", text: "Next 18 months of agentic AI: 80% disappointing demos, 20% useful internal tooling.", cat: "tech" },
  { type: "prediction", text: "CPI 3.1% headline, 3.4% core. Shelter is rolling, used cars flat. July cut on the table." },
  { type: "general", text: "\"Polling tightening\" is the most overused phrase in cable news.", cat: "politics" },
  { type: "launch", text: "New market just dropped — and the price is moving fast." },
  { type: "prediction", text: "BTC-200K at 38¢ feels low given the setup. Implied probability mispriced." },
  { type: "general", text: "Reading 12 newsletters. Three said the same Swift tour rumor. Cluster = signal.", cat: "entertainment" },
  { type: "market", text: "Quietly the most interesting market on Zap right now. Clean resolution source." },
  { type: "prediction", text: "Lakers seeding markets: third time's the charm." },
  { type: "general", text: "BTC dominance holding above 56% even during alt season. ETF effect.", cat: "crypto" },
  { type: "prediction", text: "Selling NYC mayor YES at 84¢. Locking in 22%." },
  { type: "market", text: "Cleanest Fed-decision expression I've seen. No ambiguity on resolution." },
];

export const posts: Post[] = POST_BODIES.map((spec, idx) => {
  const user = users[(idx * 7) % users.length];
  const market = markets[idx % markets.length];
  const minutesAgo = (idx + 1) * 9 + Math.floor(rng() * 30);
  const base = {
    id: `p-${idx + 1}`,
    userId: user.id,
    createdAt: iso(-minutesAgo * 60_000),
    body: spec.text,
    likes: Math.floor(rng() * 480) + 18,
    comments: Math.floor(rng() * 140) + 4,
    shares: Math.floor(rng() * 80) + 2,
    views: Math.floor(rng() * 9000) + 600,
  };
  if (spec.type === "prediction") {
    const side: "YES" | "NO" = rng() > 0.4 ? "YES" : "NO";
    const price = side === "YES" ? market.currentYesPrice : market.currentNoPrice;
    const shares = Math.floor(rng() * 700) + 80;
    const staked = Math.round((shares * price) / 100);
    const pnlPct = (rng() - 0.4) * 30;
    const pnl = (staked * pnlPct) / 100;
    return {
      ...base,
      type: "prediction" as const,
      marketId: market.id,
      side,
      shares,
      avgPrice: price + Math.floor((rng() - 0.5) * 6),
      staked,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 10) / 10,
    };
  }
  if (spec.type === "market") {
    return { ...base, type: "market" as const, marketId: market.id };
  }
  if (spec.type === "launch") {
    return { ...base, type: "launch" as const, marketId: market.id };
  }
  return { ...base, type: "general" as const, category: spec.cat };
});

// ---------------- Seeded comment tree

const COMMENT_LINES = [
  "Big if true. Position adjusted.",
  "Fading this. The setup looks priced in.",
  "Loaded YES at the open, looking decent.",
  "Resolution wording matters here — read it twice.",
  "Following you on this category, calling 70%+",
  "I'm taking the other side. May the best calibrated win.",
  "Volume is exploding, something's brewing.",
  "Sold half my position into strength. Took the W.",
  "The chart says reversal. Fundamentals say continuation.",
  "Sharing this with my newsletter — great take.",
];

export const seededComments: Record<string, SeededComment[]> = {};
posts.forEach((p, idx) => {
  const count = 2 + Math.floor(rng() * 3);
  const list: SeededComment[] = [];
  for (let i = 0; i < count; i++) {
    const author = users[(idx * 3 + i * 5) % users.length];
    list.push({
      id: `seed-c-${p.id}-${i}`,
      postId: p.id,
      authorId: author.id,
      body: COMMENT_LINES[(idx * 2 + i) % COMMENT_LINES.length],
      createdAt: iso(-(i + 1) * 4 * 60_000),
      likes: Math.floor(rng() * 24),
      parentId: null,
    });
  }
  if (list.length >= 2) {
    const parent = list[0];
    const author = users[(idx * 7 + 3) % users.length];
    list.push({
      id: `seed-c-${p.id}-r0`,
      postId: p.id,
      authorId: author.id,
      body: COMMENT_LINES[(idx + 4) % COMMENT_LINES.length],
      createdAt: iso(-(2 * 60_000)),
      likes: Math.floor(rng() * 12),
      parentId: parent.id,
    });
  }
  seededComments[p.id] = list;
  p.comments = list.length;
});

// ---------------- Trades

export function generateTrades(count = 40): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < count; i++) {
    const market = markets[Math.floor(rng() * markets.length)];
    const user = users[Math.floor(rng() * users.length)];
    const side: "YES" | "NO" = rng() > 0.5 ? "YES" : "NO";
    const basePrice =
      side === "YES" ? market.currentYesPrice : market.currentNoPrice;
    const price = Math.max(
      1,
      Math.min(99, basePrice + Math.floor((rng() - 0.5) * 4)),
    );
    out.push({
      id: `t-${i + 1}`,
      marketId: market.id,
      userId: user.id,
      side,
      shares: Math.floor(rng() * 500) + 20,
      price,
      timestamp: iso(-i * 35_000),
    });
  }
  return out;
}

export const recentTrades = generateTrades(40);

// ---------------- Market comments (legacy market-tabs path)

const MARKET_COMMENT_LINES = [
  "Lol price action says you're right",
  "I'm on the other side of this.",
  "Resolution criteria is tighter than people think.",
  "Volume is exploding. Something's brewing.",
  "Just doubled my position at this price.",
  "Selling into strength. Up 22%, taking the W.",
];

export function commentsForMarket(marketId: string): Comment[] {
  return MARKET_COMMENT_LINES.map((body, i) => {
    const u = users[(i * 3) % users.length];
    return {
      id: `c-${marketId}-${i}`,
      marketId,
      userId: u.id,
      body,
      createdAt: iso(-i * 600_000),
      likes: Math.floor(rng() * 90) + 2,
      position:
        i % 3 === 0
          ? {
              side: (i % 2 === 0 ? "YES" : "NO") as "YES" | "NO",
              shares: Math.floor(rng() * 400) + 50,
              avgPrice: Math.floor(rng() * 60) + 20,
            }
          : undefined,
    };
  });
}

export function relatedMarkets(marketId: string, n = 4): Market[] {
  const target = getMarket(marketId);
  if (!target) return [];
  return markets
    .filter((m) => m.id !== marketId && m.category === target.category)
    .slice(0, n);
}

// ---------------- Right-rail helpers

export function topExperts(n = 5): User[] {
  return [...users]
    .map((u) => ({
      u,
      score:
        Object.values(u.expertScores).reduce((a, b) => a + (b ?? 0), 0) /
        Math.max(1, Object.values(u.expertScores).length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.u);
}

export function trendingMarkets(n = 3): Market[] {
  return [...markets].sort((a, b) => b.volume24h - a.volume24h).slice(0, n);
}

export function suggestedFollows(n = 4): User[] {
  return [...users]
    .filter((u) => u.followers > 1000)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, n);
}

// ---------------- Notifications (header bell fallback)

export const notifications: Notification[] = [
  {
    id: "n-1",
    type: "trade",
    title: "Your YES on May CPI moved +6.0%",
    body: "Current value: 58⚡ · Up 22.40⚡ (11.3%)",
    timestamp: iso(-4 * 60_000),
    unread: true,
  },
  {
    id: "n-2",
    type: "follow",
    title: "Sarah Kowalski followed you",
    body: "Crypto expert (94) · 12.3K followers",
    timestamp: iso(-22 * 60_000),
    unread: true,
  },
  {
    id: "n-3",
    type: "resolution",
    title: "Market resolved YES",
    body: "Will Bitcoin hit a new ATH in Q1? — You won 420⚡",
    timestamp: iso(-3 * 3_600_000),
    unread: false,
  },
];
