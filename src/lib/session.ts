import { authApi } from "./api";
import { getDeviceId } from "./device";
import { track } from "./analytics";

const SESSION_KEY = "bh_session";

export type BhUser = { id: string; email?: string; [key: string]: unknown };
export type BhSession = { access_token: string; refresh_token: string; user: BhUser };

export function getSession(): BhSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BhSession;
  } catch {
    return null;
  }
}

export function setSession(session: BhSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function signOut(): Promise<void> {
  const session = getSession();
  if (session?.access_token) {
    await authApi("signOut", { token: session.access_token }).catch(() => {});
  }
  localStorage.removeItem(SESSION_KEY);
}

async function migrateDeviceTrips(userId: string): Promise<void> {
  await authApi("migrateTrips", { userId, deviceId: getDeviceId() })
    .then(() => track("Device Trips Migrated", { success: true }))
    .catch((err) => track("Device Trips Migrated", { success: false, message: err?.message }));
}

/**
 * Call once on app boot. Handles the magic-link redirect (`#access_token=...&refresh_token=...`),
 * exchanges it for the user, persists the session, migrates guest trips, and strips the hash.
 * Returns the session if one was just established from the URL, otherwise null.
 */
export async function handleMagicLinkCallback(): Promise<BhSession | null> {
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token") || "";
  if (!access_token) return null;

  const { user } = await authApi("getUser", { accessToken: access_token });
  const session: BhSession = { access_token, refresh_token, user };
  setSession(session);

  if (user?.id) {
    await migrateDeviceTrips(user.id);
  }

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return session;
}
