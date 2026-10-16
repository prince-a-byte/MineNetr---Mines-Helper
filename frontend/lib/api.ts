
const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000";

// Normalized origin (no trailing slash, no /api/v1 suffix) so callers can
// never produce a doubled "/api/v1/api/v1/..." path regardless of how the
// env var is configured.
export const API = RAW_BASE.replace(/\/$/, "").replace(/\/api\/v1$/, "");

/** Join a path onto the API, tolerating a leading "/api/v1" if present. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/api/v1") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  return `${API}${p}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("minenetr_token");
}

export function getUser(): any {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(
      localStorage.getItem("minenetr_user") || "null"
    );
  } catch {
    return null;
  }
}

export async function api(
  path: string,
  opts: RequestInit = {}
) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...(opts.headers || {}),
    },
  });

  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !path.includes("/auth/login")
  ) {
    localStorage.removeItem("minenetr_token");
    localStorage.removeItem("minenetr_user");

    window.location.href = "/login";

    throw new Error(
      "Session expired. Please login again."
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (data as any).detail || "Request failed"
    );
  }

  return data;
}

export const roleHome: Record<string, string> = {
  dgms: "/dgms",
  inspector: "/inspector",
  operator: "/operator",
  contractor: "/contractor",
};
