import { avatarUrl, generatePriceHistory } from "./utils";

export type Category =
  | "politics"
  | "crypto"
  | "sports"
  | "tech"
  | "economy"
  | "entertainment";

export const CATEGORIES: Category[] = [
  "politics",
  "crypto",
  "sports",
  "tech",
  "economy",
  "entertainment",
];

export type ExpertScores = Partial<Record<Category, number>>;

export interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  bio: string;
  joined: string;
  followers: number;
  following: number;
  totalPredictions: number;
  pointsWon: number;
  expertScores: ExpertScores;
  brierScores: Partial<Record<Category, number>>;
  predictionsByCategory: Partial<Record<Category, number>>;
  primaryCategory: Category;
  verified: boolean;
  calibration: { bucket: number; predicted: number; actual: number; count: number }[];
}

export interface Market {
  id: string;
  question: string;
  description: string;
  category: Category;
  resolutionDate: string;
  resolutionSource: string;
  createdAt: string;
  currentYesPrice: number;
  currentNoPrice: number;
  volume24h: number;
  totalVolume: number;
  traders: number;
  priceHistory: { timestamp: string; yesPrice: number }[];
  topHolders: {
    yes: { userId: string; shares: number; avgPrice: number }[];
    no: { userId: string; shares: number; avgPrice: number }[];
  };
  imageUrl?: string;
}

export interface PostBase {
  id: string;
  userId: string;
  createdAt: string;
  body: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface PredictionPost extends PostBase {
  type: "prediction";
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  avgPrice: number;
  staked: number;
  pnl?: number;
  pnlPct?: number;
}

export interface MarketPost extends PostBase {
  type: "market";
  marketId: string;
}

export interface MarketLaunchPost extends PostBase {
  type: "launch";
  marketId: string;
}

export interface GeneralPost extends PostBase {
  type: "general";
  category?: Category;
}

export type Post = PredictionPost | MarketPost | MarketLaunchPost | GeneralPost;

export interface Trade {
  id: string;
  marketId: string;
  userId: string;
  side: "YES" | "NO";
  shares: number;
  price: number;
  timestamp: string;
}

export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  body: string;
  createdAt: string;
  likes: number;
  position?: { side: "YES" | "NO"; shares: number; avgPrice: number };
}

const CURRENT_USER_ID = "u-current";

function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = pseudoRandom(20250521);

const NAMES = [
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
] as const;

