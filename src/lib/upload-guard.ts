import "server-only";

/**
 * Shared upload validation for /api/upload* endpoints.
 *
 * Defends against:
 *   - oversized files (DoS, storage cost)
 *   - SVG uploads (XSS via inline <script>)
 *   - lying MIME types (client-declared content-type is untrusted)
 *
 * For real production: also sniff magic bytes via `file-type`. The
 * Supabase Storage API enforces some of this server-side but we don't
 * want to round-trip a 50 MB PNG just to get a 400 back.
 */

export interface UploadGuardOpts {
  maxBytes: number;
  allowedMime: ReadonlySet<string>;
  /** Hard deny — even if it appears in `allowedMime`. Always blocks SVG. */
  deniedMime?: ReadonlySet<string>;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; error: string };

const ALWAYS_DENY = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
]);

export function guardUpload(file: File, opts: UploadGuardOpts): GuardResult {
  if (file.size > opts.maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `File too large — max ${Math.round(opts.maxBytes / 1024 / 1024)}MB`,
    };
  }
  const declared = (file.type || "").toLowerCase().trim();
  if (!declared) {
    return { ok: false, status: 415, error: "Missing content type" };
  }
  if (ALWAYS_DENY.has(declared) || opts.deniedMime?.has(declared)) {
    return { ok: false, status: 415, error: "Unsupported image format" };
  }
  if (!opts.allowedMime.has(declared)) {
    return { ok: false, status: 415, error: "Unsupported image format" };
  }
  return { ok: true };
}

export const POST_IMAGE_GUARD: UploadGuardOpts = {
  maxBytes: 8 * 1024 * 1024,
  allowedMime: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]),
};

export const AVATAR_GUARD: UploadGuardOpts = {
  maxBytes: 4 * 1024 * 1024,
  allowedMime: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]),
};

export const BANNER_GUARD: UploadGuardOpts = {
  maxBytes: 6 * 1024 * 1024,
  allowedMime: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
};
