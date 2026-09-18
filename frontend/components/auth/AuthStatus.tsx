"use client";

import { signOut, type AuthUser } from "../../lib/api-client";
import { AdminUpload } from "./AdminUpload";
import { AdminUsers } from "./AdminUsers";

export function AuthStatus({ user, loading, onSignedOut }: { user: AuthUser | null; loading: boolean; onSignedOut: () => void }) {
  async function logout(): Promise<void> {
    await signOut();
    onSignedOut();
  }

  if (loading) return <p aria-live="polite">Checking session… <a href="/login">Sign in</a></p>;
  if (!user) return <p><a href="/login">Sign in or create an account</a></p>;

  return <>
    <p aria-live="polite">Signed in as {user.username || "new user"} ({user.is_verified ? "Verified" : "Not verified"}). {user.needs_username && <><a href="/account">Set your username</a> · </>}<button type="button" onClick={() => void logout()}>Sign out</button></p>
    {user.role === "admin" && <AdminUpload />}
    {user.role === "admin" && <AdminUsers />}
    <nav><a href="/account">Account</a> · <a href="/resources">Resources</a> · <a href="/members">Members</a></nav>
  </>;
}