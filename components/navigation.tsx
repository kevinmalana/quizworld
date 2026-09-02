"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HostIcon } from "@/components/shared/host-icon";
import { SignOutIcon } from "@/components/shared/signout-icon";
import { NotificationBell } from "@/components/shared/notification-bell";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setNeedsProfile(false); return; }
    supabase.from("profiles").select("is_admin, display_name, username").eq("id", user.id).single().then(({ data }) => {
      setIsAdmin(data?.is_admin ?? false);
      setNeedsProfile(!data?.display_name || !data?.username);
    });
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    setMenuOpen(false);
  };

  return (
    <>
      <header
        className="nav-header"
        style={{
          boxShadow: scrolled ? "0 1px 8px rgba(15,23,42,0.06)" : "none",
          borderBottomColor: scrolled ? "var(--line)" : "transparent",
        }}
      >
        <div className="nav-inner">
          <Link prefetch={false} href="/" className="nav-logo">
            <span className="logo-quiz">Quiz</span>
            <span className="logo-world">World</span>
          </Link>

          <nav className="nav-primary" aria-label="Primary navigation">
            <Link prefetch={false} href="/join" className={`nav-item ${pathname === "/join" ? "active" : ""}`}>
              <span>🎮</span>
              <span>Join</span>
            </Link>
            <Link prefetch={false} href="/explore" className={`nav-item ${pathname === "/explore" ? "active" : ""}`}>
              <span>🔍</span>
              <span>Explore</span>
            </Link>
            <Link prefetch={false} href="/study" className={`nav-item ${pathname === "/study" || pathname.startsWith("/study/") ? "active" : ""}`}>
              <span>📖</span>
              <span>Study</span>
            </Link>
            <Link prefetch={false} href="/leaderboard" className={`nav-item ${pathname === "/leaderboard" ? "active" : ""}`}>
              <span>🏆</span>
              <span>Ranks</span>
            </Link>
            <Link prefetch={false} href="/present" className={`nav-item ${pathname === "/present" || pathname.startsWith("/present/") ? "active" : ""}`}>
              <span>🎤</span>
              <span>Present</span>
            </Link>
            <Link prefetch={false} href="/create/activity" className={`nav-item nav-item-create ${pathname === "/create/activity" ? "active" : ""}`}>
              <span aria-hidden="true">+</span>
              <span>Create</span>
            </Link>
          </nav>

          <div className="nav-right">
            {!loading && (
              user ? (
                <>
                  <NotificationBell />
                  <Link prefetch={false} href="/profile" className="nav-icon-btn nav-profile-btn" data-tooltip="Profile">
                    <span>👤</span>
                    {needsProfile && <span className="nav-notification-dot" />}
                  </Link>
                  <Link prefetch={false} href="/dashboard" className="nav-icon-btn" data-tooltip="Dashboard">
                    <span>📚</span>
                  </Link>
                  {isAdmin && (
                    <Link prefetch={false} href="/admin" className="nav-icon-btn" data-tooltip="Admin">
                      <span>⚙️</span>
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="nav-icon-btn" data-tooltip="Sign Out" style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <SignOutIcon size={18} />
                  </button>
                </>
              ) : (
                <Link prefetch={false} href="/login" className="btn btn-sm" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  Sign In
                </Link>
              )
            )}
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-header">
              <Link prefetch={false} href="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
                <span className="logo-quiz">Quiz</span>
                <span className="logo-world">World</span>
              </Link>
              <button className="close-btn" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="mobile-links" style={{ padding: "1rem" }}>
              <Link prefetch={false} href="/join" className="mobile-link">🎮 Join</Link>
              <Link prefetch={false} href="/explore" className="mobile-link">🔍 Explore</Link>
              <Link prefetch={false} href="/study" className="mobile-link">📖 Study</Link>
              <Link prefetch={false} href="/leaderboard" className="mobile-link">🏆 Leaderboard</Link>
              <Link prefetch={false} href="/friends" className="mobile-link">👥 Friends</Link>
              <Link prefetch={false} href="/classrooms" className="mobile-link">🏫 Classrooms</Link>
              <Link prefetch={false} href="/groups" className="mobile-link">🎯 Trivia Groups</Link>
              <Link prefetch={false} href="/achievements" className="mobile-link">🏅 Achievements</Link>
              <Link prefetch={false} href="/present" className="mobile-link">🎤 Present</Link>
              <Link prefetch={false} href="/create/activity" className="mobile-link">✨ Create</Link>
              <Link prefetch={false} href="/host" className="mobile-link"><span style={{display:"inline-flex",alignItems:"center",gap:"0.4rem"}}><HostIcon size={16} /> Host</span></Link>
              {user ? (
                <>
                  <Link prefetch={false} href="/profile" className="mobile-link">👤 Profile{needsProfile && " ⚠️"}</Link>
                  <Link prefetch={false} href="/dashboard" className="mobile-link">📚 Dashboard</Link>
                  {isAdmin && <Link prefetch={false} href="/admin" className="mobile-link">⚙️ Admin</Link>}
                  <button onClick={handleSignOut} className="mobile-link" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: "0.4rem" }}><SignOutIcon size={16} /> Sign Out</button>
                </>
              ) : (
                <Link prefetch={false} href="/login" className="mobile-link">🔑 Sign In</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
