"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { consumePostLoginRedirect, peekPostLoginRedirect } from "@/lib/auth/redirects";

type Status = { kind: "error" | "success"; message: string } | null;

function requestedRedirect() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) setStatus({ kind: "error", message: error });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setStatus({ kind: "error", message: error.message });
      else {
        setStatus({ kind: "success", message: "Check your email for the confirmation link." });
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setStatus({ kind: "error", message: error.message });
      else router.push(consumePostLoginRedirect(sessionStorage, requestedRedirect()));
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setStatus(null);
    const next = peekPostLoginRedirect(sessionStorage, requestedRedirect());
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!email.trim()) {
      setStatus({ kind: "error", message: "Enter your email address first." });
      return;
    }
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setLoading(false);
    setStatus(error
      ? { kind: "error", message: error.message }
      : { kind: "success", message: "Password reset instructions have been sent to your email." });
  };

  return (
    <div className="login-shell">
      <div className="card login-card">
        <h1 className="font-display login-title">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h1>

        <button type="button" onClick={() => void handleGoogleSignIn()} disabled={loading} className="btn btn-google btn-full">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        <form onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="input login-input" required />
          <label className="sr-only" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="input login-input" required minLength={6} />

          {status && (
            <div className={status.kind === "error" ? "error-message" : "success-message"} role={status.kind === "error" ? "alert" : "status"}>
              {status.message}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>

          {!isSignUp && (
            <button type="button" className="login-forgot-btn" disabled={loading} onClick={() => void handlePasswordRecovery()}>
              Forgot password?
            </button>
          )}

          {isSignUp && (
            <p className="login-consent">
              By creating an account, you agree to our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </p>
          )}
        </form>

        <p className="login-toggle">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setStatus(null); }} className="login-toggle-btn">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
