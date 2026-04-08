"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        setError("Check your email for the confirmation link!");
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        const nextPath = sessionStorage.getItem("qw_post_login_redirect");
        if (nextPath) {
          sessionStorage.removeItem("qw_post_login_redirect");
          router.push(nextPath);
        } else {
          router.push("/dashboard");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 400 }}>
        <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, textAlign: "center", marginBottom: "2rem" }}>
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h1>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            style={{ width: "100%", marginBottom: "1rem" }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            style={{ width: "100%", marginBottom: "1rem" }}
            required
            minLength={6}
          />

          {error && (
            <div style={{ color: "var(--primary)", background: "var(--primary-light)", padding: "0.75rem", borderRadius: "var(--radius-lg)", marginBottom: "1rem", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => setIsSignUp(!isSignUp)} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
