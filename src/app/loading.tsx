/**
 * Global loading state — shown by Next.js while a route segment is
 * suspending (RSC fetch, dynamic page, etc). Keeps the visual rhythm
 * of the app so a slow Supabase round-trip doesn't blank the screen.
 */
export default function Loading() {
  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full space-y-4">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-[#20232E] animate-pulse" />
        <div className="h-8 w-64 rounded bg-[#20232E] animate-pulse" />
        <div className="h-3 w-80 rounded bg-[#20232E] animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#20232E] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-[#20232E] animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-[#20232E] animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-full rounded bg-[#20232E] animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-[#20232E] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
