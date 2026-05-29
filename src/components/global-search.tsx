"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  TrendingUp,
  User as UserIcon,
  FileText,
  CornerDownLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

interface SearchResults {
  query: string;
  profiles: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
    bio: string | null;
  }[];
  markets: {
    id: string;
    question: string;
    yes_price: number;
    no_price: number;
    category: { slug: string; name: string; color: string };
  }[];
  posts: {
    id: string;
    body_html: string;
    market_id: string | null;
    author: { username: string; name: string } | null;
    category: { slug: string; name: string; color: string } | null;
  }[];
}

interface FlatResult {
  kind: "profile" | "market" | "post";
  id: string;
  href: string;
  title: string;
  subtitle: string;
  color?: string;
}

function flatten(r: SearchResults | null): FlatResult[] {
  if (!r) return [];
  return [
    ...r.profiles.map((p) => ({
      kind: "profile" as const,
      id: p.id,
      href: `/profile/${p.username}`,
      title: p.name,
      subtitle: `@${p.username}${p.bio ? ` · ${p.bio.slice(0, 64)}` : ""}`,
    })),
    ...r.markets.map((m) => ({
      kind: "market" as const,
      id: m.id,
      href: `/market/${m.id}`,
      title: m.question,
      subtitle: `${Math.round(m.yes_price)}% YES · ${m.category?.name ?? ""}`,
      color: m.category?.color,
    })),
    ...r.posts.map((p) => {
      const text = p.body_html.replace(/<[^>]+>/g, " ").slice(0, 100);
      return {
        kind: "post" as const,
        id: p.id,
        // Polish 5 — link to the dedicated /post/[id] route so the
        // full body + comment thread are visible. The old hash-anchor
        // hop into /feed never scrolled to the post and never opened
        // the comments.
        href: `/post/${p.id}`,
        title: text || "(post)",
        subtitle: p.author
          ? `@${p.author.username} · ${p.category?.name ?? ""}`
          : p.category?.name ?? "",
        color: p.category?.color,
      };
    }),
  ];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        const json = (await res.json()) as SearchResults;
        setResults(json);
        setActiveIdx(0);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          setResults({ query: trimmed, profiles: [], markets: [], posts: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
      setActiveIdx(0);
    }
  }, [open]);

  const flat = useMemo(() => flatten(results), [results]);

  const go = (r: FlatResult) => {
    onOpenChange(false);
    router.push(r.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Search across markets, people, and posts.
          </DialogDescription>
        </DialogHeader>
        <div className="p-3 border-b border-[#2A2F3D] flex items-center gap-2">
          <Search className="h-4 w-4 text-[#5A6175] ml-2" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                const r = flat[activeIdx];
                if (r) go(r);
              }
            }}
            placeholder="Search markets, people, posts…"
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          />
          {loading && (
            <Loader2 className="h-4 w-4 text-[#5A6175] animate-spin mr-2" />
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <Hint />
          ) : flat.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#8B92A8]">
              {loading ? "Searching…" : `No results for "${q.trim()}"`}
            </div>
          ) : (
            <>
              {results?.profiles && results.profiles.length > 0 && (
                <Group title="People" icon={UserIcon}>
                  {results.profiles.map((p, i) => {
                    const idx = i;
                    return (
                      <Row
                        key={p.id}
                        active={
                          activeIdx === idx &&
                          activeIdx < results.profiles.length
                        }
                        onClick={() =>
                          go({
                            kind: "profile",
                            id: p.id,
                            href: `/profile/${p.username}`,
                            title: p.name,
                            subtitle: `@${p.username}`,
                          })
                        }
                      >
                        <Avatar src={p.avatar_url} name={p.name} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] font-mono text-[#5A6175] truncate">
                            @{p.username}
                            {p.bio ? ` · ${p.bio.slice(0, 64)}` : ""}
                          </div>
                        </div>
                      </Row>
                    );
                  })}
                </Group>
              )}
              {results?.markets && results.markets.length > 0 && (
                <Group title="Markets" icon={TrendingUp}>
                  {results.markets.map((m, i) => {
                    const idx = (results?.profiles.length ?? 0) + i;
                    return (
                      <Row
                        key={m.id}
                        active={activeIdx === idx}
                        onClick={() =>
                          go({
                            kind: "market",
                            id: m.id,
                            href: `/market/${m.id}`,
                            title: m.question,
                            subtitle: `${Math.round(m.yes_price)}% YES`,
                          })
                        }
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: m.category?.color || "#FFE600" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm line-clamp-2">
                            {m.question}
                          </div>
                          <div className="text-[11px] font-mono text-[#5A6175]">
                            {Math.round(m.yes_price)}% YES ·{" "}
                            {m.category?.name ?? ""}
                          </div>
                        </div>
                      </Row>
                    );
                  })}
                </Group>
              )}
              {results?.posts && results.posts.length > 0 && (
                <Group title="Posts" icon={FileText}>
                  {results.posts.map((p, i) => {
                    const idx =
                      (results?.profiles.length ?? 0) +
                      (results?.markets.length ?? 0) +
                      i;
                    const text = p.body_html
                      .replace(/<[^>]+>/g, " ")
                      .slice(0, 120);
                    return (
                      <Row
                        key={p.id}
                        active={activeIdx === idx}
                        onClick={() =>
                          go({
                            kind: "post",
                            id: p.id,
                            href: p.market_id
                              ? `/market/${p.market_id}#post-${p.id}`
                              : `/feed#post-${p.id}`,
                            title: text,
                            subtitle: "",
                          })
                        }
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{
                            background: p.category?.color || "#FFE600",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm line-clamp-2">{text}</div>
                          <div className="text-[11px] font-mono text-[#5A6175]">
                            {p.author ? `@${p.author.username}` : ""}
                            {p.category ? ` · ${p.category.name}` : ""}
                          </div>
                        </div>
                      </Row>
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#2A2F3D] flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" />
            </Kbd>{" "}
            open
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[#5A6175] flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
        active ? "bg-[#20232E]" : "hover:bg-[#20232E]/40",
      )}
    >
      {children}
    </button>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className="h-7 w-7 rounded-full object-cover bg-[#20232E] shrink-0"
      />
    );
  }
  return (
    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[#0A0B0F] text-xs font-bold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Hint() {
  return (
    <div className="p-6 text-center text-sm text-[#8B92A8]">
      <Search className="h-5 w-5 mx-auto text-[#5A6175]" />
      <div className="mt-2">
        Search markets, people, and posts.
      </div>
      <div className="mt-1 text-[11px] font-mono text-[#5A6175]">
        Tip: open with <Kbd>⌘</Kbd>+<Kbd>K</Kbd>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-[#2A2F3D] bg-[#14161D] text-[10px] font-mono text-[#8B92A8]">
      {children}
    </kbd>
  );
}