function makeCalibration(skew: number) {
  // skew = -1 underconfident, 0 perfect, +1 overconfident
  const buckets: { bucket: number; predicted: number; actual: number; count: number }[] = [];
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
  const primaryCat = primary as Category;
  const expertScores: ExpertScores = {};
  const brierScores: Partial<Record<Category, number>> = {};
  const predictionsByCategory: Partial<Record<Category, number>> = {};
  CATEGORIES.forEach((cat) => {
    const base = cat === primaryCat ? 75 : 45;
    const score = Math.min(99, Math.max(20, Math.round(base + (rng() - 0.3) * 28)));
    expertScores[cat] = score;
    brierScores[cat] = Math.round((0.4 - score / 400) * 1000) / 1000;
    predictionsByCategory[cat] = Math.floor(rng() * (cat === primaryCat ? 280 : 60)) + 5;
  });
  const skew = (rng() - 0.5) * 1.4;
  return {
    id,
    username,
    name,
    avatarUrl: avatarUrl(username, "shapes"),
    bio:
      idx % 4 === 0
        ? `Trading ${primaryCat} markets since 2022. Mostly right, occasionally early.`
        : idx % 4 === 1
        ? `${primaryCat[0].toUpperCase()}${primaryCat.slice(1)} obsessive. Calibrated > confident.`
        : idx % 4 === 2
        ? `Former analyst → full-time predictor. Lean into edges others ignore.`
        : `I trade on what I'd bet real money on. Skin in the game.`,
    joined: new Date(2023, Math.floor(rng() * 12), Math.floor(rng() * 28) + 1).toISOString(),
    followers: Math.floor(rng() * 18000) + 200,
    following: Math.floor(rng() * 400) + 40,
    totalPredictions:
      CATEGORIES.reduce((a, c) => a + (predictionsByCategory[c] ?? 0), 0),
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
  avatarUrl: avatarUrl("you", "shapes"),
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

// ---------------- Markets ----------------

const MARKET_DEFS: {
  question: string;
  description: string;
  category: Category;
  daysOut: number;
  resolutionSource: string;
  startPrice: number;
  vol: number;
}[] = [
  {
    question: "Will Bitcoin close above $200,000 by December 31, 2026?",
    description:
      "Resolves YES if BTC/USD closes above $200,000 on any major exchange on or before Dec 31, 2026 UTC.",
    category: "crypto",
    daysOut: 224,
    resolutionSource: "Coinbase BTC-USD daily close",
    startPrice: 38,
    vol: 1_245_000,
  },
  {
    question: "Will ETH close above 5,000 by July 31, 2026?",
    description:
      "Resolves YES if ETH/USD closes above $5,000 on a daily candle on or before July 31, 2026.",
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
    description:
      "Resolves YES if OpenAI publicly releases a product branded as GPT-6 (or successor explicitly marked as next major version) before Dec 31, 2026.",
    category: "tech",
    daysOut: 224,
    resolutionSource: "Official OpenAI announcement",
    startPrice: 42,
    vol: 612_000,
  },
  {
    question: "Will May CPI come in below 3.2% headline?",
    description:
      "Resolves YES if the BLS-reported headline CPI year-over-year for May 2026 is below 3.2%.",
    category: "economy",
    daysOut: 22,
    resolutionSource: "BLS CPI release",
    startPrice: 58,
    vol: 2_180_000,
  },
  {
    question: "Will the Fed cut rates by 25bps at the June FOMC?",
    description:
      "Resolves YES if the Federal Reserve announces a 25bps cut to the federal funds target at the June 2026 FOMC meeting.",
    category: "economy",
    daysOut: 47,
    resolutionSource: "FOMC statement",
    startPrice: 52,
    vol: 1_640_000,
  },
  {
    question: "Will the next NYC mayoral primary winner be a Democrat?",
    description:
      "Resolves YES if a Democratic candidate wins the next NYC mayoral primary election.",
    category: "politics",
    daysOut: 92,
    resolutionSource: "NYC Board of Elections",
    startPrice: 84,
    vol: 540_000,
  },
  {
    question: "Will Manchester City win the Premier League this season?",
    description:
      "Resolves YES if Manchester City finishes 1st in the 2025-26 Premier League final table.",
    category: "sports",
    daysOut: 38,
    resolutionSource: "Premier League final table",
    startPrice: 33,
    vol: 720_000,
  },
  {
    question: "Will Apple announce a folding iPhone by WWDC 2026?",
    description:
      "Resolves YES if Apple announces or unveils a foldable iPhone product at or before WWDC 2026.",
    category: "tech",
    daysOut: 14,
    resolutionSource: "Apple official announcement",
    startPrice: 18,
    vol: 290_000,
  },
  {
    question: "Will Taylor Swift announce a 2026 stadium tour?",
    description:
      "Resolves YES if Taylor Swift officially announces a 2026 stadium tour with confirmed dates before resolution.",
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

const NOW = Date.now();

export const markets: Market[] = MARKET_DEFS.map((m, idx) => {
  const id = `m-${idx + 1}`;
  const yesPrice = m.startPrice;
  const noPrice = 100 - yesPrice;
  const history = generatePriceHistory(yesPrice, 30, 5);
  // Force last point to current price
  history[history.length - 1] = {
    timestamp: new Date(NOW).toISOString(),
    yesPrice,
  };

  const yesHolders = users.slice(0, 5).map((u, i) => ({
    userId: u.id,
    shares: Math.floor(rng() * 8000) + 800,
    avgPrice: Math.round(yesPrice + (rng() - 0.5) * 10),
  }));
  const noHolders = users.slice(5, 10).map((u, i) => ({
    userId: u.id,
    shares: Math.floor(rng() * 6000) + 600,
    avgPrice: Math.round(noPrice + (rng() - 0.5) * 10),
  }));

  return {
    id,
    question: m.question,
    description: m.description,
    category: m.category,
    resolutionDate: new Date(NOW + m.daysOut * 86400000).toISOString(),
    resolutionSource: m.resolutionSource,
    createdAt: new Date(NOW - 30 * 86400000).toISOString(),
    currentYesPrice: yesPrice,
    currentNoPrice: noPrice,
    volume24h: Math.floor(m.vol * 0.06),
    totalVolume: m.vol,
    traders: Math.floor(m.vol / 250),
    priceHistory: history,
    topHolders: { yes: yesHolders, no: noHolders },
  };
});

export function getMarket(id: string): Market | undefined {
  return markets.find((m) => m.id === id);
}

// ---------------- Posts ----------------

const POST_BODIES: { type: Post["type"]; text: string; cat?: Category }[] = [
  {
    type: "prediction",
    text:
      "I think the market is sleeping on this one. The Fed has been telegraphing this cut for 8 weeks and the futures curve is already 70% pricing it in. The downside if I'm wrong is small — the YES contract pays out 2:1 from here. Loading up.",
  },
  {
    type: "prediction",
    text:
      "ETH at 28¢ for clearing 5K by July is a steal IF you believe in the ETF flow narrative. I don't. Inflows have slowed every week for 5 weeks. Buying NO with conviction.",
  },
  {
    type: "general",
    text:
      "Lakers without LeBron for the playoff push is structurally different. They're 4-9 this season when he sits and the West has gotten harder, not softer. Market is sleeping on a play-in scenario.",
    cat: "sports",
  },
  {
    type: "general",
    text:
      "Hot take that everyone hates: the next 18 months of agentic AI are going to be 80% disappointing demos and 20% genuinely useful internal tooling. The valuation gap closes when the demos stop landing. Not a position — just a vibe.",
    cat: "tech",
  },
  {
    type: "prediction",
    text:
      "CPI print prediction: 3.1% headline, 3.4% core. Markets are pricing in something hotter and I think they're wrong — shelter is finally rolling over, used cars are flat, and energy is barely contributing. This is the print that gets us a July cut.",
  },
  {
    type: "general",
    text:
      "A reminder that \"the polling is tightening\" is the most overused phrase in cable news. Polls always tighten in the last three weeks because undecideds break and pollsters adjust likely-voter screens. It's a feature of the process, not a signal. Don't trade on it without checking your sample.",
    cat: "politics",
  },
  {
    type: "launch",
    text: "New market just dropped — and the price is moving fast. Get in early or watch from the sidelines.",
  },
  {
    type: "prediction",
    text:
      "Bought into the BTC-200K market. Not because I think we'll hit it, but because at 38¢ the implied 38% feels low given the ETF setup and election cycle dynamics.",
  },
  {
    type: "general",
    text:
      "Reading 12 newsletters a day and 3 of them said the exact same Taylor Swift tour rumor today. When the narrative clusters this fast in entertainment, it usually means something is about to be announced.",
    cat: "entertainment",
  },
  {
    type: "market",
    text: "Quietly the most interesting market on Zap right now. Resolution source is unusually clean too.",
  },
  {
    type: "prediction",
    text:
      "I've been wrong twice on Lakers playoff seeding markets. Third time's the charm — they've quietly won 7 of 10, AD is healthy, and the schedule from here is the softest in the West.",
  },
  {
    type: "general",
    text:
      "Anyone else feel like the BTC dominance chart is doing something different this cycle? Usually we see dom collapse during alt season. This time it's holding above 56% even as alts pump. Could be the ETF effect — institutional money goes to BTC and stays.",
    cat: "crypto",
  },
  {
    type: "prediction",
    text:
      "Selling my NYC mayor YES position. 84¢ feels rich for what's a 12-week event and the only way it doesn't resolve YES is a black swan. Locking in the 22% gain.",
  },
  {
    type: "market",
    text: "If you've ever wanted to bet on a Fed decision, this is the cleanest expression I've seen. Resolves on FOMC statement, no ambiguity.",
  },
  {
    type: "general",
    text:
      "Calibration thread: I went back through my last 200 trades and bucketed them by my predicted probability. The buckets I'm best calibrated on are 60-70% — I'm right 67% of the time when I say 65%. The buckets where I'm WORST: 80%+. I'm right only 71% of the time when I say 90%. Lesson: I'm overconfident on \"sure things.\"",
  },
  {
    type: "prediction",
    text:
      "Apple foldable iPhone at 18¢ is dumb-cheap. WWDC is 14 days away and the leaks have been getting more specific. Loading the boat.",
  },
  {
    type: "general",
    text:
      "Friendly reminder: a 60% market doesn't mean \"the thing will happen.\" It means a market full of people who care enough to put points down think it's 60% likely. Don't confuse market price with truth.",
  },
  {
    type: "prediction",
    text:
      "Man City NO at 67¢ is interesting because the market hasn't fully priced in the squad depth issues. They've shipped 8 goals in their last 5. I don't love the price but the trend is wrong-direction.",
  },
  {
    type: "launch",
    text: "Just opened — first 50 traders get an extra 5⚡ on their first position. Speed matters here.",
  },
  {
    type: "general",
    text:
      "I've stopped reading analyst PDFs and started reading prediction markets. The discipline of having to *bet* on your view filters out 90% of the bullshit.",
    cat: "economy",
  },
  {
    type: "prediction",
    text:
      "Bought 200 YES on Solana-flips-ETH market. Not because I think it'll happen often — just once is enough for resolution. And SOL DEX volume has spiked twice this month already.",
  },
  {
    type: "market",
    text: "This market has been trading sideways for 11 days. Something has to give. Loading up small in case of breakout.",
  },
  {
    type: "general",
    text:
      "Reminder that prediction markets are NOT a poll. They're a price discovery mechanism with skin in the game. Different incentive structure produces different outputs.",
    cat: "politics",
  },
  {
    type: "prediction",
    text:
      "Long S&P 7000 YES at 57¢. We've already touched 6,800 and the path of least resistance from here is up. Valuations matter less than flows when the Fed is cutting.",
  },
  {
    type: "general",
    text:
      "Anyone else notice the volume on crypto markets has 3x'd in the last 30 days here? Either we're getting smarter users or we're getting a lot of new traders. Either is fine.",
    cat: "crypto",
  },
  {
    type: "prediction",
    text:
      "GPT-6 by EOY? Buying YES at 42. OpenAI has been shipping faster than anyone expected and they need a tentpole launch to maintain narrative momentum into 2027.",
  },
  {
    type: "general",
    text:
      "I just realized I make better predictions when I'm slightly skeptical of my own confidence. Putting that into practice this week — anything I would normally bet 200 on, I'm betting 100.",
  },
  {
    type: "prediction",
    text:
      "Sold my Taylor Swift tour YES at 62. Catalyst is uncertain timing and the resolution rules are looser than I'd like. Took the win.",
  },
  {
    type: "market",
    text: "Quietly closing in 14 days and still 18¢. Someone's mispricing this — or I am.",
  },
  {
    type: "general",
    text:
      "Tip for new traders: never trade a market you don't understand the resolution criteria for. Read the source. Twice. I've lost more on technicalities than on being wrong.",
  },
];

// distribute posts across users + markets
function distributePosts(): Post[] {
  const out: Post[] = [];
  POST_BODIES.forEach((spec, idx) => {
    const userIdx = (idx * 7) % users.length;
    const user = users[userIdx];
    const marketIdx = idx % markets.length;
    const market = markets[marketIdx];
    const minutesAgo = (idx + 1) * 9 + Math.floor(rng() * 30);
    const createdAt = new Date(NOW - minutesAgo * 60_000).toISOString();
    const baseShape: PostBase = {
      id: `p-${idx + 1}`,
      userId: user.id,
      createdAt,
      body: spec.text,
      likes: Math.floor(rng() * 480) + 18,
      comments: Math.floor(rng() * 140) + 4,
      shares: Math.floor(rng() * 80) + 2,
      views: Math.floor(rng() * 9000) + 600,
    };
    if (spec.type === "prediction") {
      const side: "YES" | "NO" = rng() > 0.4 ? "YES" : "NO";
      const price =
        side === "YES" ? market.currentYesPrice : market.currentNoPrice;
      const shares = Math.floor(rng() * 700) + 80;
      const staked = Math.round((shares * price) / 100);
      const pnlPct = (rng() - 0.4) * 30;
      const pnl = (staked * pnlPct) / 100;
      out.push({
        ...baseShape,
        type: "prediction",
        marketId: market.id,
        side,
        shares,
        avgPrice: price + Math.floor((rng() - 0.5) * 6),
        staked,
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: Math.round(pnlPct * 10) / 10,
      });
    } else if (spec.type === "market") {
      out.push({ ...baseShape, type: "market", marketId: market.id });
    } else if (spec.type === "launch") {
      out.push({ ...baseShape, type: "launch", marketId: market.id });
    } else {
      out.push({ ...baseShape, type: "general", category: spec.cat });
    }
  });
  return out;
}

export const posts: Post[] = distributePosts();

// ---------------- Per-post seeded comments ----------------

const SEED_COMMENT_BODIES = [
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
  "Mark this comment — I called this exact level a week ago.",
  "Can't believe this is still mispriced. Loading up.",
  "Disagree with the framing but the trade is interesting.",
  "Quote-tweeted with my own analysis. Mostly agree.",
];

export interface SeededComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likes: number;
  parentId?: string | null;
}

export const seededComments: Record<string, SeededComment[]> = {};

posts.forEach((p, idx) => {
  const count = 3 + Math.floor(rng() * 5);
  const list: SeededComment[] = [];
  for (let i = 0; i < count; i++) {
    const author = users[(idx * 3 + i * 5) % users.length];
    list.push({
      id: `seed-c-${p.id}-${i}`,
      postId: p.id,
      authorId: author.id,
      body: SEED_COMMENT_BODIES[(idx * 2 + i) % SEED_COMMENT_BODIES.length],
      createdAt: new Date(NOW - (i + 1) * 4 * 60_000).toISOString(),
      likes: Math.floor(rng() * 24),
      parentId: null,
    });
  }
  // Seed 1-3 nested replies so the tree UI actually has something to show.
  if (list.length >= 2) {
    const nestedCount = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < nestedCount; j++) {
      const parent = list[(idx + j) % list.length];
      const author = users[(idx * 7 + j * 11 + 3) % users.length];
      const child: SeededComment = {
        id: `seed-c-${p.id}-r${j}`,
        postId: p.id,
        authorId: author.id,
        body: SEED_COMMENT_BODIES[
          (idx + j + 4) % SEED_COMMENT_BODIES.length
        ],
        createdAt: new Date(
          new Date(parent.createdAt).getTime() + (j + 1) * 60_000
        ).toISOString(),
        likes: Math.floor(rng() * 12),
        parentId: parent.id,
      };
      list.push(child);

      // Half the time, nest a reply-to-reply for the 3-level demo.
      if (j === 0 && rng() > 0.4) {
        const author2 = users[(idx * 13 + j * 5 + 6) % users.length];
        list.push({
          id: `seed-c-${p.id}-r${j}-r0`,
          postId: p.id,
          authorId: author2.id,
          body: SEED_COMMENT_BODIES[
            (idx + j + 8) % SEED_COMMENT_BODIES.length
          ],
          createdAt: new Date(
            new Date(child.createdAt).getTime() + 60_000
          ).toISOString(),
          likes: Math.floor(rng() * 6),
          parentId: child.id,
        });
      }
    }
  }
  seededComments[p.id] = list;
  p.comments = list.length;
});

// ---------------- Trades (live activity feed) ----------------

export function generateTrades(count: number = 40): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < count; i++) {
    const market = markets[Math.floor(rng() * markets.length)];
    const user = users[Math.floor(rng() * users.length)];
    const side: "YES" | "NO" = rng() > 0.5 ? "YES" : "NO";
    const basePrice = side === "YES" ? market.currentYesPrice : market.currentNoPrice;
    const price = Math.max(1, Math.min(99, basePrice + Math.floor((rng() - 0.5) * 4)));
    out.push({
      id: `t-${i + 1}`,
      marketId: market.id,
      userId: user.id,
      side,
      shares: Math.floor(rng() * 500) + 20,
      price,
      timestamp: new Date(NOW - i * 35_000).toISOString(),
    });
  }
  return out;
}

