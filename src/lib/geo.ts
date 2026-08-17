export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export type ReverseGeocodeResult = {
  cityId: string;
  cityName: string;
  countryId: string;
  countryName: string;
};

/** Reverse-geocode lat/lng to a city via Nominatim (OpenStreetMap), same provider the legacy PWA uses. */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const address = data.address || {};
  const cityName: string | undefined = address.city || address.town || address.village || address.county;
  const countryName: string | undefined = address.country;
  if (!cityName) throw new Error("Could not determine a city from your location");

  return {
    cityId: slugify(cityName),
    cityName,
    countryId: slugify(countryName || "unknown"),
    countryName: countryName || "Unknown",
  };
}
