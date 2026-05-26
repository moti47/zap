import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#FFE600]/10 border border-[#FFE600]/30 mb-4">
          <Compass className="h-7 w-7 text-[#FFE600]" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Lost in space</h1>
        <p className="mt-2 text-[14px] text-[#8B92A8]">
          We couldn&apos;t find the page you&apos;re looking for. Try heading
          back to the feed or grabbing a quest reward.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FFE600] text-[#0E1016] text-[13px] font-bold hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Back to feed
          </Link>
          <Link
            href="/quests"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#2A2F3D] text-white text-[13px] font-semibold hover:border-[#FFE600]/40 transition-colors"
          >
            Daily quests
          </Link>
        </div>
      </div>
    </div>
  );
}
