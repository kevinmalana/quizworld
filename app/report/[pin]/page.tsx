"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameReport } from "@/components/report/GameReport";
import type { GameResult } from "@/lib/report-analytics";
import { useAuth } from "@/components/supabase-provider";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const pin = params.pin as string;
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
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
      if (res.status === 401) {
        setError("Sign in to view this report.");
        setLoading(false);
        return;
      }
      if (res.status === 403) {
        setError("This game report is only visible to the host who started the game.");
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setError("Game report not found.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Could not load the report. Please try again.");
        setLoading(false);
        return;
      }
      const { result } = await res.json();
      setResult(result as GameResult);
      setLoading(false);
    }
    load();
  }, [pin, user, authLoading]);

  if (loading) {
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
