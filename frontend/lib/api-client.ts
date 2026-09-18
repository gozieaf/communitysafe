export type LayerSummary = {
  id: string;
  name: string;
  description: string | null;
  author: string | null;
  author_verified: boolean;
  geometry_type: string;
  style: Record<string, unknown> | null;
  created_at: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  role: "admin" | "viewer";
  is_verified: boolean;
  email_visible: boolean;
  needs_username: boolean;
};

type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
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
  currentUser = token.user;
  return token;
}

export async function signUp(email: string, username: string, password: string): Promise<TokenResponse> {
  const response = await request("/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, username, password }) }, false);
  if (!response.ok) throw new Error(await parseError(response));
  const token = await response.json() as TokenResponse;
  accessToken = token.access_token;
  currentUser = token.user;
  return token;
}

export async function updateProfile(username: string, emailVisible: boolean): Promise<AuthUser> {
  const response = await request("/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email_visible: emailVisible }) });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<AuthUser>;
}

export async function requestVerification(): Promise<{ message: string; development_code?: string }> {
  const response = await request("/auth/verify/request", { method: "POST" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ message: string; development_code?: string }>;
}

export async function confirmVerification(code: string): Promise<AuthUser> {
  const response = await request(`/auth/verify/confirm?code=${encodeURIComponent(code)}`, { method: "POST" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<AuthUser>;
}

export async function getMembers(): Promise<Array<{ username: string; email: string | null; email_visible: boolean; is_verified: boolean; created_at: string }>> {
  const response = await request("/members");
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function getAdminUsers(): Promise<Array<{ id: string; username: string; email: string; is_verified: boolean; verification_requested_at: string | null }>> {
  const response = await request("/admin/users");
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function getVerificationLink(userId: string): Promise<string> {
  const response = await request(`/admin/users/${encodeURIComponent(userId)}/verification-link`);
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json() as { link: string }).link;
}

export async function signOut(): Promise<void> {
  await request("/auth/logout", { method: "POST" }, false);
  accessToken = null;
  currentUser = null;
}

export async function restoreSession(): Promise<AuthUser | null> {
  const refreshed = await refreshAccessToken();
  return refreshed ? currentUser : null;
}

let currentUser: AuthUser | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  const response = await request("/auth/refresh", { method: "POST" }, false);
  if (!response.ok) {
    accessToken = null;
    return false;
  }
  const token = await response.json() as TokenResponse;
  accessToken = token.access_token;
  currentUser = token.user;
  return true;
}

export async function getLayers(): Promise<LayerSummary[]> {
  const response = await request("/layers");
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LayerSummary[]>;
}

export async function uploadLayer(file: File, layerName: string, description: string): Promise<{ id: string; name: string; description: string | null; author: string | null; created_at: string; feature_count: number }> {
  const body = new FormData();
  body.append("file", file);
  body.append("layer_name", layerName);
  body.append("description", description);
  const response = await request("/admin/layers", { method: "POST", body });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ id: string; name: string; description: string | null; author: string | null; created_at: string; feature_count: number }>;
}

export async function deleteLayer(layerId: string): Promise<void> {
  const response = await request(`/admin/layers/${encodeURIComponent(layerId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function getLayerFeatures(layerId: string, bbox: [number, number, number, number]): Promise<GeoJSON.FeatureCollection> {
  const response = await request(`/features/${encodeURIComponent(layerId)}?bbox=${bbox.join(",")}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<GeoJSON.FeatureCollection>;
}
