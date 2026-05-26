import type { NextConfig } from "next";

/**
 * Image domains.
 *
 * Avatars + post images + banners are uploaded into a public Supabase
 * Storage bucket. The public URL has the shape:
 *
 *   https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * We parse the project ref out of `NEXT_PUBLIC_SUPABASE_URL` at build
 * time so the same `next.config.ts` works across environments without
 * having to hard-code the ref. We also allow the data: protocol so the
 * env-less fallback in /api/upload* (base64 data URLs) still renders
 * via <Image unoptimized>.
 */
function supabaseStorageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const sbHost = supabaseStorageHost();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      // Supabase Storage — project-specific host.
      ...(sbHost
        ? [
            {
              protocol: "https" as const,
              hostname: sbHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Allow any *.supabase.co for previews where the env isn't baked
      // into the build (the project-specific entry above still wins
      // when configured).
      {
        protocol: "https" as const,
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // The avatar/banner buckets serve large files; we want next/image
    // to optimize them but also fall back gracefully via `unoptimized`
    // on the per-image opt-out where data URLs are used.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
