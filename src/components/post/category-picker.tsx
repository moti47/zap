"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { Category, CATEGORIES } from "@/lib/types";
import { cn, categoryColor } from "@/lib/utils";

const CATEGORY_DETAILS: Record<
  Category,
  { title: string; description: string; icon: string }
> = {
  politics:      { title: "Politics",      description: "Elections, policy, world affairs",   icon: "🏛️" },
  crypto:        { title: "Crypto",        description: "Tokens, protocols, on-chain markets", icon: "🔗" },
  sports:        { title: "Sports",        description: "Leagues, matches, MVPs",              icon: "🏆" },
  tech:          { title: "Tech",          description: "AI, hardware, product launches",      icon: "⚡" },
  economy:       { title: "Economy",       description: "Rates, inflation, macro calls",       icon: "📈" },
  entertainment: { title: "Entertainment", description: "Films, music, pop culture",           icon: "🎬" },
};

interface CategoryPickerProps {
  open: boolean;
  onClose: () => void;
  value: Category | "";
  onChange: (next: Category) => void;
}

/**
 * Premium category picker.
 *
 *   Mobile: bottom sheet with backdrop blur, spring slide-up, drag handle,
 *           gesture-to-close. Backdrop is a tinted blur of the page.
 *   Desktop: centered modal with subtle scale/fade animation.
 *
 * Visual identity matches Zap: dark surface (#1A1D26 → #14161D), category
 * accent glows, monospace metadata, gradient on the active tile. Fully
 * keyboard-accessible — arrow keys move focus, Enter selects, Esc closes.
 */
export function CategoryPicker({
  open,
  onClose,
  value,
  onChange,
}: CategoryPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync the keyboard cursor with the current value on open.
  useEffect(() => {
    if (!open) return;
    const idx = value ? Math.max(0, CATEGORIES.indexOf(value as Category)) : 0;
    setActiveIndex(idx);
    // Focus the panel so Esc / arrow keys work without an extra click.
    const t = setTimeout(() => dialogRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, value]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cat = CATEGORIES[activeIndex];
        if (cat) {
          onChange(cat);
          onClose();
        }
      } else if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown"
      ) {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % CATEGORIES.length);
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, onChange, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — blurred and dim, click-to-close. */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-[#0A0B0F]/70 backdrop-blur-md"
            aria-hidden
          />

          {/* Panel — mobile bottom sheet, desktop centered modal. */}
          <motion.div
            key="panel"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal
            aria-label="Pick a category"
            initial={{
              opacity: 0,
              y: typeof window !== "undefined" && window.innerWidth < 640 ? 600 : 16,
              scale: 0.96,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: typeof window !== "undefined" && window.innerWidth < 640 ? 600 : 12,
              scale: 0.97,
            }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 32,
            }}
            drag={
              typeof window !== "undefined" && window.innerWidth < 640 ? "y" : false
            }
            dragConstraints={{ top: 0, bottom: 240 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "fixed z-[101] outline-none",
              // Mobile: bottom sheet
              "left-0 right-0 bottom-0 sm:bottom-auto",
              // Desktop: centered modal
              "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
              "w-full sm:w-[640px] max-w-full",
            )}
          >
            <div
              className={cn(
                "bg-gradient-to-b from-[#1A1D26] to-[#14161D]",
                "border border-[#2A2F3D]",
                "shadow-[0_-20px_60px_rgba(0,0,0,0.7)] sm:shadow-[0_30px_120px_rgba(0,0,0,0.7)]",
                "rounded-t-[20px] sm:rounded-[18px]",
                "max-h-[85vh] sm:max-h-[80vh] overflow-y-auto",
              )}
            >
              {/* Drag handle (mobile only) */}
              <div className="sm:hidden flex justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#353B4D]" />
              </div>

              <header className="px-5 py-4 flex items-center justify-between border-b border-[#2A2F3D]">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#FFE600]">
                    Step 1
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    Pick a category
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 -m-2 rounded-md text-[#8B92A8] hover:text-white hover:bg-[#20232E]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((c, i) => {
                  const active = value === c;
                  const focused = i === activeIndex;
                  const meta = CATEGORY_DETAILS[c];
                  const color = categoryColor(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(c);
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "relative group text-left rounded-[14px] border p-4 transition-all",
                        "flex items-start gap-3",
                        active
                          ? "scale-[1.01]"
                          : "hover:scale-[1.01]",
                      )}
                      style={{
                        borderColor: active || focused ? color : "#2A2F3D",
                        background: active
                          ? `linear-gradient(135deg, ${color}18, transparent 60%)`
                          : focused
                            ? `linear-gradient(135deg, ${color}0c, transparent 60%)`
                            : "#14161D",
                        boxShadow: active
                          ? `0 0 0 3px ${color}30, 0 8px 28px ${color}22`
                          : focused
                            ? `0 0 0 2px ${color}22`
                            : undefined,
                      }}
                    >
                      <div
                        className="text-2xl shrink-0 grid place-items-center h-11 w-11 rounded-[10px]"
                        style={{
                          background: `${color}1a`,
                          border: `1px solid ${color}30`,
                        }}
                        aria-hidden
                      >
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[15px] font-bold capitalize"
                          style={{ color: active ? color : "white" }}
                        >
                          {meta.title}
                        </div>
                        <div className="text-[12px] text-[#8B92A8] mt-0.5 leading-snug">
                          {meta.description}
                        </div>
                      </div>
                      {active && (
                        <div
                          className="grid place-items-center h-6 w-6 rounded-full"
                          style={{ background: color, color: "#0A0B0F" }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <footer className="px-5 py-3 border-t border-[#2A2F3D] flex items-center justify-between text-[10.5px] font-mono text-[#5A6175]">
                <span>↑↓ ← → navigate · ⏎ select · esc to close</span>
                <span>{CATEGORIES.length} categories</span>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
