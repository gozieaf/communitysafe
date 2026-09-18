"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { signIn, signUp } from "../../lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, username, password);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : mode === "signin" ? "Sign in failed" : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
    <div role="tablist" aria-label="Account access" style={{ display: "flex", gap: 8 }}>
      <button type="button" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>Sign in</button>
      <button type="button" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>Create account</button>
    </div>
    <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    {mode === "signup" && <label>Username<input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>}
    <label>Password<input required type="password" minLength={12} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
  </form>;
}
