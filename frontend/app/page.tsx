"use client";

import { useEffect, useState } from "react";
import { ChatWidget } from "../components/chat/ChatWidget";
import { AuthStatus } from "../components/auth/AuthStatus";
import { MapView } from "../components/map/MapView";
import { restoreSession, type AuthUser } from "../lib/api-client";

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void restoreSession().then(setUser).finally(() => setLoading(false));
  }, []);

  return <main style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: 1200, padding: "0 1.5rem" }}>
    <h1>CommunitySafe</h1>
    <p>Find community resources.</p>
    <AuthStatus user={user} loading={loading} onSignedOut={() => setUser(null)} />
    <MapView isAdmin={user?.role === "admin"} isAuthenticated={Boolean(user)} />
    <ChatWidget />
  </main>;
}
