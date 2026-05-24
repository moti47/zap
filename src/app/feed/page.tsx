import { FeedStream } from "@/components/feed-stream";
import { RightSidebar } from "@/components/right-sidebar";
import { DemoSeedButton } from "@/components/demo-seed-button";

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 lg:px-6 py-6 flex gap-8">
      <main className="flex-1 min-w-0 mx-auto w-full max-w-[720px]">
        <FeedStream />
      </main>
      <RightSidebar />
      <DemoSeedButton />
    </div>
  );
}
