# Zap — Project Context

A social prediction-market platform where users post takes, attach markets,
trade YES/NO shares with in-app Zaps (⚡), and build reputation through
calibrated forecasts.

## Stack

- **Framework**: Next.js 16.2.6 (App Router, React 19.2, RSC + Server Actions)
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Styling**: Tailwind v4
- **UI primitives**: Radix UI + custom components in `src/components/ui`
- **Animation**: framer-motion
- **Toasts**: sonner
- **Charts**: recharts

> Read `node_modules/next/dist/docs/` when in doubt. Next 16 has breaking
> changes vs older mental models — `cookies()` / `headers()` / `params` /
> `searchParams` are all async.

## Repo layout

```
zap/
  middleware.ts                  Next middleware → Supabase session refresh + auth gates
  supabase/migrations/           Versioned SQL (paste into Supabase SQL editor or `db push`)
    0001_init.sql                All tables + RLS + triggers + buckets + realtime publication
  scripts/seed.ts                `npm run seed` — 20 users, 12 markets/category, 30 posts
  src/
    app/
      auth/                      sign-in, sign-up, callback, sign-out, server actions
      feed/  market/  markets/  profile/ ...
    components/                  UI
    lib/
      supabase/
        client.ts                Browser client (anon key)
        server.ts                Server client for RSC + actions (anon key + cookies)
        service.ts               SERVICE-ROLE client — server only, bypasses RLS
        middleware.ts            updateSession helper called from /middleware.ts
        types.ts                 Hand-rolled DB types (replace with `gen types` once linked)
      db/
        profiles.ts  categories.ts  markets.ts  posts.ts  comments.ts  trades.ts
      realtime.ts                Client hooks for trades / posts / comments / markets / notifs
      store.ts                   ⚠️ DEPRECATED — Zustand store from the mock prototype.
                                 Being torn out in phases. New code reads from Supabase.
      mock-data.ts               ⚠️ DEPRECATED — seed values lifted into scripts/seed.ts
      fake-socket.ts             ⚠️ DEPRECATED — replaced by lib/realtime.ts
```

## Environment

