import { useEffect, useRef } from "react";
import { useCity } from "./CityContext";
import { haversineMeters } from "./geo";
import { getSettings, getNotifiedIds, markNotified } from "./settings";
import { track } from "./analytics";
import type { Site } from "./types";

// Battuta-toned flavor text for the grouped case, mirroring the legacy PWA's checkNearby().
const GROUP_MESSAGES = [
  (count: number) => `The traveller who does not know is lost — but you are not. ${count} discoveries await you here.`,
  (count: number) => `Fortune favours the curious. ${count} storied places surround you right now.`,
  (count: number) => `I have wandered far and seen much — and so shall you. ${count} sites lie within reach.`,
  (count: number) => `Every street holds a secret. ${count} are waiting for you nearby.`,
];

/**
 * Watches the user's live position and fires a browser notification when they come
 * within range of a known cultural site for the active city, mirroring the legacy
 * PWA's checkNearby(). Mount once near the app root.
 */
export function useProximityNotifications(): void {
  const { sites } = useCity();
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const settings = getSettings();
    if (!settings.notif || sites.length === 0) return;
    if (!("geolocation" in navigator) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    function onPosition(pos: GeolocationPosition) {
      const { latitude, longitude } = pos.coords;
      const current = getSettings();
      if (!current.notif) return;
      const notified = getNotifiedIds();

      const newlyInRange: Site[] = [];
      for (const site of sites) {
        if (notified.has(site.id)) continue;
        const distance = haversineMeters(latitude, longitude, site.lat, site.lng);
        if (distance <= current.radius) newlyInRange.push(site);
      }
      if (newlyInRange.length === 0) return;
      for (const site of newlyInRange) markNotified(site.id);

      if (newlyInRange.length === 1) {
        const site = newlyInRange[0];
        track("Proximity Notification Shown", { poi_count: 1, city: site.city_id, name: site.name });
        const notification = new Notification(`You're near ${site.name}`, {
          body: site.description,
          tag: site.id,
        });
        notification.onclick = () => track("Proximity Notification Clicked", { name: site.name });
      } else {
        const count = newlyInRange.length;
        const message = GROUP_MESSAGES[Math.floor(Math.random() * GROUP_MESSAGES.length)](count);
        track("Proximity Notification Shown", { poi_count: count, city: newlyInRange[0]?.city_id });
        const notification = new Notification(`${count} discoveries nearby`, {
          body: message,
          tag: `battuta-group-${Date.now()}`,
        });
        notification.onclick = () => track("Proximity Notification Clicked", { poi_count: count });
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 10000,
    });

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [sites]);
}
