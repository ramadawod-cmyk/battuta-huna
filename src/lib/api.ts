import { getDeviceId } from "./device";

type JsonBody = Record<string, unknown> | unknown[] | null;

async function postJson(url: string, body: JsonBody, extraHeaders?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": getDeviceId(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request to ${url} failed with status ${res.status}`);
  }
  return data;
}

/** Supabase CRUD proxy — mirrors every `action` the legacy PWA's db() helper used. */
export function db(action: string, data: Record<string, unknown> = {}): Promise<any> {
  return postJson("/.netlify/functions/supabase-proxy", { action, data });
}

/** Supabase Auth proxy — magic link + session + guest trip migration. */
export function authApi(action: string, data: Record<string, unknown> = {}): Promise<any> {
  return postJson("/.netlify/functions/auth-proxy", { action, ...data });
}

type PlanAgentMessage = { role: "user" | "assistant"; content: string };

/** Claude proxy used for trip planning conversation + POI/description generation. */
export async function planAgent(system: string, messages: PlanAgentMessage[]): Promise<string> {
  const res = await fetch("/.netlify/functions/plan-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || "AI request failed");
  }
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Unexpected AI response shape");
  }
  return text;
}

export type WikiImage = {
  url: string;
  raw: string;
  width: number;
  height: number;
  attribution: string;
};

/** Wikimedia image lookup — single thumbnail by title, or up to 5 by search. */
export async function wikiImageByTitle(title: string): Promise<{ url: string; title: string } | null> {
  const res = await fetch(`/.netlify/functions/wiki-image?title=${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function wikiImagesBySearch(search: string): Promise<WikiImage[]> {
  const res = await fetch(`/.netlify/functions/wiki-image?search=${encodeURIComponent(search)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.images || [];
}
