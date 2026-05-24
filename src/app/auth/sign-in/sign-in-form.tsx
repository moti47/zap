"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signInWithPassword, signInWithMagicLink } from "../actions";

export function SignInForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      if (mode === "magic") {
        const result = await signInWithMagicLink(email);
        if (result?.error) setError(result.error);
        else toast.success("Check your email for the magic link.");
      } else {
        const result = await signInWithPassword(email, password, next);
        if (result?.error) setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="flex gap-2 rounded-lg bg-black/30 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-md py-1.5 transition ${
            mode === "password" ? "bg-white/10 text-white" : "text-white/60"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`flex-1 rounded-md py-1.5 transition ${
            mode === "magic" ? "bg-white/10 text-white" : "text-white/60"
          }`}
        >
          Magic link
        </button>
      </div>

      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400"
      />

      {mode === "password" && (
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black transition hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending ? "Working…" : mode === "magic" ? "Send magic link" : "Sign in"}
      </button>
    </form>
  );
}
