"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

type NotifItem = {
  id: string;
  type: "friend_request" | "classroom_join" | "group_join";
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
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;

    const [friendRes, classRes, groupRes] = await Promise.all([
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

    setItems(notifs);
  }, [user?.id]);

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
  };

  return (
    <div className="notif-bell-wrap">
      <button
        className="nav-icon-btn notif-bell-btn"
        onClick={() => { setOpen(o => !o); }}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        data-tooltip="Notifications"
      >
        🔔
        {count > 0 && (
          <span className="notif-badge">{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <>
          <div className="notif-overlay" onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-header">
              <span className="notif-header-title">Notifications</span>
              {count > 0 && (
                <span className="notif-header-count">{count} new</span>
              )}
            </div>
            {items.length === 0 ? (
              <div className="notif-empty">All caught up! 🎉</div>
            ) : (
              <div className="notif-list">
                {items.map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="notif-item"
                    onClick={() => setOpen(false)}
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
            <Link href="/friends" className="notif-footer" onClick={() => setOpen(false)}>
              View all →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
