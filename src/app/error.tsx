"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Global error boundary. Renders when a route segment crashes at
 * render time. The fallback gives users a clear recovery path
 * (retry / go home) instead of a white screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep noisy traces out of the user-facing console but still log
    // for developer debugging.
    console.error("[zap error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#FF4757]/10 border border-[#FF4757]/30 mb-4">
          <AlertTriangle className="h-7 w-7 text-[#FF4757]" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Something broke</h1>
        <p className="mt-2 text-[14px] text-[#8B92A8]">
          We hit an unexpected error rendering this page. Try again, or
          head back to the feed.
        </p>
        {error.digest && (
          <p className="mt-2 text-[10px] font-mono text-[#5A6175]">
            digest: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FFE600] text-[#0E1016] text-[13px] font-bold hover:scale-[1.02] active:scale-95 transition-transform"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#2A2F3D] text-white text-[13px] font-semibold hover:border-[#FFE600]/40 transition-colors"
          >
            Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}
