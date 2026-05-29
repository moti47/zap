// Lightweight HTML allow-list sanitizer for rich-text post bodies.
// Runs only in the browser. SSR-safe fallback returns text-stripped HTML.

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN",
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
  "H2", "H3",
  "UL", "OL", "LI",
  "BLOCKQUOTE", "CODE", "PRE",
  "A", "IMG", "MARK",
]);

const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ["href", "title", "target", "rel"],
  IMG: ["src", "alt"],
  SPAN: ["style"],
  MARK: ["style"],
  P: ["style"],
};

// allow only color & background-color from inline styles
function sanitizeStyle(style: string): string {
  const parts = style.split(";").map((s) => s.trim()).filter(Boolean);
  const safe: string[] = [];
  for (const p of parts) {
    const [rawKey, ...rest] = p.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) continue;
    if (key !== "color" && key !== "background-color") continue;
    // only hex / rgb / rgba / named-ish
    if (!/^(#[0-9a-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|[a-z]+)$/i.test(value)) continue;
    safe.push(`${key}: ${value}`);
  }
  return safe.join("; ");
}

function sanitizeUrl(url: string): string | null {
  const v = url.trim();
  if (/^(https?:|mailto:|\/)/i.test(v)) return v;
  if (/^data:image\//i.test(v)) return v;
  return null;
}

function cleanNode(node: Element) {
  // remove disallowed tags by replacing with their children
  const tag = node.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
    return;
  }
  // attribute scrub
  const allowed = ALLOWED_ATTRS[tag] ?? [];
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) {
      node.removeAttribute(attr.name);
      continue;
    }
    if (!allowed.includes(name)) {
      node.removeAttribute(attr.name);
      continue;
    }
    if (name === "href" || name === "src") {
      const safe = sanitizeUrl(attr.value);
      if (!safe) node.removeAttribute(attr.name);
      else node.setAttribute(attr.name, safe);
    }
    if (name === "style") {
      const safe = sanitizeStyle(attr.value);
      if (!safe) node.removeAttribute("style");
      else node.setAttribute("style", safe);
    }
  }
  if (tag === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
  for (const child of Array.from(node.children)) cleanNode(child as Element);
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // SSR fallback — strip tags entirely
    return input.replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstChild as Element | null;
  if (!root) return "";
  for (const child of Array.from(root.children)) cleanNode(child as Element);
  return root.innerHTML;
}

/**
 * Wrap bare `#word` patterns in post body HTML with category links.
 * Skips text that's already inside an <a> tag.
 * Must be called AFTER sanitizeHtml so the DOM is already trusted.
 */
export function linkifyHashtags(html: string): string {
  if (!html || !html.includes("#")) return html;
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as Element | null;
  if (!root) return html;

  function processText(node: Text) {
    const text = node.textContent ?? "";
    if (!/#\w/.test(text)) return;
    // Bail if already inside an anchor
    let cur: Node | null = node.parentNode;
    while (cur && cur !== root) {
      if ((cur as Element).tagName === "A") return;
      cur = cur.parentNode;
    }
    const parts = text.split(/(#[A-Za-z]\w*)/g);
    if (parts.length <= 1) return;
    const frag = doc.createDocumentFragment();
    for (const part of parts) {
      if (/^#[A-Za-z]\w*$/.test(part)) {
        const a = doc.createElement("a");
        a.href = `/category/${part.slice(1).toLowerCase()}`;
        a.textContent = part;
        a.className = "hashtag-link";
        frag.appendChild(a);
      } else {
        frag.appendChild(doc.createTextNode(part));
      }
    }
    node.parentNode?.replaceChild(frag, node);
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processText(node as Text);
      return;
    }
    if ((node as Element).tagName === "A") return;
    // snapshot childNodes — walk mutates in place
    for (const child of Array.from(node.childNodes)) walk(child);
  }

  walk(root);
  return root.innerHTML;
}

export function htmlToPlainText(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return input.replace(/<[^>]*>/g, "").trim();
  }
  const doc = new DOMParser().parseFromString(input, "text/html");
  return (doc.body.textContent ?? "").trim();
}