export const recentTrades = generateTrades(40);

// ---------------- Comments ----------------

const COMMENT_BODIES = [
  "Lol price action says you're right",
  "I'm on the other side of this. May the best calibrated win.",
  "Resolution criteria is tighter than people think. Read it twice.",
  "Volume is exploding on this. Something's brewing.",
  "Just doubled my position at this price. Conviction high.",
  "Selling into strength. Up 22%, taking the W.",
  "The chart says reversal. The fundamentals say continuation. I trust the chart.",
  "Anyone have a model for this? Sharing or trading is fine, I'll send back my own.",
  "I'm fading the consensus here. Too many people piled in too fast.",
  "Mark this comment — I'm calling 60c by end of week.",
  "If you can't explain why this isn't already priced in, you're probably wrong.",
  "Holding NO. The narrative looks good but the source data doesn't support it.",
];

export function commentsForMarket(marketId: string): Comment[] {
  const out: Comment[] = [];
  COMMENT_BODIES.forEach((body, i) => {
    const u = users[(i * 3) % users.length];
    out.push({
      id: `c-${marketId}-${i}`,
      marketId,
      userId: u.id,
      body,
      createdAt: new Date(NOW - i * 600_000).toISOString(),
      likes: Math.floor(rng() * 90) + 2,
      position:
        i % 3 === 0
          ? {
              side: i % 2 === 0 ? "YES" : "NO",
              shares: Math.floor(rng() * 400) + 50,
              avgPrice: Math.floor(rng() * 60) + 20,
            }
          : undefined,
    });
  });
  return out;
}

