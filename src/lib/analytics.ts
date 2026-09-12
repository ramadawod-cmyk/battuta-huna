import mixpanel from "mixpanel-browser";
import { getDeviceId } from "./device";

// Separate Mixpanel projects per environment, routed by hostname — mirrors the legacy PWA's
// approach exactly (see index.html in the original repo) so staging/production data doesn't mix.
// Anything other than the production domain (staging, deploy previews, localhost) uses the
// staging project (EU-hosted) so dev traffic never lands in production analytics.
const IS_PROD_HOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "battutahuna.com" || window.location.hostname === "www.battutahuna.com");

const PROD_TOKEN = "e0877cc6897cf577dfffa5f90a714689";
const STAGING_TOKEN = "49d14e14d53337e935ad6f811a7973dd";

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  mixpanel.init(IS_PROD_HOST ? PROD_TOKEN : STAGING_TOKEN, {
    track_pageview: false, // SPA — screens tracked manually via track('View Screen', ...)
    persistence: "localStorage",
    ignore_dnt: false,
    ...(IS_PROD_HOST ? {} : { api_host: "https://api-eu.mixpanel.com" }),
  });

  const deviceId = getDeviceId();
  mixpanel.register({ device_id: deviceId });
  // identify() with no argument must be called before any people.* call, or the SDK no-ops them.
  mixpanel.identify();
  mixpanel.people.set_once({ "First Visit": new Date().toISOString(), "Device ID": deviceId });
}

export function identifyUser(user: { id: string; email?: string }): void {
  mixpanel.identify(user.id);
  mixpanel.people.set({ $email: user.email, email: user.email });
}

export function resetAnalytics(): void {
  mixpanel.reset();
}

export function track(event: string, props?: Record<string, unknown>): void {
  mixpanel.track(event, props);
}
