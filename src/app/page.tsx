import { FeedStream } from "@/components/feed-stream";
import { RightSidebar } from "@/components/right-sidebar";
import { DemoSeedButton } from "@/components/demo-seed-button";
import { listFeed, type PostWithRelations } from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const hasEnv = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function Home() {
  let initialServerPosts: PostWithRelations[] = [];
  let initialSignedIn = false;
  if (hasEnv()) {
    try {
      // Resolve auth + feed in parallel so the composer paints in the
      // first render without waiting on a client-side useViewer round-
      // trip. (Was the source of the "feed → wait → composer pops in"
      // jank the user flagged.)
      const supabase = await createClient();
      const [{ data: authData }, feed] = await Promise.all([
        supabase.auth.getUser(),
        listFeed({ limit: 30 }).catch(() => [] as PostWithRelations[]),
      ]);
      initialSignedIn = !!authData?.user;
      initialServerPosts = feed;
    } catch {
      initialServerPosts = [];
    }
  }
  return (
    <div className="mx-auto max-w-[1180px] px-4 lg:px-6 py-6 flex gap-8">
      <main className="flex-1 min-w-0 mx-auto w-full max-w-[720px]">
        <FeedStream
          initialServerPosts={initialServerPosts}
          initialSignedIn={initialSignedIn}
        />
      </main>
      <RightSidebar initialSignedIn={initialSignedIn} />
      <DemoSeedButton />
    </div>
  );
}
