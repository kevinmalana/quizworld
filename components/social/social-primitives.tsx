"use client";

import Link from "next/link";
import { calcLevel } from "@/components/study/study-session-panels";

// ─── Shared social UI primitives ──────────────────────────────────────────────
// These components are used across friends, classrooms, groups, leaderboard,
// achievements, and public profile pages. Import from here, not inline.

// ── Level badge ───────────────────────────────────────────────────────────────
export function LevelBadge({ totalXp, short = false }: { totalXp: number; short?: boolean }) {
  const lv = calcLevel(totalXp);
  return (
    <span className="social-level-badge">
      ⭐ Lv {lv.level}{!short && ` · ${lv.title}`}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`social-role-badge social-role-badge--${role}`}>
      {role}
    </span>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────
export type SocialMember = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  total_xp: number;
  study_streak: number;
  role?: string;
};

export function MemberRow({
  member,
  actions,
}: {
  member: SocialMember;
  actions?: React.ReactNode;
}) {
  const name = member.display_name || member.username;
  return (
    <div className="social-member-row">
      <div className="social-member-avatar">{member.avatar || "👤"}</div>
      <div className="social-member-info">
        <Link href={`/u/${member.username}`} className="social-member-name social-member-name--link">
          {name}
        </Link>
        <div className="social-member-handle">@{member.username}</div>
        <div className="social-member-meta">
          <LevelBadge totalXp={member.total_xp} />
          {member.study_streak > 0 && (
            <span className="social-streak-pill">🔥 {member.study_streak}d</span>
          )}
        </div>
      </div>
      <div className="social-member-actions">
        {member.role && <RoleBadge role={member.role} />}
        <div className="social-member-xp">
          {member.total_xp.toLocaleString()} XP
        </div>
        {actions}
      </div>
    </div>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────
export function LeaderboardRow({
  member,
  rank,
  isMe = false,
  xpOverride,
}: {
  member: SocialMember;
  rank: number;
  isMe?: boolean;
  xpOverride?: number;
}) {
  const lv = calcLevel(member.total_xp);
  const podiumClass =
    rank === 1 ? "leaderboard-row leaderboard-row--gold"
    : rank === 2 ? "leaderboard-row leaderboard-row--silver"
    : rank === 3 ? "leaderboard-row leaderboard-row--bronze"
    : "leaderboard-row";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  const xp = xpOverride ?? member.total_xp;

  return (
    <div className={`${podiumClass}${isMe ? " leaderboard-row--me" : ""}`}>
      <div className="leaderboard-rank">{medal}</div>
      <div className="leaderboard-avatar">{member.avatar || "👤"}</div>
      <div className="leaderboard-info">
        <div className="leaderboard-name">
          {member.display_name || member.username}
          {isMe && <span className="leaderboard-you-tag">← You</span>}
        </div>
        <div className="leaderboard-handle">
          <Link href={`/u/${member.username}`} className="leaderboard-username-link">
            @{member.username}
          </Link>
          {" · "}
          <LevelBadge totalXp={member.total_xp} short />
        </div>
      </div>
      {member.study_streak > 0 && (
        <div className="leaderboard-streak">🔥 {member.study_streak}d</div>
      )}
      <div className="leaderboard-xp">{xp.toLocaleString()} XP</div>
    </div>
  );
}

// ── Join code display ─────────────────────────────────────────────────────────
export function JoinCode({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="social-join-code">
      <span className="social-join-code__text">{code}</span>
      <button onClick={onCopy} className="social-join-code__copy" aria-label="Copy code">
        📋
      </button>
    </div>
  );
}

// ── Social card ───────────────────────────────────────────────────────────────
export function SocialCard({
  emoji,
  title,
  description,
  meta,
  badge,
  actions,
}: {
  emoji: string;
  title: string;
  description?: string | null;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="card card-hover social-card">
      <div className="social-card-header">
        <div className="social-card-emoji">{emoji}</div>
        <div className="social-card-title">{title}</div>
        {badge}
      </div>
      {description && <div className="social-card-desc">{description}</div>}
      {meta && <div className="social-card-meta">{meta}</div>}
      {actions && <div className="social-card-actions">{actions}</div>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function SocialEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="social-empty">
      <div className="social-empty-icon" aria-hidden="true">{icon}</div>
      <h2 className="social-empty-title">{title}</h2>
      {text && <p className="social-empty-text">{text}</p>}
      {action}
    </div>
  );
}

// ── Status message ────────────────────────────────────────────────────────────
export function StatusMsg({ msg, type }: { msg: string; type: "success" | "error" }) {
  if (!msg) return null;
  return <div className={`social-status-msg social-status-msg--${type}`}>{msg}</div>;
}

// ── Loading state ─────────────────────────────────────────────────────────────
export function SocialLoading() {
  return (
    <div className="social-empty">
      <div className="social-empty-icon">📡</div>
      <div>Loading...</div>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export function SocialPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="social-header">
      <h1 className="font-display">{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
