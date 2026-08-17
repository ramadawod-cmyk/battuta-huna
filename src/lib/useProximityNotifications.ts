import { useEffect, useRef } from "react";
import { useCity } from "./CityContext";
import { haversineMeters } from "./geo";
import { getSettings, getNotifiedIds, markNotified } from "./settings";
import { track } from "./analytics";

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

      for (const site of sites) {
        if (notified.has(site.id)) continue;
        const distance = haversineMeters(latitude, longitude, site.lat, site.lng);
        if (distance <= current.radius) {
          markNotified(site.id);
          track("Proximity Notification Shown", { poi_count: 1, city: sites[0]?.city_id, name: site.name });
          const notification = new Notification(`You're near ${site.name}`, {
            body: site.description,
            tag: site.id,
          });
          notification.onclick = () => track("Proximity Notification Clicked", { name: site.name });
        }
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
