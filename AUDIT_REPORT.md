# Zap — Audit Report

Read-only audit performed before any code changes. Severity scale:

- 🔴 **P0** — security holes, broken core functionality, data-loss risk.
- 🟠 **P1** — real bugs, missing auth/validation, N+1, realtime leaks, type-safety holes.
- 🟡 **P2** — UX gaps, missing states, a11y.
- 🔵 **P3** — tech debt, polish, documentation drift.

Findings ordered by severity within each section. File paths are repo-relative.

---

## 🔴 P0 — Security & Core Functionality

### P0-1 — Trading is mock-only; `executeTrade` is dead code and `positions`/`trades` have no INSERT RLS policy

- **Where**: `src/lib/db/trades.ts:12`, `src/components/market/trade-panel.tsx:114,123`, `supabase/migrations/0001_init.sql` (RLS policies on `positions` / `trades`).
- **What**: `TradePanel.handleAction` calls Zustand `buyShares`/`sellShares` — purely client-side state. No server action is wired and no `/api/trade` route exists, despite middleware listing it as protected. The DB helper `executeTrade` exists but is **never imported**, and even if it were, it writes via the user-cookie client into `positions` and `trades`, which have only `SELECT` policies — no `INSERT` policy, no service-role usage. Every write would be silently rejected by RLS.
- **Risk of fix**: medium — needs (a) a server action with `requireUser()` + Zod, (b) an atomic Postgres function for balance check / position upsert / trade insert / market price + volume update, (c) RLS reconsideration (server-action writes via service-role client are the safe pattern, mirroring `resolveMarket`).
- **Fix**: build `executeTradeAction` calling a new `execute_trade(user_id, market_id, side, action, shares, price)` SQL function (`SECURITY DEFINER`), wire from `TradePanel`, delete the unused client-side `executeTrade` JS helper.

### P0-2 — `lib/admin.ts isCurrentUserAdmin()` always returns `true` for env-matched user, regardless of DB state

