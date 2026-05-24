"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface MentionUser {
  id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
}

interface Props {
  query: string | null;
  onPick: (u: MentionUser) => void;
  onClose: () => void;
}

/**
 * Lightweight @-mention picker. Watches `query` (the partial token after `@`
 * preceding the cursor in the composer) and fetches matches from
 * /api/mentions. Click or keyboard-pick to insert. Hides automatically
 * when query is null/empty.
 */
export function MentionPopover({ query, onPick, onClose }: Props) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!query) {
      setUsers([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/mentions?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        const json = await res.json();
        setUsers(json.users ?? []);
        setActiveIdx(0);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Keyboard nav while open.
  useEffect(() => {
    if (!query || users.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(users.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Tab" || e.key === "Enter") {
        const u = users[activeIdx];
        if (u) {
          e.preventDefault();
          onPick(u);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [query, users, activeIdx, onPick, onClose]);

  const open = !!query && (loading || users.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="mt-2 rounded-md border border-[#2A2F3D] bg-[#1A1D26] shadow-xl shadow-black/40 overflow-hidden"
          role="listbox"
        >
          <div className="px-3 py-1.5 border-b border-[#2A2F3D] flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#5A6175]">
            <AtSign className="h-3 w-3" />
            Mention @{query}
          </div>
          {users.length === 0 ? (
            <div className="p-3 text-xs text-[#5A6175]">
              {loading ? "Looking up…" : "No matches"}
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {users.map((u, i) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIdx === i}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(u);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      activeIdx === i
                        ? "bg-[#20232E]"
                        : "hover:bg-[#20232E]/40",
                    )}
                  >
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover bg-[#20232E]"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] flex items-center justify-center text-[10px] font-bold text-[#0A0B0F]">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {u.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#5A6175] truncate">
                        @{u.username}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
