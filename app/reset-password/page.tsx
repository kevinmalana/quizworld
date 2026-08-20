"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { validateNewPassword } from "@/lib/auth/redirects";

type Status = { kind: "error" | "success"; message: string } | null;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setStatus({ kind: "error", message: validationError });
      return;
    }

    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    setStatus(error
      ? { kind: "error", message: error.message }
      : { kind: "success", message: "Your password has been updated. You can continue to your dashboard." });
  }

  return (
    <div className="login-shell">
      <div className="card login-card">
        <h1 className="font-display login-title">Choose a new password</h1>
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="new-password">New password</label>
          <input id="new-password" className="input login-input" type="password" autoComplete="new-password" minLength={8} required placeholder="New password" value={password} onChange={event => setPassword(event.target.value)} />
          <label className="sr-only" htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" className="input login-input" type="password" autoComplete="new-password" minLength={8} required placeholder="Confirm new password" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          {status && <div className={status.kind === "error" ? "error-message" : "success-message"} role={status.kind === "error" ? "alert" : "status"}>{status.message}</div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? "Updating..." : "Update password"}</button>
        </form>
        {status?.kind === "success" && <Link className="btn btn-secondary btn-full" href="/dashboard">Continue to dashboard</Link>}
      </div>
    </div>
  );
}