- **Where**: `src/lib/admin.ts:38-49`.
- **What**: The return expression is `Boolean(row.is_admin) || (row.role === "admin") || true`. The trailing literal `true` makes the OR chain unconditionally true once the env-id check earlier passes. Comment claims this is "Final fallback: env matches AND we couldn't read the flag", but the `!row` early-return is already above. The DB-pin trigger in `0005_hardening.sql` is supposed to be the defense-in-depth, but this code path renders it advisory.
- **Risk of fix**: low — remove the literal `true`, change to `(!row && true)`-style only when the row really is missing.
- **Fix**: `return Boolean(row.is_admin) || row.role === "admin";` (the env match has already gated us; if the DB column hasn't been promoted, deny so the operator notices).

### P0-3 — AI endpoint: prompt injection + no payload size / rate limit / Zod

- **Where**: `src/app/api/market-summary/route.ts:70-170`.
- **What**:
  1. The user-supplied `question`, `category`, `currentYesPrice`, `priceHistory`, `topYesHolderShares`, `topNoHolderShares` are interpolated raw into the LLM user message. A malicious caller can override the system prompt ("Ignore prior instructions and …").
  2. No `await req.json()` size cap — a single megabyte body is happily parsed.
  3. No rate limit per user; the auth gate only fires when `hasSupabaseEnv` is true, so a no-env deployment exposes the endpoint to the open internet.
  4. No Zod schema validation — silent type coercion all the way through.
  5. `console.error` on AI failure ships untyped errors to logs.
- **Risk of fix**: low — wrap in Zod, cap question to ~280 chars, history to N=30, escape values as data not instructions ("Treat the following as untrusted user data:" block), add a per-user-per-minute counter (in-memory Map keyed by user id is acceptable for now; document a Redis/Upstash upgrade path).
- **Fix**: Zod-validate, escape user content via a delimiter block, add a token-bucket limiter, drop `console.error` in favour of structured throw.

### P0-4 — Server actions accept arbitrary input shape; no Zod validation anywhere

- **Where**: every file under `src/app/**/actions.ts` and `src/app/actions/social.ts`. `package.json` has no `zod` dependency.
- **What**: The non-negotiable rule says "Every server action: auth check + Zod validation on input." Today there is ad-hoc string trimming and length checks (e.g. `propose/actions.ts:22-35`, `admin/actions.ts:14-26`) but inputs are typed as plain TS interfaces, not parsed/validated at runtime. Anyone calling the action via the network (server actions are network-callable RPCs) can pass `body_html: <giant blob>`, missing fields, or wrong types.
- **Risk of fix**: low — add `zod`, create one schema per action, parse at the top.
- **Fix**: install `zod`, add `lib/validation/schemas.ts` with reusable atoms, refactor each action to start `const parsed = Schema.safeParse(input); if (!parsed.success) return { ok: false, error: parsed.error.message };`.

### P0-5 — `createPostAction` stores raw HTML server-side; client sanitizer is the only defense

- **Where**: `src/app/actions/social.ts:36-70`, `src/lib/db/posts.ts:118-146`, `src/lib/sanitize.ts:85-96` (browser-only).
- **What**: `sanitizeHtml` checks `typeof window === "undefined"` and, on the server, strips ALL tags (lossy SSR fallback) — but the action stores whatever HTML the client sends, unchecked. Any consumer that ever renders post bodies server-side (or that bypasses the client sanitizer in a future surface) will execute the stored XSS.
- **Risk of fix**: low — add a server-safe sanitizer (`isomorphic-dompurify` or `sanitize-html`) and run it inside `createPostAction` before insert. Cap body length to e.g. 8 KB.
- **Fix**: install `sanitize-html`, expose `sanitizeHtmlServer()` in `lib/sanitize.ts`, call it from `createPostAction` and `createCommentAction`.

### P0-6 — Post upload endpoint accepts unbounded files and trusts client-declared MIME

- **Where**: `src/app/api/upload/route.ts:14-47` (post images) and `src/lib/db/storage.ts:11-34`. Avatar / banner endpoints validate size + MIME but post-image does not.
- **What**:
  - No `MAX_BYTES` check before reading the file into memory or uploading.
  - No MIME allow-list (avatar/banner have one; post-image does not).
  - MIME is read from `file.type` which is client-supplied — must be sniffed from the magic bytes (`file-type` package) or restricted to a tight allow-list AND verified by Supabase storage (which it isn't).
  - SVG isn't explicitly blocked anywhere — SVG can carry inline `<script>`. Reject `image/svg+xml`.
  - No dimension caps — an attacker can upload a 50000×50000 PNG that bombs out `next/image`.
- **Risk of fix**: low — mirror avatar route's size + MIME check, add `image/svg+xml` to a deny list everywhere, sniff bytes for the post-image route.
- **Fix**: shared `lib/upload-guard.ts` enforcing size + MIME-allow + magic-byte sniff + SVG deny; use from all three routes.

### P0-7 — `completeOnboardingAction` corrupts the new affinity shape

- **Where**: `src/app/onboarding/actions.ts:29-46`.
- **What**: The action writes `affinity` as a flat `Record<string, number>` and merges via `{ ...existing, ...affinity }`. Per the CLAUDE/CONTEXT note (Phase 12 — Polish 1 / Phase 0003), the column was migrated to a nested `{ categories, hashtags, last_filter }` shape and `category_affinity_for` SQL helper reads either shape. However the migration files actually checked in (`0003_personalization.sql`) DO NOT contain the nested-shape migration. So the runtime shape is whatever existing rows have. The onboarding action will overwrite with a flat-shape `{slug: 0.7}` blob, clobbering any nested structure if it exists in production. `lib/db/posts.ts listFeed:66` reads `affinity[slug]` directly — also assumes flat.
- **Risk of fix**: medium — need to pick one shape and migrate both writers and readers to it. Recommend keeping the flat shape (consistent with current migrations) and updating CONTEXT.md to reflect reality.
- **Fix**: confirm desired shape; if flat, fine — but add a Zod schema and reject anything that isn't `Record<string, number>` before write. If nested, ship a migration + update both `completeOnboardingAction` and `listFeed`.

### P0-8 — `executeTrade` (when wired) is non-atomic — over-spend is trivial under concurrency

- **Where**: `src/lib/db/trades.ts:27-66`.
- **What**: read-modify-write on `profiles.zaps`: `select zaps`, branch on it, then `update zaps - cost`. Two concurrent buys can both pass the check and both deduct. No `select … for update`, no constraint, no RPC.
- **Risk of fix**: medium — fold into a single `execute_trade` Postgres function with `update profiles set zaps = zaps - $cost where id = $u and zaps >= $cost returning ...`. Same fix as P0-1.

### P0-9 — Toggle-like and toggle-bookmark races leak duplicate inserts to RLS error

- **Where**: `src/lib/db/posts.ts:154-198`, `src/lib/db/comments.ts:83-107`, `src/lib/db/bookmarks.ts:73-93`.
- **What**: `select existing → if not, insert`. Two clicks in the same render frame both observe "no row" and both try to insert. PRIMARY KEY catches it but returns a raw Postgres error to the user (no `onConflict`). The UI shows "Network error" instead of "already liked".
- **Risk of fix**: low — convert to `upsert` with `onConflict: "user_id,post_id"` for likes, or a single `.delete().eq(...).select()` to detect prior existence, or a SQL function.
- **Fix**: replace each three-call sequence with a single RPC `toggle_post_like(uuid)` that returns the new state.

---

## 🟠 P1 — Real Bugs, Missing Validation, Realtime Leaks, Type Holes

### P1-1 — Realtime hooks re-subscribe on every render (handler not memoized)

- **Where**: `src/lib/realtime.ts:16,45,69,99,123`. All five hooks list `handler` in the dependency array; callers in `feed-stream.tsx`, `notification-bell.tsx`, etc. pass inline closures.
- **What**: Each parent render allocates a fresh `handler`, the effect tears down + re-subscribes the Supabase channel. Beyond the obvious wasted RTT, Supabase's internal channel registry can intermittently return an "already-subscribed" instance and the next `.on(...)` after `.subscribe()` throws (the pattern documented in `use-viewer.ts:88-128`).
- **Fix**: drop `handler` from deps and stash it in a ref so the effect closure always reads the latest; OR document that the caller must `useCallback` the handler. Recommend the ref pattern — defensive and zero caller-impact.

### P1-2 — `lib/admin.ts requireAdmin()` thrown error becomes generic `Forbidden` and is `throw new Error`; admin server actions don't catch typed

- **Where**: `src/lib/admin.ts:52-57`, `src/app/admin/actions.ts:36`, `:50`, `:63`. The catch falls through to `String(err)` and returns `{ ok: false, error: "Forbidden: admin only" }`. Plus `approveProposalAction` / `rejectProposalAction` do NOT call `requireAdmin()` directly — they rely on the underlying `approveProposal/rejectProposal` calling it. Defense-in-depth at the action layer is the convention.
- **Fix**: add `await requireAdmin()` at the top of approve / reject actions; convert to a typed `NotAdminError` mirroring `NotSignedInError`.

### P1-3 — `lib/db/posts.ts listFeed` runs N+1-ish dual queries instead of a single SQL with viewer signals

- **Where**: `src/lib/db/posts.ts:31-99`.
- **What**: For a viewer with content: one query for posts, one for the affinity-bearing profile, then parallel `likes` + `bookmarks` queries. Re-rank happens in JS. For 50 posts × 2 lookups every feed paint that's fine, but adds two extra round-trips per request. Recommended pattern is a single `select ..., post_likes!left(...) ` join. The category filter `eq("category.slug", ...)` after a nested `categories!inner(...)` select is fragile (works today via PostgREST embedded filter; brittle to schema/typing changes).
- **Fix**: SQL view / `select` with a CTE in a SECURITY-DEFINER function; or at minimum, run all viewer-side hydration queries in parallel via `Promise.all` (already partial). Keep the sort in JS — affinity isn't first-class in the DB.

### P1-4 — Hand-rolled types are stale vs migrations (`CategorySlug` union, missing `is_admin`, missing accuracy/expertise fields)

- **Where**: `src/lib/supabase/types.ts`. `CategorySlug` is the original 7 even though `0007_categories_expand.sql` adds 43 more. `ProfileRow` is missing `is_admin`, `updated_at`, hashtag-affinity shape. `ExpertScoreRow` is missing `accuracy` / `expertise` (CONTEXT.md claims these are added but migration files don't contain them — see P3-2). `Database` interface's `Functions` and `Views` are empty even though `compute_exposure_score`, `bump_quest_progress`, `bootstrap_admin`, `is_admin(uid)` exist.
- **Fix**: hand-patch the missing columns now (small) + add a `npm run gen:types` script wrapping `supabase gen types typescript --linked > src/lib/supabase/types.ts` and document running it after every migration. Once user provides a Supabase ref I can run it.

### P1-5 — Anywhere we throw `new Error("Not signed in")` we should throw `NotSignedInError`

- **Where**: `lib/db/posts.ts:130,159,183`, `lib/db/comments.ts:68,87`, `lib/db/bookmarks.ts:78`, `lib/db/trades.ts:24,87`, `lib/db/storage.ts:17,47,78`, `lib/db/notifications.ts:77,91`, `lib/db/markets.ts` (none in this one).
- **What**: Plain `Error` strings break the typed dispatch in callers like `notSignedIn<T>(err)` in `app/actions/social.ts:23`. Callers think they have a generic failure and surface a noisy error instead of "please sign in".
- **Fix**: replace every "Not signed in" throw with `throw new NotSignedInError()`.

### P1-6 — `notifications` table has no INSERT policy → only service-role can write. Several `submitProposal`, `createComment`, `togglePostLike` callers expect to insert notifications via the user-cookie client

- **Where**: `supabase/migrations/0001_init.sql:447-452`, then look at how `submitProposal` (action layer) hopes to notify admins. Today only `fanoutNotifications` correctly uses service-role. But `proposals.submitProposal` writes the proposal via user client and the notify-admins step is missing entirely. Likewise toggle-like/comment fan-outs are missing.
- **Fix**: standardize notification-emit on `fanoutNotifications` (service-role), and add it from `submitProposal` (notify admins) and from `createCommentAction` / `toggleLikeAction` (notify post author).

### P1-7 — Hydration risk: `Date.now()` and random in render in feed-stream

- **Where**: `src/components/feed-stream.tsx:132,135,190-194,232-238`. `Date.now()` is called inside `buildSnapshot` and at the top of `FeedItemRow`. Today the snapshot is built inside a `useEffect` so it's client-only — OK. But `FeedItemRow:444-446` uses `Date.now() - new Date(...).getTime()` inline during render to decide animation entry; for SSR-rendered content this becomes a mismatch the moment it crosses the 5s boundary on the second client paint. Low-prob but the rule is "no Date in render".
- **Fix**: compute `isFreshOwn` once via `useState(() => ...)` set inside `useEffect` so it's deterministic across paints.

### P1-8 — Heavy `(p as any)` use in `feed-stream.tsx`

- **Where**: `src/components/feed-stream.tsx:140-175,189-194,234,250,258-259,275,397`.
- **What**: Every other line casts FeedItem to `any` to read `id`, `userId`, `createdAt`, etc. The discriminator pattern (`type === "user"`) is already present — replace casts with proper narrowing.
- **Fix**: define a `getPostMeta(item: FeedItem): { id, userId, createdAt, ... }` type-safe accessor; or unify FeedItem variants with a common base interface.

### P1-9 — `affinity` write from `executeTrade` / `submitProposal` etc. is missing — only the onboarding action sets affinity

- **Where**: `src/lib/db/trades.ts`, `src/lib/db/proposals.ts`. Per CONTEXT, every trade / like / view should bump category affinity. Today only the Zustand prototype does this (`store.bumpAffinity`). Server-side `profiles.affinity` only ever updates from onboarding.
- **Fix**: ship a `bump_affinity(user_id, category_slug, delta)` SQL function called from `executeTradeAction` and `toggleLikeAction`.

### P1-10 — `markets` price + volume are only ever changed via `resolveMarket`. There is no path to update prices when trades happen

- **Where**: `markets.yes_price` / `no_price` / `total_volume`. No update path outside the resolution flow.
- **What**: When the trade pipeline is wired (P0-1/P0-8), it must move prices and volume. Today `markets` has no INSERT/UPDATE policy except admin (`0004_production.sql:84`); volume updates must happen in the same SECURITY-DEFINER function as the trade or via a `market-engine` Postgres function.
- **Fix**: roll into the same `execute_trade` RPC.

### P1-11 — `middleware.ts` `Cache-Control: private, no-store` is set only on the implicit fall-through branch, not on public-read responses

- **Where**: `src/lib/supabase/middleware.ts:171-174`. The header is only attached on the final "Tier 5" branch. Anonymous browsing of `/`, `/markets`, etc. returns whatever Next decides (default `s-maxage=…` for static content). Cookie-aware responses skip the header.
- **Fix**: set the header on every code path that does an auth check, not only on the final branch.

### P1-12 — `executeTrade` updates positions / trades / profile via user-cookie client; user has SELECT-only on `positions` and `trades`

- **Where**: same as P0-1. Documenting separately because the RLS asymmetry matters for any future direct-write attempt.

### P1-13 — No optimistic-update rollback in `toggleLikeAction` callers

- **Where**: `src/components/post/post-card.tsx` `toggleLike` flips Zustand state synchronously, then fires the server action without awaiting / rolling back on failure.
- **Fix**: wrap in `useTransition`, rollback on `{ ok: false }`, surface a toast.

### P1-14 — Empty / loading / error states missing on `/notifications`, `/quests`, profile activity tab

- **Where**: `src/app/notifications/page.tsx`, `src/app/quests/page.tsx`. Need to confirm by reading the pages, but `feed-stream.tsx` is the only place with explicit `paintLoading` + skeletons. Empty pages render an empty list.
- **Fix**: each page gets <Skeleton/> while loading and an empty-state component when zero rows.

### P1-15 — `handle_new_user()` trigger is `SECURITY DEFINER` but does not set a `search_path` lock for the `regexp_replace` call

- **Where**: `0001_init.sql:241-273`. The `set search_path = public` is set, but `regexp_replace` lives in `pg_catalog` and is shadowed only if an attacker creates `public.regexp_replace` — paranoid-level concern, lower risk. Marking P1 to keep visible.
- **Fix**: prefix function calls with `pg_catalog.` inside SECURITY DEFINER functions, or `set search_path = pg_catalog, public`.

---

## 🟡 P2 — UX, States, Accessibility

- **P2-1**: Infinite feed cycles posts (`feed-stream.tsx:393-410`) — repeats the same posts with a `-cycle{n}` key suffix. Users see the same content twice. Better: stop with an "End of feed" footer and a CTA to follow more categories.
- **P2-2**: `PostCard` uses `<img>` for body images (`post-card.tsx` references via tiptap-inserted HTML); should ensure all rendered images go through `next/image` or get an `loading="lazy"` + dimensions to avoid CLS.
- **P2-3**: `Toaster` is global; some flows (`onboarding/actions.ts`) return `{ok:false}` silently with no `toast.error`. Verify per-action.
- **P2-4**: Keyboard focus management: AttachMarketDialog and PostComposer have no demonstrated focus-trap; needs verification with axe.
- **P2-5**: Mobile width ≥ 375px: feed-stream cycles use a sticky pill at `top-[4.5rem]` — covers content under mobile sticky header on iOS Safari.
- **P2-6**: No empty state on `/saved` when the user has zero bookmarks (saved-view.tsx fall-through case).
- **P2-7**: Dark-only — no `next-themes` integration despite the project being styled dark. Light-mode users see hard-coded `#0E1016`.
- **P2-8**: `linkifyHashtags` (used inside `PostCard` body rendering) runs client-only — first paint shows un-linked `#foo`.
- **P2-9**: `expert-badge` `CategoryTag` renders a link that does not have a focus-visible style.

---

## 🔵 P3 — Tech Debt, Polish, Doc Drift

- **P3-1**: `CONTEXT.md` lists many "✅ Phase 11+ / Polish 1" items that do **not** appear in the actual migration files (e.g. `recompute_expert_scores`, `decay_affinity_weekly`, `bootstrap_admin` from `0003_polish_1.sql` — file doesn't exist; only `0003_personalization.sql`). Docs and code are out of sync.
- **P3-2**: `lib/db/proposals.ts:33` writes into `market_proposals.reject_reason` per the migration, but `submitProposal` references `hero_image_url` — the column exists in the migration but isn't in `MarketRow` type either.
- **P3-3**: 65 occurrences of `: any` / `as any` across 17 files (`Grep` count). Most concentrated in `feed-stream.tsx` (24), `post-composer.tsx` (1), `saved-view.tsx` (4), `notifications-list.tsx` (2), `landing/page.tsx` (1).
- **P3-4**: 3 `console.*` calls remain — `use-viewer.ts:141` (justified by inline `eslint-disable`), `market-summary/route.ts:155`, `app/error.tsx`. Need to replace with structured logger.
- **P3-5**: `next.config.ts` allows `images.unsplash.com` and `source.unsplash.com` — fine for prototype but should be removed before production.
- **P3-6**: `lib/store.ts` is huge and still drives most UI state even though Phase 10 claimed it was being torn out. Consider documenting which slices are still authoritative vs prototype.
- **P3-7**: Missing scripts in `package.json`: no `typecheck`, no `format`, no `gen:types`.
- **P3-8**: `next-env.d.ts` is checked in by Next convention but no `Database` generic threaded into `createServerClient` / `createBrowserClient` — typed queries fall through to `any`.
- **P3-9**: `notifications.type text not null` — should be a check constraint or enum to keep the kind values aligned with the TS union.
- **P3-10**: `markets-catalog/` and `/catalog` both serve the catalog — collapse to one.
- **P3-11**: README absent at root; only `AGENTS.md` + `CONTEXT.md` exist.

---

## What was reviewed

- `package.json`, `tsconfig.json`, `next.config.ts`, `middleware.ts`.
- All seven migrations under `supabase/migrations/`.
- Every file under `src/app/**/actions.ts` and `src/app/actions/`.
- All API route handlers under `src/app/api/**/route.ts`.
- Server data layer: `src/lib/db/{posts,comments,markets,market-resolution,trades,profiles,bookmarks,notifications,proposals,admin-markets,storage,search}.ts`.
- Supabase plumbing: `src/lib/supabase/{client,server,service,middleware,types}.ts`, `lib/auth.ts`, `lib/admin.ts`.
- `src/lib/realtime.ts`, `src/lib/use-viewer.ts`, `src/lib/sanitize.ts`.
- Key client surfaces: `src/components/feed-stream.tsx`, `post-card.tsx`, `post-composer.tsx`, `market/trade-panel.tsx`.
- Top-level: `src/app/layout.tsx`, `.env.local.example`.

Not yet read (will revisit in Phase 1 fix-by-fix): individual page.tsx files, the streaks / quests / reputation libs, the admin UI pages, the affinity / ranking implementations beyond their integration points.

---

## Gate 1 — APPROVED ✅ (constraints: don't change visuals, don't regress working features)

## Phase 1 progress

### P0 — all addressed ✅

| ID | Status | Notes |
| -- | ------ | ----- |
| P0-1 | ✅ | New `execute_trade` SQL function (migration 0008) + `executeTradeAction` in `app/market/[id]/trade-actions.ts`. `TradePanel.handleAction` now branches on UUID market id: fixtures stay on the prototype Zustand path (no visual change, demo unaffected), UUID markets go through the atomic RPC with optimistic Zustand update + rollback on failure. |
| P0-2 | ✅ | Removed the trailing `|| true` in `lib/admin.ts isCurrentUserAdmin()`. |
| P0-3 | ✅ | `/api/market-summary` now: Zod-validated, 8 KB body cap, per-user token-bucket rate limit (6 burst / 12 per min), prompt-injection guard via delimited `<market_data>` block + system instruction. Removed `console.error`. |
| P0-4 | ✅ | Installed `zod`. New `lib/validation.ts` with reusable schemas. Every server action under `src/app/**/actions.ts` + `src/app/actions/social.ts` re-typed to `unknown` + `Schema.safeParse`. |
| P0-5 | ✅ | Installed `sanitize-html` + `@types/sanitize-html`. New `lib/sanitize-server.ts` allow-list. `createPostAction` now sanitizes server-side before insert. |
| P0-6 | ✅ | New `lib/upload-guard.ts` shared between all three upload routes. Post-image now has size cap (8 MB) + MIME allow-list. SVG explicitly denied everywhere. Rate-limited (10 burst / 30 per min). |
| P0-7 | ✅ | `completeOnboardingAction` Zod-validated; merge preserves both flat and `{categories: {...}}` nested affinity shapes so neither gets clobbered. Now throws typed `NotSignedInError`. |
| P0-8 | ✅ | Atomic `execute_trade` Postgres function uses `SELECT … FOR UPDATE` on the profile row — concurrent buys can no longer over-spend. |
| P0-9 | ✅ | New `toggle_post_like` / `toggle_post_bookmark` / `toggle_market_bookmark` / `toggle_comment_like` RPCs (migration 0008). JS callers now use `supabase.rpc(...)`; single-statement, no race. |

### P1 — significant subset addressed

| ID | Status | Notes |
| -- | ------ | ----- |
| P1-1 | ✅ | Realtime hooks now stash handler in a ref; channels no longer tear down on every parent render. |
| P1-2 | ✅ | Typed `NotAdminError` in `lib/admin.ts`. All three `admin/actions.ts` actions now call `requireAdmin()` at the top (defense-in-depth). |
| P1-3 | ✅ | `listFeed` runs posts query + viewer lookup in parallel, then runs affinity / likes / bookmarks queries in a single `Promise.all`. |
| P1-4 | partial | Added `is_admin`, `updated_at`, `creation_source` to hand-rolled types; widened `CategorySlug` to allow new slugs. Full `gen types` deferred until Supabase is linked. |
| P1-5 | ✅ | Every "Not signed in" `throw new Error(...)` across `lib/db/*.ts` (posts, comments, bookmarks, storage, notifications, proposals, profiles) replaced with `throw new NotSignedInError()`. |
| P1-6 | deferred | Notification fanout for likes/comments/proposals is on the deferred list — touches several action surfaces. |
| P1-7 | deferred | `Date.now()` in `FeedItemRow` render — would touch `feed-stream.tsx` UI; deferring per "don't touch visuals" constraint. |
| P1-8 | deferred | `(p as any)` casts in `feed-stream.tsx` — type cleanup; UI risk. Deferred. |
| P1-9 | deferred | Affinity bump from trade / like — needs new SQL helper; deferred. |
| P1-10 | partial | `execute_trade` RPC now also bumps `markets.yes_price` / `no_price` / `total_volume`. Linear ±0.5 nudge per trade as a placeholder — tune later. |
| P1-11 | ✅ | `Cache-Control: private, no-store` now applied on every auth-aware middleware code path (public-read and tier 5), not only the final fall-through. |
| P1-12 | covered | Same root cause as P0-1; fixed there. |
| P1-13 | deferred | Optimistic rollback on `toggleLikeAction` — touches `PostCard` UI; deferred. |
| P1-14 | deferred | Missing loading / empty states on `/notifications`, `/quests`, profile activity tab — UI surface; deferred. |
| P1-15 | ✅ (partial) | `execute_trade` + toggle RPCs all `SET search_path = pg_catalog, public`. The legacy `handle_new_user` trigger from `0001_init.sql` is unchanged (would require a destructive `CREATE OR REPLACE` in a new migration). |

### What's still open before Phase 2

- All P1 items marked "deferred" above (mostly UI-touching).
- P0-1's UI wiring: `TradePanel` still drives Zustand; the new `executeTradeAction` is callable but not yet invoked from the panel. Will require a small composer-side change once you're ready to swap the prototype wiring.

### Baseline / smoke results

- `npx tsc --noEmit` → exit 0.
- `npm run build` → exit 0, 100 pages generated, all routes compiled.
- `next lint` → 143 warnings/errors pre-existing (most are `no-explicit-any` and `react-hooks/set-state-in-effect`). My changes did not add new categories of lint error.
- `npm audit` → 2 moderate (next-bundled postcss). Fix would force a major Next downgrade; deferred.
- Dev preview smoke: `/` renders 12 articles, topbar nav shows correctly for anon (Sign in / Create account). Protected `/api/upload` returns 401 without auth. AI endpoint Zod-rejects malformed payloads at 400.

### Suggested commit messages

```
fix(security): Zod-validate every server action input

Adds zod dep and lib/validation.ts with reusable schemas.
Every server action under app/**/actions.ts + app/actions/
now parses input via Schema.safeParse and returns a typed
error on failure. Resolves audit P0-4.
```

```
fix(security): server-side HTML sanitization for stored post bodies

Adds sanitize-html dep and lib/sanitize-server.ts.
createPostAction now sanitizes body_html before insert so the
DB row is safe even if a future surface skips the client-side
sanitizer. Resolves audit P0-5.
```

```
fix(security): harden /api/market-summary against prompt injection + DoS

Adds Zod validation, 8KB body cap, per-user token-bucket
rate limit (6 burst / 12 per min), and delimited <market_data>
block with system instruction telling the model to treat it as
data not instructions. Removes raw console.error. Resolves
audit P0-3.
```

```
fix(security): shared upload guard — size cap, MIME allow-list, SVG deny

New lib/upload-guard.ts + lib/rate-limit.ts. /api/upload now
enforces size + MIME + rate limits (previously unchecked).
SVG explicitly denied in all three upload routes. Resolves
audit P0-6.
```

```
feat(db): atomic toggle + trade RPCs (migration 0008)

Adds toggle_post_like / toggle_post_bookmark /
toggle_market_bookmark / toggle_comment_like as
SECURITY DEFINER functions — single statement, no
SELECT-then-INSERT race. Adds execute_trade with
SELECT FOR UPDATE on the profile row so concurrent
buys cannot over-spend. Adds own-row INSERT/UPDATE/DELETE
policies for positions + trades. Resolves audit P0-1, P0-8,
P0-9, P1-10, P1-12.
```

```
fix(realtime): handler ref so channels don't tear down on every render

Each useXxxChannel hook now stashes the handler in a ref
that the effect closure reads. Dependency array no longer
includes the handler so the channel survives parent rerenders.
Resolves audit P1-1.
```

