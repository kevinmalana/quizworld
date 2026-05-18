"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { checkAndGrantAchievements } from "@/lib/achievements";
import {
  MemberRow,
  LeaderboardRow,
  SocialEmpty,
  SocialLoading,
  SocialPageHeader,
  StatusMsg,
  type SocialMember,
} from "@/components/social/social-primitives";
import "@/styles/social.css";

type PendingRequest = {
  id: string;
  requester_id: string;
  username: string;
  display_name: string;
  avatar: string;
};

type Tab = "friends" | "leaderboard";

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<SocialMember[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: string; username: string; display_name: string; avatar: string } | null>(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [tab, setTab] = useState<Tab>("friends");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: fData } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (fData?.length) {
      const otherIds = fData.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, total_xp, study_streak")
        .in("id", otherIds);

      setFriends((profiles ?? []).map(p => ({
        id: p.id,
        user_id: p.id,
        username: p.username ?? "",
        display_name: p.display_name ?? "",
        avatar: p.avatar ?? "👤",
        total_xp: (p.total_xp as number) ?? 0,
        study_streak: (p.study_streak as number) ?? 0,
        friendship_id: fData.find(f => f.requester_id === p.id || f.addressee_id === p.id)?.id,
      })));
    } else {
      setFriends([]);
    }

    const { data: pData } = await supabase
      .from("friendships")
      .select("id, requester_id")
      .eq("addressee_id", user.id)
      .eq("status", "pending");

    if (pData?.length) {
      const requesterIds = pData.map(p => p.requester_id);
      const { data: rProfiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar")
        .in("id", requesterIds);
      setPending((rProfiles ?? []).map(p => ({
        id: pData.find(r => r.requester_id === p.id)?.id ?? "",
        requester_id: p.id,
        username: p.username ?? "",
        display_name: p.display_name ?? "",
        avatar: p.avatar ?? "👤",
      })));
    } else {
      setPending([]);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSearch() {
    setSearchResult(null);
    setSearchMsg("");
    const q = searchVal.trim().toLowerCase();
    if (!q || !user) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar")
      .eq("username", q)
      .neq("id", user.id)
      .maybeSingle();

    if (!data) { setSearchMsg("No user found with that username."); return; }

    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${data.id}),and(requester_id.eq.${data.id},addressee_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      setSearchMsg(existing.status === "accepted" ? "Already friends." : "Friend request already pending.");
      return;
    }
    setSearchResult(data);
  }

  async function sendRequest() {
    if (!searchResult || !user || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: searchResult.id });
    if (error) {
      setStatusMsg("Could not send request."); setStatusType("error");
    } else {
      setStatusMsg(`Friend request sent to @${searchResult.username}! 🎉`);
      setStatusType("success");
      setSearchResult(null);
      setSearchVal("");
    }
    setTimeout(() => setStatusMsg(""), 3000);
    setSubmitting(false);
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    if (user) checkAndGrantAchievements({ userId: user.id, supabase }).catch(() => {});
    load();
  }

  async function declineRequest(friendshipId: string) {
    await supabase.from("friendships").update({ status: "declined" }).eq("id", friendshipId);
    load();
  }

  async function removeFriend(friendshipId: string) {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    load();
  }

  if (!user) return (
    <div className="container social-shell">
      <SocialEmpty
        icon="👥"
        title="Sign in to use Friends"
        text="Connect with other players, see their levels and compete on the leaderboard."
        action={<Link href="/login" className="btn btn-primary btn-compact">Sign In</Link>}
      />
    </div>
  );

  const leaderboard = [...friends].sort((a, b) => b.total_xp - a.total_xp);

  return (
    <div className="container social-shell">
      <SocialPageHeader title="👥 Friends" subtitle="Connect with other players and compete on the leaderboard." />

      <StatusMsg msg={statusMsg} type={statusType} />

      {/* Add Friend */}
      <div className="card social-section-card">
        <div className="social-section-title">🔍 Add Friend by Username</div>
        <div className="social-add-row">
          <input
            className="social-add-input"
            placeholder="Enter exact username..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <button className="btn btn-primary btn-compact" onClick={handleSearch}>Search</button>
        </div>
        {searchMsg && <p className="social-hint-text">{searchMsg}</p>}
        {searchResult && (
          <div className="social-member-row">
            <div className="social-member-avatar">{searchResult.avatar || "👤"}</div>
            <div className="social-member-info">
              <div className="social-member-name">{searchResult.display_name || searchResult.username}</div>
              <div className="social-member-handle">@{searchResult.username}</div>
            </div>
            <button
              className="btn btn-primary btn-compact"
              onClick={sendRequest}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send Request"}
            </button>
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="card social-section-card">
          <div className="social-section-title">⏳ Pending Requests ({pending.length})</div>
          {pending.map(req => (
            <div key={req.id} className="social-member-row">
              <div className="social-member-avatar">{req.avatar || "👤"}</div>
              <div className="social-member-info">
                <div className="social-member-name">{req.display_name || req.username}</div>
                <div className="social-member-handle">@{req.username}</div>
              </div>
              <div className="social-pending-actions">
                <button className="btn btn-primary btn-compact" onClick={() => acceptRequest(req.id)}>Accept</button>
                <button className="btn btn-secondary btn-compact" onClick={() => declineRequest(req.id)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="social-tabs">
        <button className={`social-tab${tab === "friends" ? " is-active" : ""}`} onClick={() => setTab("friends")}>
          Friends ({friends.length})
        </button>
        <button className={`social-tab${tab === "leaderboard" ? " is-active" : ""}`} onClick={() => setTab("leaderboard")}>
          🏆 Leaderboard
        </button>
      </div>

      {loading ? <SocialLoading /> : tab === "friends" ? (
        friends.length === 0 ? (
          <SocialEmpty icon="🤝" title="No friends yet" text="Search by username above to send a friend request." />
        ) : (
          <div className="card social-section-card">
            {friends.map((f: SocialMember & { friendship_id?: string }) => (
              <MemberRow
                key={f.id}
                member={f}
                actions={
                  <button
                    className="btn btn-secondary btn-compact social-btn-sm"
                    onClick={() => f.friendship_id && removeFriend(f.friendship_id)}
                  >
                    Remove
                  </button>
                }
              />
            ))}
          </div>
        )
      ) : (
        leaderboard.length === 0 ? (
          <SocialEmpty icon="🏆" title="Add friends to see the leaderboard" />
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((f, i) => (
              <LeaderboardRow key={f.id} member={f} rank={i + 1} isMe={user.id === f.user_id} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
