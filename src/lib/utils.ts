import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return `${Math.round(price)}`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function formatPoints(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function brierScore(predictions: { predicted: number; outcome: 0 | 1 }[]): number {
  if (predictions.length === 0) return 0;
  const sum = predictions.reduce(
    (acc, p) => acc + Math.pow(p.predicted - p.outcome, 2),
    0
  );
  return sum / predictions.length;
}

export function percentile(value: number, sample: number[]): number {
  if (sample.length === 0) return 0;
  const below = sample.filter((v) => v < value).length;
  return Math.round((below / sample.length) * 100);
}

export function timeAgo(dateString: string): string {
  const d = new Date(dateString);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function timeUntil(dateString: string): string {
  const d = new Date(dateString);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "Resolved";
  const sec = Math.floor(diffMs / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  if (days > 1) return `${days} days`;
  if (days === 1) return `1 day ${hours}h`;
  if (hours > 1) return `${hours} hours`;
  const minutes = Math.floor((sec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    politics: "#A371F7",
    crypto: "#FF8A3D",
    sports: "#36D399",
    tech: "#4DA3FF",
    economy: "#F7768E",
    entertainment: "#FF6FB5",
  };
  return map[category.toLowerCase()] ?? "#8B92A8";
}

export function categoryRingClass(category: string): string {
  const map: Record<string, string> = {
    politics: "ring-[#A371F7]",
    crypto: "ring-[#FF8A3D]",
    sports: "ring-[#36D399]",
    tech: "ring-[#4DA3FF]",
    economy: "ring-[#F7768E]",
    entertainment: "ring-[#FF6FB5]",
  };
  return map[category.toLowerCase()] ?? "ring-[#8B92A8]";
}

export function categoryTextClass(category: string): string {
  const map: Record<string, string> = {
    politics: "text-[#A371F7]",
    crypto: "text-[#FF8A3D]",
    sports: "text-[#36D399]",
    tech: "text-[#4DA3FF]",
    economy: "text-[#F7768E]",
    entertainment: "text-[#FF6FB5]",
  };
  return map[category.toLowerCase()] ?? "text-[#8B92A8]";
}

export function avatarUrl(seed: string, style: string = "shapes"): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(
    seed
  )}&backgroundType=gradientLinear`;
}

export function generatePriceHistory(
  startPrice: number,
  days: number,
  volatility: number = 4,
  seed: number = Math.floor(startPrice * 9973 + days * 17)
): { timestamp: string; yesPrice: number }[] {
  // Deterministic, seedable RNG so server-render === client-render
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  // Pin "now" to midnight so SSR and CSR agree on the day bucket
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const now = today.getTime();
  const out: { timestamp: string; yesPrice: number }[] = [];
  let p = startPrice;
  for (let i = days - 1; i >= 0; i--) {
    const drift = (rand() - 0.5) * volatility;
    p = Math.max(1, Math.min(99, p + drift));
    out.push({
      timestamp: new Date(now - i * 86400000).toISOString(),
      yesPrice: Math.round(p),
    });
  }
  return out;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function shortAddress(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
