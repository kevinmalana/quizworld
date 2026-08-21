"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

type NotifItem = {
  id: string;
  notificationId?: string;
  type: "friend_request" | "classroom_join" | "group_join" | "classroom_nudge";
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Notification bell — polls for unread events every 30s.
 * Uses existing tables (friendships, classroom_members, trivia_group_members)
 * rather than a dedicated notifications table.
 *
 * Upgrade path: replace polling with Supabase Realtime when a notifications
 * table is added to the DB.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    // Persist dismissed notifications across page loads
    try {
      const stored = localStorage.getItem("qw_seen_notifs");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  async function dismissAll() {
    setNotificationError("");
    const persistedIds = items.flatMap(item => item.notificationId ? [item.notificationId] : []);
    if (persistedIds.length > 0) {
      const { error } = await supabase.rpc("mark_notifications_read", { p_notification_ids: persistedIds });
      if (error) {
        setNotificationError("Could not mark notifications as read. Please try again.");
        return;
      }
    }
    const legacyIds = items.filter(item => !item.notificationId).map(item => item.id);
    const next = new Set([...seenIds, ...legacyIds]);
    setSeenIds(next);
    try { localStorage.setItem("qw_seen_notifs", JSON.stringify([...next])); } catch {}
    setItems([]);
    setOpen(false);
  }

  async function dismissOne(item: NotifItem) {
    setNotificationError("");
    if (item.notificationId) {
      const { error } = await supabase.rpc("mark_notifications_read", { p_notification_ids: [item.notificationId] });
      if (error) {
        setNotificationError("Could not mark this notification as read. Please try again.");
        return;
      }
    } else {
      const next = new Set([...seenIds, item.id]);
      setSeenIds(next);
      try { localStorage.setItem("qw_seen_notifs", JSON.stringify([...next])); } catch {}
    }
    setItems(current => current.filter(candidate => candidate.id !== item.id));
    setOpen(false);
  }

  // Close dropdown on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;

    const [notificationRes, friendRes, classRes, groupRes] = await Promise.all([
      // Durable notifications such as teacher assignment reminders.
      supabase.from("notifications")
        .select("id, type, title, message, href")
        .eq("user_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
      // Pending friend requests TO me
      supabase.from("friendships")
        .select("id, requester_id, profiles!friendships_requester_id_fkey(username, display_name)")
        .eq("addressee_id", user.id)
        .eq("status", "pending"),
      // Classrooms I was added to in the last 24h (teacher added me)
      supabase.from("classroom_members")
        .select("id, classroom_id, classrooms(name)")
        .eq("user_id", user.id)
        .eq("role", "student")
        .gte("joined_at", new Date(Date.now() - 86400000).toISOString())
        .limit(5),
      // Groups I joined or was added to in last 24h
      supabase.from("trivia_group_members")
        .select("id, group_id, trivia_groups(name)")
        .eq("user_id", user.id)
        .gte("joined_at", new Date(Date.now() - 86400000).toISOString())
        .limit(5),
    ]);

    const notifs: NotifItem[] = [];

    (notificationRes.data ?? []).forEach((notification: { id: string; type: string; title: string; message: string; href: string }) => {
      if (notification.type !== "classroom_nudge") return;
      notifs.push({
        id: `nt-${notification.id}`,
        notificationId: notification.id,
        type: "classroom_nudge",
        title: notification.title,
        subtitle: notification.message,
        href: notification.href,
      });
    });

    (friendRes.data ?? []).forEach((f: { id: string; requester_id: string; profiles: { username: string; display_name: string }[] }) => {
      const name = f.profiles?.[0]?.display_name || f.profiles?.[0]?.username || "Someone";
      notifs.push({
        id: `fr-${f.id}`,
        type: "friend_request",
        title: "Friend Request",
        subtitle: `${name} wants to be friends`,
        href: "/friends",
      });
    });

    (classRes.data ?? []).forEach((c: { id: string; classroom_id: string; classrooms: { name: string }[] }) => {
      const name = c.classrooms?.[0]?.name || "a classroom";
      notifs.push({
        id: `cl-${c.id}`,
        type: "classroom_join",
        title: "Added to Classroom",
        subtitle: `You joined ${name}`,
        href: `/classrooms/${c.classroom_id}`,
      });
    });

    (groupRes.data ?? []).forEach((g: { id: string; group_id: string; trivia_groups: { name: string }[] }) => {
      const name = g.trivia_groups?.[0]?.name || "a group";
      notifs.push({
        id: `gr-${g.id}`,
        type: "group_join",
        title: "Group Activity",
        subtitle: `You joined ${name}`,
        href: `/groups/${g.group_id}`,
      });
    });

    setItems(notifs.filter(n => !seenIds.has(n.id)));
  }, [user?.id, seenIds]);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  if (!user) return null;

  const count = items.length;
  const iconMap: Record<NotifItem["type"], string> = {
    friend_request: "👥",
    classroom_join: "🏫",
    group_join: "🎯",
    classroom_nudge: "📚",
  };

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button
        className="nav-icon-btn notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        aria-expanded={open}
        aria-controls="notification-menu"
        data-tooltip="Notifications"
      >
        🔔
        {count > 0 && (
          <span className="notif-badge">{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" id="notification-menu" role="region" aria-label="Notifications">
          <div className="notif-header">
            <span className="notif-header-title">Notifications</span>
            {count > 0 && (
              <button className="notif-clear-btn" onClick={() => void dismissAll()}>Clear all</button>
            )}
          </div>
          {notificationError && <div className="error-message" role="alert">{notificationError}</div>}
          {items.length === 0 ? (
            <div className="notif-empty">All caught up! 🎉</div>
          ) : (
            <div className="notif-list">
              {items.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="notif-item"
                  onClick={() => void dismissOne(item)}
                >
                  <span className="notif-icon">{iconMap[item.type]}</span>
                  <div className="notif-content">
                    <div className="notif-title">{item.title}</div>
                    <div className="notif-subtitle">{item.subtitle}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link href="/friends" className="notif-footer">
            View friends →
          </Link>
        </div>
      )}
    </div>
  );
}
