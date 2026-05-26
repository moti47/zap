import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser, NotSignedInError } from "@/lib/auth";

const cache = new Map<string, { summary: string; expires: number }>();
const TTL_MS = 10 * 60 * 1000;

function richFallback(args: {
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  history?: number[];
  topYesHolderShares?: number;
  topNoHolderShares?: number;
}): string {
  const { question, category, yesPrice, noPrice, history, topYesHolderShares, topNoHolderShares } = args;
  // Trend
  let trend: "rising" | "falling" | "flat" = "flat";
  let pctMove = 0;
  if (history && history.length >= 5) {
    const start = history[Math.max(0, history.length - 7)];
    const end = history[history.length - 1];
    pctMove = ((end - start) / Math.max(1, start)) * 100;
    if (pctMove > 2) trend = "rising";
    else if (pctMove < -2) trend = "falling";
  }

  const consensusSide = yesPrice >= 60 ? "YES" : noPrice >= 60 ? "NO" : "mixed";
  const consensusPrice = consensusSide === "YES" ? yesPrice : noPrice;

  // Asymmetry of conviction
  const holderRatio =
    topYesHolderShares && topNoHolderShares
      ? topYesHolderShares / Math.max(1, topNoHolderShares)
      : 1;
  const conviction =
    holderRatio > 1.4
      ? "YES whales dominate the order book"
      : holderRatio < 0.7
      ? "NO holders are sized larger than YES"
      : "size on both sides is balanced";

  const trendCopy =
    trend === "rising"
      ? `YES has rallied ${Math.abs(pctMove).toFixed(1)}% over the last week as flows lean into the thesis`
      : trend === "falling"
      ? `YES has slipped ${Math.abs(pctMove).toFixed(1)}% over the last week as conviction fades`
      : `the market has traded sideways over the last week`;

  const tail =
    category === "crypto"
      ? "Watch for an on-chain or ETF flow catalyst before resolution."
      : category === "politics"
      ? "Polling and primary-window news are the key signals to watch."
      : category === "economy"
      ? "The next data print is the dominant signal — be wary of pre-print drift."
      : category === "sports"
      ? "Health, schedule strength, and head-to-head data are the moving parts."
      : category === "tech"
      ? "Watch for product announcements, leaks, or shipping signals from the team."
      : "Watch for an official announcement from the artist or label.";

  if (consensusSide === "mixed") {
    return `The market is genuinely undecided at YES ${yesPrice}¢ / NO ${noPrice}¢ — ${trendCopy}, and ${conviction}. ${tail}`;
  }
  return `Consensus leans ${consensusSide} at ${consensusPrice}¢ — ${trendCopy}, and ${conviction}. ${tail}`;
}

export async function POST(req: NextRequest) {
  // Gate the LLM endpoint behind auth so anonymous traffic can't burn
  // platform Anthropic credits. The cache also reduces hot-path cost.
  const haveSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (haveSupabaseEnv) {
    try {
      await requireUser();
    } catch (err) {
      if (err instanceof NotSignedInError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      throw err;
    }
  }
  const body = await req.json();
  const {
    marketId,
    question,
    category,
    currentYesPrice,
    currentNoPrice,
    priceHistory,
    topYesHolderShares,
    topNoHolderShares,
  } = body;

  const cacheKey = `${marketId}-${currentYesPrice}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > now) {
    return NextResponse.json({ summary: cached.summary, source: "cache" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let summary: string;

  if (!apiKey) {
    summary = richFallback({
      question,
      category,
      yesPrice: currentYesPrice,
      noPrice: currentNoPrice,
      history: priceHistory,
      topYesHolderShares,
      topNoHolderShares,
    });
  } else {
    try {
      const client = new Anthropic({ apiKey });
      const last7 = (priceHistory ?? []).slice(-7).join("¢ → ");
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 240,
        system:
          "You are a prediction-market analyst writing concise market-state summaries for traders. Output exactly 2 sentences, no preamble. First sentence: where the market is and how sentiment moved. Second sentence: what traders should actually watch (catalyst, data print, news source). Be confident and specific — no hedging like 'it's worth noting' or 'time will tell.'",
        messages: [
          {
            role: "user",
            content: `Market: "${question}"
Category: ${category}
Current: YES ${currentYesPrice}¢ · NO ${currentNoPrice}¢
Last 7-day YES price path: ${last7 || "n/a"}
Top YES holder size: ${topYesHolderShares ?? "n/a"}
Top NO holder size: ${topNoHolderShares ?? "n/a"}

Write your 2-sentence summary.`,
          },
        ],
      });
      const block = msg.content[0];
      summary =
        block && block.type === "text"
          ? block.text.trim()
          : richFallback({
              question,
              category,
              yesPrice: currentYesPrice,
              noPrice: currentNoPrice,
              history: priceHistory,
              topYesHolderShares,
              topNoHolderShares,
            });
    } catch (e) {
      console.error("AI summary error:", e);
      summary = richFallback({
        question,
        category,
        yesPrice: currentYesPrice,
        noPrice: currentNoPrice,
        history: priceHistory,
        topYesHolderShares,
        topNoHolderShares,
      });
    }
  }

  cache.set(cacheKey, { summary, expires: now + TTL_MS });
  return NextResponse.json({ summary, source: apiKey ? "claude" : "fallback" });
}
