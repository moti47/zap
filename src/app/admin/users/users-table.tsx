"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  ShieldCheck,
  Crown,
  UserCog,
  UserX,
  UserCheck,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  setUserRoleAction,
  setUserSuspendedAction,
  setUserZapsAction,
  recomputeUserExpertiseAction,
} from "./actions";
import type { AdminUserRow, AdminRole } from "@/lib/db/admin-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZapMark } from "@/components/zap-logo";
import { cn } from "@/lib/utils";

interface UsersTableProps {
  initialUsers: AdminUserRow[];
  initialQuery: string;
}

const ROLES: AdminRole[] = ["user", "moderator", "admin"];

function roleStyle(role: AdminRole) {
  switch (role) {
    case "admin":
      return "border-[#FFE600]/40 text-[#FFE600] bg-[#FFE600]/10";
    case "moderator":
      return "border-[#4DA3FF]/40 text-[#4DA3FF] bg-[#4DA3FF]/10";
    default:
      return "border-[#2A2F3D] text-[#8B92A8]";
  }
}

export function UsersTable({ initialUsers, initialQuery }: UsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState(initialQuery);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  const onChangeRole = (user: AdminUserRow, nextRole: AdminRole) => {
    if (user.role === nextRole) return;
    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserRoleAction(user.id, nextRole);
      setPendingId(null);
      if (!result.ok) {
        toast.error(`Role change failed: ${result.error}`);
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, role: nextRole, is_admin: nextRole === "admin" }
            : u,
        ),
      );
      toast.success(`@${user.username} → ${nextRole}`);
      router.refresh();
    });
  };

  const onToggleSuspend = (user: AdminUserRow) => {
    const next = !user.is_suspended;
    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserSuspendedAction(user.id, next);
      setPendingId(null);
      if (!result.ok) {
        toast.error(`Status change failed: ${result.error}`);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_suspended: next } : u)),
      );
      toast.success(next ? `@${user.username} suspended` : `@${user.username} reinstated`);
      router.refresh();
    });
  };

  const onSetZaps = (user: AdminUserRow) => {
    const raw = window.prompt(
      `Set Zaps balance for @${user.username}`,
      String(user.zaps),
    );
    if (raw === null) return;
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Zaps must be a non-negative number");
      return;
    }
    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserZapsAction(user.id, Math.floor(next));
      setPendingId(null);
      if (!result.ok) {
        toast.error(`Balance change failed: ${result.error}`);
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, zaps: Math.floor(next) } : u,
        ),
      );
      toast.success(`@${user.username} balance set to ${Math.floor(next)}⚡`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6175]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, name, or email…"
          className="pl-9 max-w-[420px]"
        />
      </div>

      <div className="rounded-[14px] border border-[#2A2F3D] bg-[#1A1D26] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#0E1016] text-[10px] uppercase tracking-widest text-[#5A6175]">
              <tr>
                <th className="text-left font-mono px-4 py-3">User</th>
                <th className="text-left font-mono px-4 py-3">Role</th>
                <th className="text-right font-mono px-4 py-3">Zaps</th>
                <th className="text-left font-mono px-4 py-3">Status</th>
                <th className="text-left font-mono px-4 py-3">Joined</th>
                <th className="text-right font-mono px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[#5A6175] font-mono text-[12px]"
                  >
                    No users match the current filter.
                  </td>
                </tr>
              )}
              {filtered.map((user) => {
                const isBusy = isPending && pendingId === user.id;
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "border-t border-[#2A2F3D] transition-colors",
                      isBusy && "opacity-60",
                      user.is_suspended && "bg-[#FF4757]/5",
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full border border-[#2A2F3D] object-cover"
                          />
                        ) : (
                          <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8A3D] grid place-items-center text-[#0A0B0F] font-bold text-[11px]">
                            {(user.name || user.username || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">
                            {user.name || user.username}
                          </div>
                          <div className="font-mono text-[11px] text-[#5A6175] truncate">
                            @{user.username}
                            {user.email ? ` · ${user.email}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono border",
                          roleStyle(user.role),
                        )}
                      >
                        {user.role === "admin" ? (
                          <Crown className="h-3 w-3" />
                        ) : user.role === "moderator" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <UserCog className="h-3 w-3" />
                        )}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => onSetZaps(user)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 font-mono text-[#FFE600] hover:underline disabled:opacity-50"
                      >
                        {user.zaps.toLocaleString()} <ZapMark />
                      </button>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono border",
                          user.is_suspended
                            ? "border-[#FF4757]/40 text-[#FF4757] bg-[#FF4757]/10"
                            : "border-[#36D399]/40 text-[#36D399] bg-[#36D399]/10",
                        )}
                      >
                        {user.is_suspended ? "suspended" : "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-[11px] text-[#8B92A8]">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <Link
                          href={`/profile/${encodeURIComponent(user.username)}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8B92A8] hover:text-[#FFE600]"
                          aria-label={`Open ${user.username}'s profile`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          profile
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setPendingId(user.id);
                            startTransition(async () => {
                              const r = await recomputeUserExpertiseAction(user.id);
                              setPendingId(null);
                              if (!r.ok) {
                                toast.error(`Expertise recompute failed: ${r.error}`);
                              } else {
                                toast.success(
                                  `Expertise refreshed (${r.touched} categor${r.touched === 1 ? "y" : "ies"})`,
                                );
                              }
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-[#4DA3FF] hover:underline disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          recompute
                        </button>
                        <div className="flex rounded-md border border-[#2A2F3D] overflow-hidden">
                          {ROLES.map((r) => (
                            <button
                              key={r}
                              type="button"
                              disabled={isBusy || user.role === r}
                              onClick={() => onChangeRole(user, r)}
                              className={cn(
                                "px-2 py-1 text-[10.5px] font-mono transition-colors",
                                user.role === r
                                  ? "bg-[#20232E] text-white"
                                  : "text-[#8B92A8] hover:text-white hover:bg-[#20232E]/60",
                                isBusy && "opacity-50 cursor-wait",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => onToggleSuspend(user)}
                          className={cn(
                            "text-[11px]",
                            user.is_suspended
                              ? "text-[#36D399]"
                              : "text-[#FF4757]",
                          )}
                        >
                          {user.is_suspended ? (
                            <>
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Reinstate
                            </>
                          ) : (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-1" />
                              Suspend
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] font-mono text-[#5A6175]">
        Showing {filtered.length} of {users.length} loaded profiles · changes
        write to <code>public.profiles</code> via service role.
      </p>
    </div>
  );
}
