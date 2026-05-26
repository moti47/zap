/**
 * Phase 11+ — Daily quest generator.
 *
 * Every user gets 3 quests per day, deterministically picked from the
 * pool using a seeded RNG keyed on (userId, yyyy-mm-dd). The seed
 * ensures the same user sees the same 3 quests all day, but a different
 * set tomorrow.
 *
 *   - combined daily reward: 80..120 Zaps
 *   - weighted randomness: rare quests appear less often
 *   - avoid recently-shown quests for the same user
 *
 * Quest completion is tracked in a per-day `quest_progress` row.
 */

export type QuestKind =
  | "create_post"
  | "create_post_image"
  | "comment_twice"
  | "like_5"
  | "follow_1"
  | "trade_market"
  | "save_3"
  | "read_10_full"
  | "attach_market"
  | "reply_comment"
  | "share_1"
  | "bookmark_2"
  | "open_profile_3";

export interface QuestDef {
  kind: QuestKind;
  title: string;
  description: string;
  goal: number;
  /** Reward in Zaps; final daily total normalized to 80..120. */
  baseReward: number;
  /** Weight in the random draw (higher = more common). */
  weight: number;
  /** Optional icon hint for the UI. */
  icon: string;
}

export const QUEST_POOL: QuestDef[] = [
  {
    kind: "create_post",
    title: "Publish a post",
    description: "Share a take with the community",
    goal: 1,
    baseReward: 40,
    weight: 1.0,
    icon: "pen",
  },
  {
    kind: "create_post_image",
    title: "Post with an image",
    description: "Attach a visual to your post",
    goal: 1,
    baseReward: 50,
    weight: 0.55,
    icon: "image",
  },
  {
    kind: "comment_twice",
    title: "Leave 2 comments",
    description: "Join the discussion under 2 posts",
    goal: 2,
    baseReward: 30,
    weight: 1.0,
    icon: "message",
  },
  {
    kind: "like_5",
    title: "Like 5 posts",
    description: "Show some love",
    goal: 5,
    baseReward: 20,
    weight: 1.2,
    icon: "heart",
  },
  {
    kind: "follow_1",
    title: "Follow a new user",
    description: "Add someone to your feed",
    goal: 1,
    baseReward: 25,
    weight: 0.8,
    icon: "user-plus",
  },
  {
    kind: "trade_market",
    title: "Trade in a market",
    description: "Take a YES or NO position",
    goal: 1,
    baseReward: 45,
    weight: 0.7,
    icon: "trending",
  },
  {
    kind: "save_3",
    title: "Save 3 posts",
    description: "Bookmark posts you want to revisit",
    goal: 3,
    baseReward: 25,
    weight: 0.9,
    icon: "bookmark",
  },
  {
    kind: "read_10_full",
    title: "Read 10 posts",
    description: "Open and read 10 posts fully",
    goal: 10,
    baseReward: 35,
    weight: 1.0,
    icon: "eye",
  },
  {
    kind: "attach_market",
    title: "Attach a market",
    description: "Add a prediction market to a post",
    goal: 1,
    baseReward: 50,
    weight: 0.5,
    icon: "link",
  },
  {
    kind: "reply_comment",
    title: "Reply to a comment",
    description: "Keep a thread alive",
    goal: 1,
    baseReward: 25,
    weight: 0.9,
    icon: "reply",
  },
  {
    kind: "share_1",
    title: "Share a post",
    description: "Spread something interesting",
    goal: 1,
    baseReward: 25,
    weight: 0.7,
    icon: "share",
  },
  {
    kind: "bookmark_2",
    title: "Bookmark 2 markets",
    description: "Save markets to watch",
    goal: 2,
    baseReward: 25,
    weight: 0.6,
    icon: "star",
  },
  {
    kind: "open_profile_3",
    title: "Visit 3 profiles",
    description: "Explore other users",
    goal: 3,
    baseReward: 20,
    weight: 0.8,
    icon: "users",
  },
];

// ---- Deterministic seeded RNG --------------------------------------
// mulberry32: small, fast, deterministic. Same seed → same sequence.

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ActiveQuest extends QuestDef {
  reward: number;
}

/**
 * Pick 3 quests for the user on the given day. The reward total is
 * normalized into the [80, 120] band.
 */
export function pickDailyQuests(
  userId: string,
  isoDate: string, // YYYY-MM-DD
  recentKinds: QuestKind[] = [],
): ActiveQuest[] {
  const seed = hash32(`${userId}::${isoDate}`);
  const rand = mulberry32(seed);

  // Down-weight quests that ran in the last 3 days.
  const dampened = QUEST_POOL.map((q) => {
    const recentHits = recentKinds.filter((k) => k === q.kind).length;
    const decay = Math.max(0.15, 1 - recentHits * 0.45);
    return { def: q, weight: q.weight * decay };
  });

  const picked: QuestDef[] = [];
  const remaining = [...dampened];
  while (picked.length < 3 && remaining.length) {
    const totalW = remaining.reduce((s, x) => s + x.weight, 0);
    let r = rand() * totalW;
    let i = 0;
    for (; i < remaining.length; i++) {
      r -= remaining[i].weight;
      if (r <= 0) break;
    }
    const idx = Math.min(i, remaining.length - 1);
    picked.push(remaining[idx].def);
    remaining.splice(idx, 1);
  }

  // Normalize reward sum into [80, 120] preserving relative ratios.
  const rawSum = picked.reduce((s, q) => s + q.baseReward, 0);
  const target = 80 + Math.floor(rand() * 41); // 80..120 inclusive
  const scale = rawSum > 0 ? target / rawSum : 1;
  const scaled = picked.map((q) => ({
    ...q,
    reward: Math.max(10, Math.round(q.baseReward * scale)),
  }));
  // Fix-up to land exactly on target.
  const sumScaled = scaled.reduce((s, q) => s + q.reward, 0);
  const drift = target - sumScaled;
  if (drift !== 0 && scaled.length) scaled[0].reward += drift;
  return scaled;
}

// ---- Progress tracking ---------------------------------------------

export interface QuestProgress {
  kind: QuestKind;
  progress: number;
  goal: number;
  completed: boolean;
  reward: number;
  claimed: boolean;
}

export function questProgressFromCounts(
  active: ActiveQuest[],
  counts: Partial<Record<QuestKind, number>>,
  claimed: Partial<Record<QuestKind, boolean>> = {},
): QuestProgress[] {
  return active.map((q) => {
    const p = counts[q.kind] ?? 0;
    return {
      kind: q.kind,
      progress: Math.min(p, q.goal),
      goal: q.goal,
      completed: p >= q.goal,
      reward: q.reward,
      claimed: !!claimed[q.kind],
    };
  });
}

export function todayKey(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
