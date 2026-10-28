"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameReport } from "@/components/report/GameReport";
import type { GameResult } from "@/lib/report-analytics";
import { useAuth } from "@/components/supabase-provider";
import { useAsyncScope } from "@/lib/use-async-scope";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { beginRead } = useAsyncScope();
  const reportRequestKey = useRef<string | null>(null);
  const pin = params.pin as string;
  const key = `${user?.id ?? ""}:${pin}`;
  const [result, setResult] = useState<GameResult | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    // Supersede any in-flight read whenever the pin or account changes,
    // including sign-out, and clear the previous report for a new key.
    const current = beginRead();
    if (reportRequestKey.current !== key) {
      reportRequestKey.current = key;
      setResult(null);
      setResultKey(null);
      setError(null);
      setLoading(true);
    }
    if (authLoading) return;
    if (!user) {
      router.push(`/login?next=/report/${pin}`);
      return;
    }
    async function load() {
      // 2026-08-13: route through /api/reports/[pin] server-side endpoint.
      // game_results RLS now requires auth.uid() = host_id, so the browser
      // can no longer read results directly. The server endpoint uses the
      // service-role client for the lookup and re-checks ownership.
      const res = await fetch(`/api/reports/${encodeURIComponent(pin)}`);
      if (!current()) return;
      if (res.status === 401) {
        setError("Sign in to view this report.");
        setResultKey(key);
        setLoading(false);
        return;
      }
      if (res.status === 403) {
        setError("This game report is only visible to the host who started the game.");
        setResultKey(key);
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setError("Game report not found.");
        setResultKey(key);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Could not load the report. Please try again.");
        setResultKey(key);
        setLoading(false);
        return;
      }
      const { result } = await res.json();
      if (!current()) return;
      setResult(result as GameResult);
      setResultKey(key);
      setLoading(false);
    }
    load();
  }, [pin, user, authLoading]);

  // State from another owner/PIN is private even before the effect below runs.
  if (authLoading || loading || resultKey !== key) {
    return <div className="container report-status">Loading report...</div>;
  }

  if (error || !result) {
    return (
      <div className="container report-status">
        <div className="card report-error-card">
          <div className="report-error-icon">📊</div>
          <h2 className="report-error-title">Report Not Found</h2>
          <p className="report-error-text">{error || "This game report may not have detailed data saved."}</p>
          <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return <GameReport result={result} pin={pin} />;
}
