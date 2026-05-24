/* eslint-disable no-console */
/**
 * Zap seed script.
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Idempotent-ish: uses upsert for users by email; will re-insert markets/posts
 * each run, so wipe tables first if you want a clean slate.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- helpers ---------------------------------------------------------

const FIRST = [
  "Alex","Jordan","Sam","Riley","Casey","Morgan","Avery","Quinn","Drew","Reese",
  "Sky","Cameron","Hayden","Rowan","Parker","Sage","Emerson","Phoenix","River","Blake",
];
const LAST = [
  "Stone","Vega","Cruz","Patel","Kim","Reyes","Hayes","Chen","Wolfe","Singh",
  "Morgan","Pierce","Diaz","Khan","Park","Lopez","Cole","Bennett","Foster","Rivera",
];
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const QUESTIONS_BY_CATEGORY: Record<string, string[]> = {
  politics: [
    "Will the U.S. Senate pass the AI safety bill by Q4?",
    "Will any G7 leader resign before year end?",
    "Will the EU enact new social-media age limits?",
    "Will the U.S. raise the federal minimum wage?",
    "Will a third-party candidate poll above 10% nationally?",
    "Will the UK call an early election?",
    "Will Canada and the U.S. sign a new trade pact?",
    "Will Israel and Saudi Arabia announce diplomatic ties?",
    "Will France's PM survive the next no-confidence vote?",
    "Will the U.S. debt ceiling be raised on time?",
    "Will any U.S. governor be impeached this year?",
    "Will Germany's coalition government dissolve?",
  ],
  crypto: [
    "Will Bitcoin close above $150k by year end?",
    "Will Ethereum implement another major upgrade this year?",
    "Will a U.S. spot Solana ETF be approved?",
    "Will any top-10 stablecoin de-peg by >2%?",
    "Will a major exchange file for bankruptcy?",
    "Will the SEC drop its case against Coinbase?",
    "Will Tether publish a full audit before December?",
    "Will Bitcoin's hashrate hit 1 ZH/s?",
    "Will a new memecoin enter the top 20 by market cap?",
    "Will Ripple win its appeal?",
    "Will ETH/BTC return to 0.06?",
    "Will MicroStrategy add another 10k BTC?",
  ],
  sports: [
    "Will the Lakers make the NBA Finals?",
    "Will Manchester City win the Premier League?",
    "Will Verstappen win another F1 title?",
    "Will the U.S. men's team qualify for the World Cup?",
    "Will any MLB team break the 116-win record?",
    "Will Djokovic win another Grand Slam this year?",
    "Will the Chiefs three-peat as Super Bowl champs?",
    "Will Caitlin Clark win Rookie of the Year?",
    "Will an underdog seed reach the Final Four?",
    "Will Real Madrid win the Champions League?",
    "Will Mbappé score 30+ La Liga goals?",
    "Will the Olympics host city be announced for 2036?",
  ],
  tech: [
    "Will Apple ship an AR headset under $1500 this year?",
    "Will OpenAI release GPT-6?",
    "Will Tesla deliver a fully self-driving robotaxi?",
    "Will Meta hit 4B monthly active users?",
    "Will any AI lab announce AGI?",
    "Will Google split Search from Ads?",
    "Will Microsoft acquire another AI startup over $10B?",
    "Will the U.S. ban TikTok?",
    "Will Nvidia hit a $5T market cap?",
    "Will quantum computing achieve commercial advantage?",
    "Will SpaceX land humans on the Moon this year?",
    "Will any major chipmaker open a U.S. fab?",
  ],
  economy: [
    "Will U.S. CPI come in under 2.5% YoY by Q4?",
    "Will the Fed cut rates 3+ times this year?",
    "Will the U.S. enter a recession by Q3?",
    "Will the unemployment rate exceed 5%?",
    "Will the S&P 500 close above 7000?",
    "Will oil prices average above $90/bbl?",
    "Will the yen strengthen below 130/USD?",
    "Will China's GDP growth exceed 5%?",
    "Will any major bank fail this year?",
    "Will gold close above $3000/oz?",
    "Will housing starts increase YoY?",
    "Will U.S. wage growth slow below 3%?",
  ],
  entertainment: [
    "Will a sequel cross $2B at the global box office?",
    "Will Taylor Swift announce another world tour?",
    "Will any streaming service hit 400M subscribers?",
    "Will the next Marvel movie open at #1?",
    "Will a video game adaptation win an Emmy?",
    "Will Beyoncé release a new album this year?",
    "Will Disney announce another major acquisition?",
    "Will any film win 7+ Oscars?",
    "Will Netflix's password-sharing crackdown boost subscribers?",
    "Will a K-pop group headline Coachella?",
    "Will the Grammys add a new genre category?",
    "Will any director announce retirement after a record-breaking film?",
  ],
  general: [
    "Will a new social network reach 100M users?",
    "Will SpaceX launch Starship to orbit and recover?",
    "Will any country adopt a 4-day work week law?",
    "Will commercial fusion energy hit net positive?",
    "Will any vaccine for a top-10 cancer be approved?",
    "Will autonomous robotaxis serve 1M rides per day?",
    "Will any major airline ban single-use plastics?",
    "Will Antarctic ice extent set a new record low?",
    "Will any country mine the Moon?",
    "Will a robot win a sports competition vs humans?",
    "Will any city ban gas-powered cars?",
    "Will a household name CEO step down unexpectedly?",
  ],
};

const POST_BODIES = [
  "<p>This market is mispriced. The base rate is way off.</p>",
  "<p>Calling it now — YES is the move. Volume's been climbing for hours.</p>",
  "<p>Reminder: just because something <em>feels</em> obvious doesn't mean the market agrees. Check the price.</p>",
  "<p>Big news dropping later this week could swing this 20 points either direction.</p>",
  "<p>Liquidity dried up overnight. Spreads widened, which usually means smart money is repositioning.</p>",
  "<p>I'm going against the crowd here. The historical comp from 2022 favors NO.</p>",
  "<p>If you're new — start with low-stake markets first. The fee structure punishes mistakes.</p>",
  "<p>Watching the order book on this one is like watching a slow-motion train wreck.</p>",
  "<p>Hot take: the consensus is already priced in. The asymmetry is on the other side.</p>",
  "<p>Just opened a position. Will let it ride through resolution.</p>",
];

// --- main ------------------------------------------------------------

async function main() {
  console.log("→ Loading categories…");
  const { data: categories, error: catErr } = await sb
    .from("categories")
    .select("id, slug");
  if (catErr || !categories?.length) {
    throw new Error(
      "Categories not found. Run migration 0001_init.sql first. " +
        (catErr?.message ?? ""),
    );
  }
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  console.log(`  found ${categories.length} categories`);

  console.log("→ Seeding 20 users…");
  const userIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const username = `${first.toLowerCase()}${last.toLowerCase()}${rand(10, 99)}`;
    const email = `${username}@seed.zap`;
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: "zapzapzap",
      email_confirm: true,
      user_metadata: { name: `${first} ${last}`, username },
    });
    if (error) {
      // Likely already exists — look up the existing user.
      const { data: list } = await sb.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === email);
      if (existing) userIds.push(existing.id);
      else throw error;
    } else if (data.user) {
      userIds.push(data.user.id);
    }
  }
  console.log(`  ${userIds.length} users ready`);

  console.log("→ Seeding markets (12 per category)…");
  const marketIds: string[] = [];
  for (const [slug, qs] of Object.entries(QUESTIONS_BY_CATEGORY)) {
    const categoryId = catBySlug.get(slug);
    if (!categoryId) continue;
    const rows = qs.map((question) => {
      const yes = rand(20, 80);
      const days = rand(7, 120);
      return {
        question,
        description: `Resolves on the official outcome reported by reputable sources.`,
        category_id: categoryId,
        resolution_date: new Date(
          Date.now() + days * 24 * 60 * 60 * 1000,
        ).toISOString(),
        yes_price: yes,
        no_price: 100 - yes,
        total_volume: rand(2000, 80000),
        status: "open" as const,
        created_by: pick(userIds),
      };
    });
    const { data: inserted, error } = await sb
      .from("markets")
      .insert(rows)
      .select("id");
    if (error) throw error;
    if (inserted) marketIds.push(...inserted.map((m) => m.id));
  }
  console.log(`  ${marketIds.length} markets created`);

  console.log("→ Seeding 30 posts…");
  const postRows = Array.from({ length: 30 }).map(() => {
    const categorySlug = pick(Object.keys(QUESTIONS_BY_CATEGORY));
    const categoryId = catBySlug.get(categorySlug)!;
    return {
      author_id: pick(userIds),
      body_html: pick(POST_BODIES),
      category_id: categoryId,
      market_id: Math.random() > 0.5 ? pick(marketIds) : null,
      images: [],
      likes: rand(0, 80),
      comments_count: 0,
      shares: rand(0, 20),
      exposure_score: Math.random(),
    };
  });
  const { error: postErr } = await sb.from("posts").insert(postRows);
  if (postErr) throw postErr;
  console.log(`  30 posts created`);

  console.log("✓ Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
