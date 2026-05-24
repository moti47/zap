"use client";

import { useEffect } from "react";
import { useZapStore, type UserTrade } from "./store";
import { markets, users } from "./mock-data";

const ENABLED_KEY = "zap-fake-socket-enabled";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleNext() {
  const ms = 3000 + Math.floor(Math.random() * 5000);
  timer = setTimeout(emit, ms);
}

function emit() {
  const store = useZapStore.getState();
  const market = pickRandom(markets);
  const user = pickRandom(users);
  const side: "YES" | "NO" = Math.random() > 0.5 ? "YES" : "NO";
  const live = store.marketPrices[market.id];
  const basePrice =
    side === "YES" ? live?.yes ?? market.currentYesPrice : live?.no ?? market.currentNoPrice;
  const price = Math.max(1, Math.min(99, basePrice + Math.floor((Math.random() - 0.5) * 3)));
  const shares = Math.floor(Math.random() * 300) + 30;
  const trade: UserTrade = {
    id: `live-${Date.now()}`,
    marketId: market.id,
    userId: user.id,
    side,
    shares,
    price,
    timestamp: new Date().toISOString(),
    isMine: false,
  };
  store.pushLiveTrade(trade);
  // 60% chance to nudge the price
  if (Math.random() > 0.4) {
    const delta = Math.random() > 0.5 ? 1 : 0;
    if (delta) store.tickPrice(market.id, side, 1);
  }
  scheduleNext();
}

function start() {
  if (timer) return;
  scheduleNext();
}

function stop() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

let started = false;

export function useFakeSocket() {
  useEffect(() => {
    if (started) return;
    started = true;
    start();
    return () => {
      // Don't stop on unmount — keep emitting across pages
    };
  }, []);
}
