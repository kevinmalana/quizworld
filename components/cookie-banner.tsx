"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './supabase-provider';
import { ANALYTICS_CONSENT_KEY, analyticsPage, clearAnalyticsCookies, readAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics';

export function CookieBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const attachFrame = useCallback((node: HTMLIFrameElement | null) => {
    frame.current = node;
    if (!node) return;
    return () => {
      const context = node.contentWindow as (Window & { 'ga-disable-G-1YJEL65QPS'?: boolean }) | null;
      if (context) context['ga-disable-G-1YJEL65QPS'] = true;
      frame.current = null;
    };
  }, []);
  const page = ready ? analyticsPage(pathname, consent, loading, !!user) : null;
  const prompt = ready && !loading && !user && consent === null && analyticsPage(pathname, 'adult-granted', false, false) !== null;

  useEffect(() => {
    const refresh = () => {
      const saved = readAnalyticsConsent();
      if (saved !== 'adult-granted') {
        if (frame.current) flushSync(() => setConsent(saved));
        clearAnalyticsCookies();
      }
      setConsent(saved);
      setReady(true);
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  function choose(value: Exclude<AnalyticsConsent, null>) {
    // Destroy the Google execution context before changing preferences. Removing
    // a script tag alone does NOT stop Google's timers/listeners or queued work.
    if (value === 'denied') {
      flushSync(() => setConsent(value));
      clearAnalyticsCookies();
    }
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch { /* This visit only. */ }
    setConsent(value);
    setOpen(false);
  }

  return <>
    {page && <iframe key={page} ref={attachFrame} title="Optional analytics" hidden
      src="/analytics-frame.html" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"
      onLoad={() => frame.current?.contentWindow?.postMessage({ page }, window.location.origin)} />}
    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
      <button type="button" className="btn btn-secondary btn-compact" aria-expanded={open || prompt} onClick={() => setOpen(true)}>Analytics preferences</button>
    </div>
    {(open || prompt) && <aside className="cookie-notice" aria-label="Analytics preferences">
      <p className="cookie-notice__text">Essential cookies keep you signed in. Optional Google Analytics helps us understand visits to three public information pages, only for signed-out adults who opt in. No analytics on games, study or account pages. <Link href="/privacy">Privacy Policy</Link></p>
      <button type="button" onClick={() => choose('denied')} className="btn btn-secondary btn-compact">Reject analytics</button>
      <button type="button" onClick={() => choose('adult-granted')} className="btn btn-secondary btn-compact">I&apos;m 18 or older — allow analytics</button>
      <button type="button" onClick={() => { if (prompt) choose('denied'); else setOpen(false); }} className="cookie-notice__dismiss" aria-label="Close analytics preferences">✕</button>
    </aside>}
  </>;
}