`.env.local` (copy from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # server-only
```

The anon key is safe in the browser; the service-role key bypasses RLS and
must never reach the client bundle. `lib/supabase/service.ts` is the only
place that reads it, and it has a `"server-only"` import sibling pattern
via the seed script.

## Database

All schema is in `supabase/migrations/0001_init.sql`. Tables:

| Table          | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| profiles       | One row per `auth.users`, created by trigger; 1000 ⚡ on signup |
| categories     | 7 seeded: politics, crypto, sports, tech, economy, entertainment, general |
| markets        | YES/NO prediction markets with prices, volume, resolution date  |
| positions      | (user, market, side) → shares + avg_price; UNIQUE              |
| trades         | Append-only ledger of buy/sell rows                             |
| posts          | Rich-text posts; FK to category (required) + market (optional)  |
| comments       | Self-referencing `parent_id` for nested threads                 |
| follows        | (follower, followee) edges                                      |
| bookmarks      | Saved post OR market (exclusive via check constraint)           |
| post_likes     | (user, post) — counter trigger keeps `posts.likes` in sync      |
| comment_likes  | Same idea for comments                                          |
| expert_scores  | (user, category) → brier, calibration, volume, percentile       |
| notifications  | Per-user feed (follow, comment, like, market_resolved, …)       |
| drafts         | Saved-but-unpublished composer state per user                   |

### RLS summary

- Public **read**: profiles, categories, markets, posts, comments, follows, trades, post_likes, comment_likes, expert_scores.
- Owner **write**: profiles (own row), posts/comments (own author_id), bookmarks/drafts/notifications (own user_id), follows (own follower_id), likes (own user_id).
- **No client writes** to: markets, positions (write via server actions only — they validate balances), trades (write via server actions), expert_scores (computed server-side).
- Service role bypasses RLS for seed, market resolution, expert-score recomputation.

### Triggers

- `auth.users INSERT → handle_new_user()` creates the matching `profiles` row with a unique username (collision-safe) and 1000 ⚡.
- `comments INSERT/DELETE → posts.comments_count` bump.
- `post_likes/comment_likes INSERT/DELETE → likes` counter bump.

### Realtime

`supabase_realtime` publication includes posts, comments, trades, markets, notifications. Client hooks in `lib/realtime.ts`:
`useTradesChannel`, `usePostsChannel`, `useCommentsChannel(postId)`, `useMarketsChannel`, `useNotificationsChannel(userId)`.

### Storage

Public buckets `post-images` and `avatars`, gated by RLS:
files must live under a folder matching the uploader's `auth.uid()`.

## Auth flow

- `/auth/sign-in` — email + password OR magic link (toggle).
- `/auth/sign-up` — collects display name + username + email + password.
- `/auth/callback` — handles magic-link / email-confirm code exchange.
- `/auth/sign-out` — POST endpoint.
- `middleware.ts` calls `updateSession()` on every request (skipping static
  assets), refreshes the token via `getUser()`, writes new cookies on the
  response, and 302s unauthenticated users away from `/onboarding`,
  `/profile/edit`, `/notifications`, `/saved`, `/drafts`, `/admin`.

## Data-fetching conventions

- Server Components → import from `lib/db/*` (typed query modules).
- Mutations → Server Actions (`"use server"` files alongside the page) calling the same `lib/db/*` modules or `lib/supabase/server.ts` directly.
- Client mutations → call the Server Action via `useTransition` / form `action`.
- Live updates → subscribe via `lib/realtime.ts` hooks; merge into local state.

## Operational notes

1. **First-time setup**: paste contents of `0001_init.sql` into the Supabase SQL editor and run.
2. **Type codegen** (recommended once you have a real project linked):
   ```
   npx supabase link --project-ref <ref>
   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
   ```
   Then re-add the `<Database>` generic on the three `createClient` helpers.
3. **Seed**: `npm run seed` after creating two storage buckets (`post-images`, `avatars`) and running the migration.
4. **Realtime tables** must be added to the `supabase_realtime` publication — the migration does this, but if you create new tables manually, run `alter publication supabase_realtime add table public.your_table;`.

## Migration roadmap (phased rollout)

- ✅ **Phase 1** — Backend foundation (this commit). Supabase wired; auth pages; data layer; seed; realtime hooks. UI still on Zustand for now.
- ✅ **Phase 2** — UX simplification:
  - Left sidebar removed; `Sidebar` and `MobileNav` components deleted.
  - All nav moved to `components/topbar.tsx`: logo + center nav (Feed/Markets/Leaderboard/Saved) + search icon + notifications + Compose button + profile avatar dropdown (My Profile, Edit Profile, Preferences, Sign Out). Mobile hamburger opens a slide-in drawer.
  - Feed centered at `max-w-[720px]` inside a `max-w-[1180px]` page wrapper with `gap-8`; right rail visible only on `xl+` and is independently scrollable (`sticky top-[4.5rem]`, `overflow-y-auto`).
  - `components/market/trade-panel.tsx` rewritten as broker-style: BUY/SELL tabs (SELL grayed when no position), Market/Limit order-type pills (Limit visual-only), big YES/NO side buttons, amount slider + numeric input, quick chips (10/50/100/500/MAX respecting balance or held shares), estimated-fill block (avg price, shares, total cost, max profit, break-even), 5-level synthetic order book, current position banner (shares/value/P&L always shown), and a Pro details accordion (24h vol / OI / traders / top-trader win rate). `TradeModal` now wraps `TradePanel` in a Dialog for the compact market cards.
- ✅ **Phase 3** — Unified categories in composer:
  - `components/post/post-composer.tsx` now leads with a labeled **Step 1 · Pick a category** row of large category chips (radiogroup, `aria-required`). Post button shows "Pick a category" + is disabled until both body text and category are present, then flips to "Post to {category}". Trying to publish without a category pulses the chip row + toasts.
  - `components/expert-badge.tsx`: `CategoryTag` is now a `<Link>` to `/category/[slug]` by default; pass `asLink={false}` when it's embedded inside another interactive surface (already done for right-sidebar, markets-browser, attach-dialog, markets-catalog, profile-tabs, landing/ambient-feed).
  - New `/category/[slug]` route → `app/category/[slug]/category-view.tsx`. Hero with category color, jump-to-category strip, top markets grid, recent posts list (mock-data + user posts merged), and top-experts side panel filtered by `expertScores[category]`.
- ✅ **Phase 4** — Question catalog with attach-confirm flow:
  - New `components/market/attach-market-dialog.tsx` — modal with a two-step UX. Step 1 is the browse grid (search, category chips, sort: Trending/Newest/Closing/Volume). Clicking a card never auto-submits; instead it transitions to Step 2 with a market preview + explicit **Attach to post** / **Cancel**. Only the explicit Attach calls back to the composer.
  - Composer's `+ Attach question` button now opens this dialog directly (no router redirect). Confirmed market renders as a labeled "Attached question" card with a remove ×; "Swap question" reopens the dialog.
  - New standalone `/catalog` route (`app/catalog/page.tsx`) wraps the existing `MarketsCatalog` component for deep links.
  - Pre-existing `/markets-catalog` route + its `?return=composer` flow remain intact for back-compat.
  - `/markets` rebuilt as `components/market/markets-browser.tsx`: sticky full-width category-chip rail aligned to post categories (All + 6), search + sort tabs, responsive 2/3-column card grid with sparklines and live volume. Empty state with reset.
- ✅ **Phase 5** — Nested comments:
  - `UserComment` (and the new `SeededComment` interface) carry an optional `parentId` field. `addComment(postId, body, parentId?)` accepts the parent id; legacy callers (no parent) still create top-level replies.
  - Seed generator (`mock-data.ts` seededComments) now creates 1-3 nested replies per post and occasionally a reply-to-reply, so the tree UI has demo content on every post.
  - `components/post/comment-thread.tsx` rewritten as a tree renderer: builds a `CommentNode` graph from `parentId`, sorts siblings oldest→newest, indents children with a left guide-line. Each comment has a Reply button (opens inline `ReplyComposer` with `Replying to {name}` label, Esc to cancel, Cmd/Ctrl-Enter to submit) and a Collapse/Expand toggle (shows "{N} hidden" when collapsed). After `MAX_VISIBLE_DEPTH = 4` it stops indenting and renders a "Continue thread →" link.
  - `OP` badge (blue) on the post author's comments + existing `You` badge on the current user's. Comment likes go through the existing `toggleCommentLike` action and persist via the same Zustand `likedCommentIds` slice.
  - PostCard now passes `postAuthorId={user.id}` to `CommentThread`.
- ✅ **Phase 6** — Smart exposure algorithm, boost mechanic, anti-throttle.
  - New migration `0002_exposure.sql`:
    - Tables `post_impressions`, `boost_events`, `post_throttle_events`, `author_cooldowns` (RLS-scoped).
    - SQL functions `expert_factor_for`, `engagement_factor_for`, `freshness_factor_for`, `category_affinity_for`, `boost_factor_for`, `compute_exposure_score`, `check_throttle`. All factors normalized to [0,1].
    - Formula: `0.40·expert + 0.25·engagement + 0.15·freshness + 0.10·affinity + 0.10·boost − cooldownPenalty`. Throttled posts are halved.
    - Anti-spam rules: (A) age ≥ 2h, no boost, engagement < 0.10 → throttle. (B) age ≥ 1h, boost active, engagement < 0.15 → throttle + early-stop boost. (C) 3 throttles in 7d → 24h cooldown with −0.30 starting penalty.
    - `posts.throttled` boolean added; `post_impressions` and `boost_events` added to the realtime publication.
  - `src/lib/exposure.ts` — isomorphic implementation of the same algorithm (used by the Zustand prototype feed; the Postgres function mirrors it exactly). Exports `computeExposure`, `engagementFactor`, `freshnessFactor`, `boostFactor`, `checkThrottle`, `updateAffinity`, plus `BOOST_AMOUNTS = [50, 200, 500, 1500]` and `BOOST_DURATIONS_H = [1, 4, 24]`.
  - `src/lib/db/exposure.ts` — server-only wrappers: `recomputeExposure`, `checkPostThrottle`, `recordImpression`, `startBoost` (debits zaps via service client + records boost_event), `getBoostMetrics`, `recordAffinitySignal` (merges into `profiles.affinity` jsonb).
  - `lib/db/posts.listFeed` now orders by `exposure_score desc` and applies a viewer-affinity lift (`+0.1 × affinity[slug]`) before returning.
  - Zustand `store`: adds `affinity`, `throttleEventsAt`, `cooldownEndsAt`, `postImpressions`, `postClicks`, plus `recordImpression`, `recordClick`, `bumpAffinity`, `applyThrottleCheck`. `addPost` accepts `boostZaps`/`boostDurationH` and deducts points. `toggleLike` bumps affinity.
  - `UserPost` carries `boostZaps`, `boostUntil`, `impressions`, `clicks`, `throttled`, `boostEarlyStoppedAt`.
  - UI:
    - `components/post/boost-control.tsx` — collapsible boost toggle inside the composer with amount chips (50/200/500/1500⚡) + duration pills (1h/4h/24h), live "est. reach" + cost line, insufficient-balance state. Disabled chips when amount > balance.
    - Composer publish button flips to "Post & boost N⚡" when boost is on; insufficient balance blocks publish with a toast.
    - `components/post/exposure-explain.tsx` — info-icon popover on every post card showing the score, each factor's value × weight bar, and a "ranked"/"throttled" pill. Cooldown penalty rendered when active.
    - `components/post/boost-performance.tsx` — per-post widget on the author's own post showing impressions, CTR, engagement rate, time remaining, and an early-stop banner when applicable. Re-renders every 30s.
    - PostCard now: registers an IntersectionObserver impression (≥50% visibility), records clicks on embedded markets, bumps affinity on like and click, renders a "BOOSTED" ribbon while `boost_until` is in the future, and shows the BoostPerformance widget for own boosted posts.
    - `components/feed-stream.tsx` ranks the merged seed + user-post list with `computeExposure` on the client, applying viewer affinity, freshness, boost factor, and throttle state — so the prototype feed demonstrates the same ranking the Supabase feed will produce.
- 🟡 **Phase 7** — Tiptap rich text + image upload + drafts.
- 🟡 **Phase 8** — Profile editing.
- 🟡 **Phase 9** — Notifications UI, global search, mentions, market resolution flow, bookmarks page, onboarding.
- 🟡 **Phase 10** — Cleanup: delete `mock-data.ts`, `fake-socket.ts`, `store.ts` persist; zero dev-console warnings.
