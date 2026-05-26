"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signUpWithPassword } from "../actions";

export function SignUpForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await signUpWithPassword({
        email,
        password,
        name,
        username,
        next,
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 relative">
      {pending && (
        <div className="absolute inset-0 -m-2 rounded-xl bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-auto">
          <div className="flex items-center gap-2 text-sm text-white/90">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
            Creating your account…
          </div>
        </div>
      )}

      <input
        required
        disabled={pending}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
      />
      <input
        required
        pattern="[a-z0-9_]{3,20}"
        title="3–20 chars, lowercase letters, numbers, or underscore"
        disabled={pending}
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        placeholder="username"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
      />
      <input
        type="email"
        autoComplete="email"
        required
        disabled={pending}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
      />
      <input
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        disabled={pending}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 6 chars)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
      />

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black transition hover:bg-yellow-300 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
