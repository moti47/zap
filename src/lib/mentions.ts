/**
 * Phase 9 — @mention parsing helpers used by both client and server.
 * Extracts unique `@username` tokens from a body string.
 */
const RE = /(?:^|[\s>(])@([a-z0-9_]{2,30})\b/gi;

export function extractMentions(input: string): string[] {
  const out = new Set<string>();
  if (!input) return [];
  for (const m of input.matchAll(RE)) out.add(m[1].toLowerCase());
  return [...out];
}

/**
 * Replace plain-text @username tokens with anchor links to /profile/{username}.
 * Safe for already-HTML strings — only matches outside of tag markers.
 */
export function linkifyMentions(html: string): string {
  if (!html) return html;
  return html.replace(RE, (full, username, offset, source) => {
    const lead = full[0] === "@" ? "" : full[0];
    const safe = String(username).toLowerCase();
    return `${lead}<a href="/profile/${safe}" data-mention="${safe}" class="mention">@${username}</a>`;
  });
}
