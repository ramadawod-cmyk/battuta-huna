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
    // enableHighAccuracy:false was tried here to sidestep GPS timeouts on hardware without a GPS
    // chip, but it also made the browser fall back to coarse IP-based geolocation on at least one
    // real device — landing continents away from the actual position. WiFi/GPS-based positioning
    // (enableHighAccuracy:true) is more reliable in practice despite the occasional timeout, so
    // this stays true; only the timeout/maximumAge were kept from that attempt.
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

/** Turns a GeolocationPositionError (not a real Error instance) into a message worth showing. */
export function describeGeolocationError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: number }).code;
    if (code === 1) return "Location permission was denied. Enable it in your browser's site settings and try again.";
    if (code === 2) return "Couldn't determine your position right now. Try again in a moment.";
    if (code === 3) return "Location request timed out. Try again.";
  }
  if (err instanceof Error) return err.message;
  return "Could not detect your location";
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export type ReverseGeocodeResult = {
  cityId: string;
  cityName: string;
  countryId: string;
  countryName: string;
  /** Finer-grained area (suburb/subdistrict) within the resolved city, when Nominatim has one. */
  locality: string | null;
};

// Nominatim resolves rural/exurban GPS points to whatever the *nearest* administrative feature
// is — a subdistrict, a small town — rather than the metro area a traveller actually thinks of
// (e.g. a point in Wadi Essier resolves to "Wadi Essier Sub-District", not "Amman"). Matching the
// legacy PWA's checkNearby behavior: check proximity to known major-city centres first, and only
// fall back to Nominatim's raw address match when the point isn't near one of them.
const MAJOR_CITIES = [
  { name: "Rome", lat: 41.8967, lng: 12.4822, radiusKm: 50 },
  { name: "Amman", lat: 31.9539, lng: 35.9106, radiusKm: 50 },
  { name: "Malaga", lat: 36.7213, lng: -4.4216, radiusKm: 50 },
  { name: "Tunis", lat: 36.819, lng: 10.1658, radiusKm: 80 },
  { name: "Montreal", lat: 45.5019, lng: -73.5674, radiusKm: 50 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, radiusKm: 80 },
];

function nearestMajorCity(lat: number, lng: number): string | null {
  for (const city of MAJOR_CITIES) {
    if (haversineMeters(lat, lng, city.lat, city.lng) / 1000 <= city.radiusKm) return city.name;
  }
  return null;
}

/** Reverse-geocode lat/lng to a city via Nominatim (OpenStreetMap), same provider the legacy PWA uses. */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const address = data.address || {};
  const countryName: string | undefined = address.country;

  const preciseName: string | undefined = address.city || address.town || address.village;
  const cityName = nearestMajorCity(lat, lng) || preciseName || address.county;
  if (!cityName) throw new Error("Could not determine a city from your location");

  const fineGrained: string | undefined =
    address.suburb || address.neighbourhood || address.city_district || preciseName || address.county;
  const locality = fineGrained && fineGrained !== cityName ? fineGrained : null;

  return {
    cityId: slugify(cityName),
    cityName,
    countryId: slugify(countryName || "unknown"),
    countryName: countryName || "Unknown",
    locality,
  };
}
