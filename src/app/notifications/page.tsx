import { NotificationsList } from "@/components/notifications-list";
import { listMyNotifications } from "@/lib/db/notifications";
import { getCurrentProfile } from "@/lib/db/profiles";
import { notifications as mockNotifications } from "@/lib/fixtures";
import { isDemoMode } from "@/lib/demo-mode";
import type {
  NotificationWithPayload,
  NotificationKind,
} from "@/lib/db/notifications";

export const dynamic = "force-dynamic";

function fallbackFromMocks(): NotificationWithPayload[] {
  return mockNotifications.map((n, i) => ({
    id: n.id || `mock-${i}`,
    user_id: "",
    type: (n.type === "resolution"
      ? "market_resolved"
      : n.type === "trade"
        ? "trade"
        : n.type === "follow"
          ? "follow"
          : "comment") as NotificationKind,
    payload: {
      title: n.title,
      body: n.body,
    },
    read: !n.unread,
    created_at: n.timestamp,
  }));
}

export default async function NotificationsPage() {
  let profile = null;
  let items: NotificationWithPayload[] = [];
  try {
    profile = await getCurrentProfile();
    items = await listMyNotifications(100);
  } catch {
    profile = null;
  }
  // Real users get real notifications, including an empty list. Mock
  // fallback is only for demo mode.
  if (items.length === 0 && isDemoMode()) {
    items = fallbackFromMocks();
  }
  return (
    <NotificationsList
      initial={items}
      userId={profile?.id ?? null}
      variant="page"
    />
  );
}
