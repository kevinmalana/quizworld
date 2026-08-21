"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("qw_cookie_consent")) setVisible(true);
    } catch {
      // Storage is unavailable, so no consent preference can be retained.
    }
  }, []);

  function accept() {
    try { localStorage.setItem("qw_cookie_consent", "1"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="cookie-notice" aria-label="Cookie notice">
      <span className="cookie-notice__icon" aria-hidden="true">🍪</span>
      <p className="cookie-notice__text">
        We use essential cookies to keep you signed in. <Link href="/privacy">Privacy Policy</Link>
      </p>
      <button type="button" onClick={accept} className="btn btn-primary btn-compact">Got it</button>
      <button type="button" onClick={accept} className="cookie-notice__dismiss" aria-label="Dismiss cookie notice">✕</button>
    </aside>
  );
}
