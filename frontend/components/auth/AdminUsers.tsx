"use client";

import { useEffect, useState } from "react";
import { getAdminUsers, getVerificationLink } from "../../lib/api-client";

export function AdminUsers() {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAdminUsers>>>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => { void getAdminUsers().then(setUsers); }, []);
  async function showLink(userId: string): Promise<void> { const link = await getVerificationLink(userId); setLinks((current) => ({ ...current, [userId]: link })); }
  return <section><h2>Members awaiting verification</h2>{users.map((user) => <article key={user.id}><strong>{user.username}</strong><p>{user.email} · {user.is_verified ? "Verified" : "Not verified"}</p>{user.verification_requested_at && !user.is_verified && <><p>Verification requested: {new Date(user.verification_requested_at).toLocaleString()}</p><button type="button" onClick={() => void showLink(user.id)}>Provide verification link</button>{links[user.id] && <p>{links[user.id]}</p>}</>}</article>)}</section>;
}