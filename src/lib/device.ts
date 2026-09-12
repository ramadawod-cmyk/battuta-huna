const DEVICE_ID_KEY = "bh_device_id";

function generateDeviceId(): string {
  return "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
