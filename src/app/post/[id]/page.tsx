import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/post/post-card";
import { getPost } from "@/lib/db/posts";
import type { UserPost } from "@/lib/store";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Polish 5 — dedicated post detail page.
 *
 * Global search results, notification deep links, and "open post" CTAs
 * route here so the full body, attached market, and the entire comment
 * thread are visible (the feed truncates long bodies and renders
 * comments collapsed). PostCard mounted with `defaultThreadOpen` —
 * comments load expanded.
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let row: Awaited<ReturnType<typeof getPost>> = null;
  if (hasEnv()) {
    try {
      row = await getPost(id);
    } catch {
      row = null;
    }
  }
  if (!row) notFound();

  const post: UserPost = {
    id: row.id,
    type: "user",
    userId: row.author_id,
    createdAt: row.created_at,
    body: row.body_html,
    category: (row.category?.slug as UserPost["category"]) ?? undefined,
    marketId: row.market_id ?? undefined,
    images: Array.isArray(row.images) ? (row.images as string[]) : undefined,
    likes: row.likes ?? 0,
    comments: row.comments_count ?? 0,
    shares: row.shares ?? 0,
    views: 0,
    isMine: false,
    impressions: 0,
    clicks: 0,
    throttled: false,
    boostEarlyStoppedAt: null,
    authorName: row.author?.name,
    authorUsername: row.author?.username,
    authorAvatar: row.author?.avatar_url ?? null,
  };

  return (
    <div className="mx-auto max-w-[720px] px-4 lg:px-6 py-4 pb-24 lg:pb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#8B92A8] hover:text-white mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to feed
      </Link>
      <PostCard post={post as any} defaultThreadOpen />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasEnv()) return { title: "Post — Zap" };
  try {
    const row = await getPost(id);
    if (!row) return { title: "Post — Zap" };
    const text = String(row.body_html ?? "")
      .replace(/<[^>]+>/g, " ")
      .slice(0, 120)
      .trim();
    return {
      title: text ? `${text} — Zap` : "Post — Zap",
    };
  } catch {
    return { title: "Post — Zap" };
  }
}
