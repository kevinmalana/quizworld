"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
          <Link href="/" className="nav-logo">
            <span className="logo-quiz">Quiz</span>
            <span className="logo-world">World</span>
          </Link>

          <nav className="nav-primary">
            <Link href="/join" className={`nav-item ${pathname === "/join" ? "active" : ""}`}>
              <span>🎮</span>
              <span>Join</span>
            </Link>
            <Link href="/explore" className={`nav-item ${pathname === "/explore" ? "active" : ""}`}>
              <span>🔍</span>
              <span>Explore</span>
            </Link>
            <Link href="/study" className={`nav-item ${pathname === "/study" || pathname.startsWith("/study/") ? "active" : ""}`}>
              <span>📖</span>
              <span>Study</span>
            </Link>
            <Link href="/present" className={`nav-item ${pathname === "/present" || pathname.startsWith("/present/") ? "active" : ""}`}>
              <span>🎤</span>
              <span>Present</span>
            </Link>
            <Link href="/create" className={`nav-item nav-item-create ${pathname === "/create" ? "active" : ""}`}>
              <span>+</span>
              <span>Create</span>
            </Link>
          </nav>

          <div className="nav-right">
            {!loading && (
              user ? (
                <>
                  <Link href="/profile" className="nav-icon-btn nav-profile-btn" title="Profile">
                    <span>👤</span>
                    {needsProfile && <span className="nav-notification-dot" />}
                  </Link>
                  <Link href="/dashboard" className="nav-icon-btn" title="Dashboard">
                    <span>📚</span>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="nav-icon-btn" title="Admin">
                      <span>⚙️</span>
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="nav-icon-btn" title="Sign Out" style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <span>🚪</span>
                  </button>
                </>
              ) : (
                <Link href="/login" className="btn btn-sm" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
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
              <Link href="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
                <span className="logo-quiz">Quiz</span>
                <span className="logo-world">World</span>
              </Link>
              <button className="close-btn" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="mobile-links" style={{ padding: "1rem" }}>
              <Link href="/join" className="mobile-link">🎮 Join</Link>
              <Link href="/explore" className="mobile-link">🔍 Explore</Link>
              <Link href="/study" className="mobile-link">📖 Study</Link>
              <Link href="/present" className="mobile-link">🎤 Present</Link>
              <Link href="/create" className="mobile-link">✨ Create</Link>
              <Link href="/host" className="mobile-link">🏁 Host</Link>
              {user ? (
                <>
                  <Link href="/profile" className="mobile-link">👤 Profile{needsProfile && " ⚠️"}</Link>
                  <Link href="/dashboard" className="mobile-link">📚 Dashboard</Link>
                  {isAdmin && <Link href="/admin" className="mobile-link">⚙️ Admin</Link>}
                  <button onClick={handleSignOut} className="mobile-link" style={{ width: "100%", textAlign: "left" }}>🚪 Sign Out</button>
                </>
              ) : (
                <Link href="/login" className="mobile-link">🔑 Sign In</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
