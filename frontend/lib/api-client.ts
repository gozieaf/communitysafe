export type LayerSummary = {
  id: string;
  name: string;
  geometry_type: string;
  style: Record<string, unknown> | null;
  created_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  user: { id: string; email: string; role: "admin" | "viewer" };
};

let accessToken: string | null = null;

function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return value.replace(/\/$/, "");
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(path, init, false);
  }
  return response;
}

async function parseError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  return typeof payload === "object" && payload !== null && "detail" in payload && typeof payload.detail === "string"
    ? payload.detail
    : `Request failed (${response.status})`;
}

export async function signIn(email: string, password: string): Promise<TokenResponse> {
  const response = await request("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }, false);
  if (!response.ok) throw new Error(await parseError(response));
  const token = await response.json() as TokenResponse;
  accessToken = token.access_token;
  return token;
}

export async function refreshAccessToken(): Promise<boolean> {
  const response = await request("/auth/refresh", { method: "POST" }, false);
  if (!response.ok) {
    accessToken = null;
    return false;
  }
  const token = await response.json() as TokenResponse;
  accessToken = token.access_token;
  return true;
}

export async function getLayers(): Promise<LayerSummary[]> {
  const response = await request("/layers");
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LayerSummary[]>;
}

export async function getLayerFeatures(layerId: string, bbox: [number, number, number, number]): Promise<GeoJSON.FeatureCollection> {
  const response = await request(`/features/${encodeURIComponent(layerId)}?bbox=${bbox.join(",")}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<GeoJSON.FeatureCollection>;
}
