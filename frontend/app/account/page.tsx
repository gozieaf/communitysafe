"use client";

import { useEffect, useState } from "react";
import { confirmVerification, requestVerification, restoreSession, updateProfile, type AuthUser } from "../../lib/api-client";

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [emailVisible, setEmailVisible] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void restoreSession().then((value) => { setUser(value); setUsername(value?.username ?? ""); setEmailVisible(value?.email_visible ?? false); }); }, []);
  if (!user) return <main><h1>Account</h1><p><a href="/login">Sign in to manage your account.</a></p></main>;
  async function save(): Promise<void> { try { const updated = await updateProfile(username, emailVisible); setUser(updated); setMessage("Profile updated."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not update profile."); } }
  async function sendCode(): Promise<void> { try { const result = await requestVerification(); setMessage(result.development_code ? `${result.message} Development code: ${result.development_code}` : result.message); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not request verification."); } }
  async function verify(): Promise<void> { try { setUser(await confirmVerification(code)); setMessage("Email verified."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not verify email."); } }
  return <main style={{ margin: "2rem auto", maxWidth: 720, padding: "0 1.5rem" }}><h1>Account</h1><p>Signed in as <strong>{user.username || "new user"}</strong>.</p>{user.needs_username && <p role="alert">Please set a unique username to complete your account.</p>}<label>Username<input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label><input type="checkbox" checked={emailVisible} onChange={(event) => setEmailVisible(event.target.checked)} /> Show my email to members</label><button type="button" onClick={() => void save()}>Update user info</button><h2>Verify</h2><p>Status: {user.is_verified ? "Verified" : "Not verified"}</p>{!user.is_verified && <><button type="button" onClick={() => void sendCode()}>Verify</button><input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(event) => setCode(event.target.value)} /><button type="button" onClick={() => void verify()}>Confirm code</button></>}{message && <p role="status">{message}</p>}<p><a href="/">Back to map</a></p></main>;
}