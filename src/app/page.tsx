import { FeedStream } from "@/components/feed-stream";
import { RightSidebar } from "@/components/right-sidebar";
import { DemoSeedButton } from "@/components/demo-seed-button";
import { listFeed, type PostWithRelations } from "@/lib/db/posts";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function Home() {
  let initialServerPosts: PostWithRelations[] = [];
  if (hasEnv()) {
    try {
      initialServerPosts = await listFeed({ limit: 30 });
    } catch {
      initialServerPosts = [];
    }
  }
  return (
    <div className="mx-auto max-w-[1180px] px-4 lg:px-6 py-6 flex gap-8">
      <main className="flex-1 min-w-0 mx-auto w-full max-w-[720px]">
        <FeedStream initialServerPosts={initialServerPosts} />
      </main>
      <RightSidebar />
      <DemoSeedButton />
    </div>
  );
}