// ---------------- Related markets helper ----------------

export function relatedMarkets(marketId: string, n: number = 4): Market[] {
  const target = getMarket(marketId);
  if (!target) return [];
  return markets
    .filter((m) => m.id !== marketId && m.category === target.category)
    .slice(0, n);
}

// ---------------- Notifications (header bell) ----------------

export interface Notification {
  id: string;
  type: "trade" | "follow" | "resolution" | "comment";
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
}

export const notifications: Notification[] = [
  {
    id: "n-1",
    type: "trade",
    title: "Your YES on May CPI moved +6.0%",
    body: "Current value: 58⚡ · Up 22.40⚡ (11.3%)",
    timestamp: new Date(NOW - 4 * 60_000).toISOString(),
    unread: true,
  },
  {
    id: "n-2",
    type: "follow",
    title: "Sarah Kowalski followed you",
    body: "Crypto expert (94) · 12.3K followers",
    timestamp: new Date(NOW - 22 * 60_000).toISOString(),
    unread: true,
  },
  {
    id: "n-3",
    type: "resolution",
    title: "Market resolved YES",
    body: "Will Bitcoin hit a new ATH in Q1? — You won 420⚡",
    timestamp: new Date(NOW - 3 * 3600_000).toISOString(),
    unread: false,
  },
];

// ---------------- Suggested follows / trending / top experts ----------------

export function topExperts(n: number = 5): User[] {
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

export function trendingMarkets(n: number = 3): Market[] {
  return [...markets].sort((a, b) => b.volume24h - a.volume24h).slice(0, n);
}

export function suggestedFollows(n: number = 4): User[] {
  return [...users]
    .filter((u) => u.followers > 1000)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, n);
}
