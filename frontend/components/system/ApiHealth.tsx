"use client";

import { useEffect, useState } from "react";

type HealthState = "checking" | "ready" | "unavailable" | "unconfigured";

export function ApiHealth() {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setState("unconfigured");
      return;
    }
    const controller = new AbortController();
    fetch(`${apiUrl.replace(/\/$/, "")}/health`, { signal: controller.signal })
      .then((response) => setState(response.ok ? "ready" : "unavailable"))
      .catch(() => setState("unavailable"));
    return () => controller.abort();
  }, []);

  const message: Record<HealthState, string> = {
    checking: "Checking API…",
    ready: "API is reachable.",
    unavailable: "API is unavailable.",
    unconfigured: "Set NEXT_PUBLIC_API_URL to connect the API.",
  };
  return <p aria-live="polite"><strong>API status:</strong> {message[state]}</p>;
}
