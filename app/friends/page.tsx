"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";
import "@/styles/friends.css";

type FriendProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  total_xp: number;
  study_streak: number;
  friendship_id: string;
};

type PendingRequest = {
  id: string;
  requester_id: string;
  username: string;
  display_name: string;
  avatar: string;
};

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: string; username: string; display_name: string; avatar: string } | null>(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [tab, setTab] = useState<"friends" | "leaderboard">("friends");

  async function load() {
    if (!user) return;
    setLoading(true);

    // Fetch accepted friendships
    const { data: fData } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (fData && fData.length > 0) {
      const otherIds = fData.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, total_xp, study_streak")
        .in("id", otherIds);
      if (profiles) {
        setFriends(profiles.map(p => ({
          ...p,
          total_xp: (p.total_xp as number) ?? 0,
          study_streak: (p.study_streak as number) ?? 0,
          friendship_id: fData.find(f => f.requester_id === p.id || f.addressee_id === p.id)?.id ?? "",
        })));
      }
    } else {
      setFriends([]);
    }

    // Fetch pending requests TO me
    const { data: pData } = await supabase
      .from("friendships")
      .select("id, requester_id, status")
      .eq("addressee_id", user.id)
      .eq("status", "pending");

    if (pData && pData.length > 0) {
      const requesterIds = pData.map(p => p.requester_id);
      const { data: rProfiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar")
        .in("id", requesterIds);
      if (rProfiles) {
        setPending(rProfiles.map(p => ({
          id: pData.find(r => r.requester_id === p.id)?.id ?? "",
          requester_id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar: p.avatar,
        })));
      }
    } else {
      setPending([]);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function handleSearch() {
    setSearchResult(null);
    setSearchMsg("");
    const q = searchVal.trim().toLowerCase();
    if (!q) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar")
      .eq("username", q)
      .neq("id", user?.id ?? "")
      .maybeSingle();
    if (!data) { setSearchMsg("No user found with that username."); return; }
    // Check if already friends or pending
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`)
      .or(`requester_id.eq.${data.id},addressee_id.eq.${data.id}`)
      .maybeSingle();
    if (existing) { setSearchMsg(`Already ${existing.status === "accepted" ? "friends" : "request pending"}.`); return; }
    setSearchResult(data);
  }

  async function sendRequest() {
    if (!searchResult || !user) return;
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: searchResult.id });
    if (error) { setStatusMsg("Could not send request."); setStatusType("error"); }
    else { setStatusMsg(`Friend request sent to @${searchResult.username}!`); setStatusType("success"); setSearchResult(null); setSearchVal(""); }
    setTimeout(() => setStatusMsg(""), 3000);
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
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
      <div className="social-empty">
        <div className="social-empty-icon">👥</div>
        <div className="social-empty-title">Sign in to use Friends</div>
        <div className="social-empty-text">Connect with other players, see their levels and streaks.</div>
      </div>
    </div>
  );

  const leaderboard = [...friends].sort((a, b) => b.total_xp - a.total_xp);

  return (
    <div className="container social-shell">
      <div className="social-header">
        <h1>👥 Friends</h1>
        <p>Connect with other players and compete on the leaderboard.</p>
      </div>

      {statusMsg && <div className={`social-status-msg social-status-msg--${statusType}`}>{statusMsg}</div>}

      {/* Add Friend */}
      <div className="card friends-section-card">
        <div className="social-section-title friends-section-title-flush">🔍 Add Friend by Username</div>
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
        {searchMsg && <p className="friends-search-msg">{searchMsg}</p>}
        {searchResult && (
          <div className="social-member-row">
            <div className="social-member-avatar">{searchResult.avatar || "👤"}</div>
            <div className="social-member-info">
              <div className="social-member-name">{searchResult.display_name || searchResult.username}</div>
              <div className="social-member-handle">@{searchResult.username}</div>
            </div>
            <button className="btn btn-primary btn-compact" onClick={sendRequest}>Send Request</button>
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="card friends-section-card">
          <div className="social-section-title friends-section-title-flush">⏳ Pending Requests ({pending.length})</div>
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

      {loading ? (
        <div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading...</div></div>
      ) : tab === "friends" ? (
        friends.length === 0 ? (
          <div className="social-empty">
            <div className="social-empty-icon">🤝</div>
            <div className="social-empty-title">No friends yet</div>
            <div className="social-empty-text">Search by username above to send a friend request.</div>
          </div>
        ) : (
          <div className="card friends-list-card">
            {friends.map(f => {
              const lv = calcLevel(f.total_xp);
              return (
                <div key={f.id} className="social-member-row">
                  <div className="social-member-avatar">{f.avatar || "👤"}</div>
                  <div className="social-member-info">
                    <div className="social-member-name">{f.display_name || f.username}</div>
                    <div className="social-member-handle">@{f.username}</div>
                    <div className="social-member-meta">
                      <span className="social-level-badge">⭐ Lv {lv.level} · {lv.title}</span>
                      {f.study_streak > 0 && <span className="friends-streak-label">🔥 {f.study_streak}d</span>}
                    </div>
                  </div>
                  <div className="friends-xp-col">
                    <div className="friends-xp-value">{f.total_xp.toLocaleString()} XP</div>
                    <button className="btn btn-secondary btn-compact friends-remove-btn" onClick={() => removeFriend(f.friendship_id)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        leaderboard.length === 0 ? (
          <div className="social-empty">
            <div className="social-empty-icon">🏆</div>
            <div className="social-empty-title">Add friends to see the leaderboard</div>
          </div>
        ) : (
          <div>
            {leaderboard.map((f, i) => {
              const lv = calcLevel(f.total_xp);
              const cls = i === 0 ? "leaderboard-row leaderboard-row--gold" : i === 1 ? "leaderboard-row leaderboard-row--silver" : i === 2 ? "leaderboard-row leaderboard-row--bronze" : "leaderboard-row";
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              return (
                <div key={f.id} className={cls}>
                  <div className="leaderboard-rank">{medal}</div>
                  <div className="leaderboard-avatar">{f.avatar || "👤"}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{f.display_name || f.username}</div>
                    <div className="leaderboard-handle">
                      @{f.username} · <span className="social-level-badge">⭐ Lv {lv.level}</span>
                    </div>
                  </div>
                  {f.study_streak > 0 && <div className="leaderboard-streak">🔥 {f.study_streak}d</div>}
                  <div className="leaderboard-xp">{f.total_xp.toLocaleString()} XP</div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
