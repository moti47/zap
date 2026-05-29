import { z } from "zod";

/**
 * Shared Zod schemas for server-action input validation.
 *
 * Every server action MUST start by parsing its input against the
 * relevant schema (`SchemaName.safeParse(input)`) and returning the
 * typed error shape if it fails. Inputs are untrusted — server actions
 * are network-callable RPCs that anyone can hit with a curl.
 */

export const Uuid = z.string().uuid();

// Conservative bounds. Tighter than DB constraints so the schema fails
// before we send a value Postgres would reject.
export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3–20 chars: a–z, 0–9, _");

export const DisplayName = z.string().trim().min(1).max(50);
export const Bio = z.string().max(280);
export const PostBodyHtml = z.string().min(1).max(20_000);
export const CommentBody = z.string().trim().min(1).max(5_000);
export const CategorySlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,40}$/, "Invalid category slug");

export const HttpUrl = z.string().url().max(2_000);
export const UploadedUrl = z
  .string()
  .max(2_000)
  .refine(
    (v) => v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:image/"),
    "URL must be http(s) or data:image",
  );

// ---------- Posts ----------------------------------------------------

export const CreatePostInput = z.object({
  body_html: PostBodyHtml,
  category_slug: CategorySlug,
  market_id: Uuid.nullable().optional(),
  images: z.array(UploadedUrl).max(4).optional(),
  boost_zaps: z.number().int().nonnegative().max(1_500).optional(),
  boost_until: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});
export type CreatePostInput = z.infer<typeof CreatePostInput>;

// ---------- Comments -------------------------------------------------

export const CreateCommentInput = z.object({
  postId: Uuid,
  body: CommentBody,
  parentId: Uuid.nullable().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

// ---------- Likes / bookmarks / follows ------------------------------

export const ToggleByUuid = z.object({ id: Uuid });
export const FollowInput = z.object({ targetUserId: Uuid });

// ---------- Profile --------------------------------------------------

export const ProfilePatch = z.object({
  name: DisplayName.optional(),
  bio: Bio.nullable().optional(),
  avatar_url: UploadedUrl.nullable().optional(),
  cover_gradient: z.string().max(200).nullable().optional(),
  banner_url: UploadedUrl.nullable().optional(),
});
export type ProfilePatch = z.infer<typeof ProfilePatch>;

// ---------- Auth -----------------------------------------------------

export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z.string().min(6).max(200);

export const SignInInput = z.object({
  email: Email,
  password: Password,
  next: z.string().max(2_000).optional().default("/"),
});

export const SignUpInput = z.object({
  email: Email,
  password: Password,
  name: DisplayName,
  username: Username,
  next: z.string().max(2_000).optional().default("/onboarding"),
});

export const MagicLinkInput = z.object({ email: Email });

// ---------- Onboarding -----------------------------------------------

export const OnboardingInput = z.object({
  categories: z.array(CategorySlug).max(50),
});

// ---------- Notifications --------------------------------------------

export const MarkOneReadInput = z.object({ id: Uuid });

// ---------- Mentions notify -----------------------------------------

export const NotifyMentionsInput = z.object({
  usernames: z.array(Username).max(20),
  post_id: Uuid,
  excerpt: z.string().max(500).optional(),
});

// ---------- Market resolution ----------------------------------------

export const ResolveMarketInput = z.object({
  marketId: Uuid,
  outcome: z.enum(["yes", "no"]),
});

// ---------- Trades ---------------------------------------------------

export const ExecuteTradeInput = z.object({
  marketId: Uuid,
  side: z.enum(["yes", "no"]),
  action: z.enum(["buy", "sell"]),
  shares: z.number().int().positive().max(1_000_000),
  price: z.number().min(0).max(100),
});
export type ExecuteTradeInput = z.infer<typeof ExecuteTradeInput>;

// ---------- Admin: create market -------------------------------------

const FutureIso = z
  .string()
  .datetime({ offset: true })
  .refine((s) => new Date(s).getTime() > Date.now() + 60_000, {
    message: "Resolution date must be in the future",
  });

export const AdminCreateMarketInput = z.object({
  question: z.string().trim().min(8).max(280),
  description: z.string().trim().max(4_000).default(""),
  category_id: Uuid,
  resolution_date: FutureIso,
  resolution_source: z.string().trim().min(4).max(500),
  initial_yes_price: z.number().int().min(1).max(99),
  hero_image_url: UploadedUrl.nullable().optional(),
  seed_liquidity: z.number().int().nonnegative().max(1_000_000).optional(),
});

// ---------- User market proposal -------------------------------------

export const SubmitProposalInput = AdminCreateMarketInput.omit({
  seed_liquidity: true,
});

export const ApproveProposalInput = z.object({ proposalId: Uuid });
export const RejectProposalInput = z.object({
  proposalId: Uuid,
  reason: z.string().trim().min(3).max(500),
});

// ---------- AI: market-summary --------------------------------------
// Untrusted user input is interpolated into an LLM prompt; cap each
// field tightly so a malicious caller can't blow past the system msg.

export const MarketSummaryInput = z.object({
  marketId: Uuid,
  question: z.string().min(1).max(280),
  category: CategorySlug,
  currentYesPrice: z.number().min(0).max(100),
  currentNoPrice: z.number().min(0).max(100),
  priceHistory: z.array(z.number().min(0).max(100)).max(30).optional(),
  topYesHolderShares: z.number().int().nonnegative().max(10_000_000).optional(),
  topNoHolderShares: z.number().int().nonnegative().max(10_000_000).optional(),
});
export type MarketSummaryInput = z.infer<typeof MarketSummaryInput>;

// ---------- Helpers --------------------------------------------------

/**
 * Convert a ZodError to a single line suitable for `{ ok: false, error }`
 * server-action returns. Picks the first issue + its path.
 */
export function formatZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
