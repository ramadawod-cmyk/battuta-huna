const SETTINGS_KEY = "bh_settings";
const NOTIFIED_KEY = "bh_notified";

export type BhSettings = {
  notif: boolean;
  radius: number;
};

const DEFAULT_SETTINGS: BhSettings = { notif: true, radius: 1500 };

export function getSettings(): BhSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(settings: Partial<BhSettings>): BhSettings {
  const next = { ...getSettings(), ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getNotifiedIds(): Set<string> {
  const raw = localStorage.getItem(NOTIFIED_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markNotified(id: string): void {
  const ids = getNotifiedIds();
  ids.add(id);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(ids)));
}

export function clearNotifiedIds(): void {
  localStorage.removeItem(NOTIFIED_KEY);
}
