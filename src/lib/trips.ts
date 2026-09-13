import { slugify } from "./geo";
import type { Trip, TripDay } from "./types";

export type Destination = {
  city: string;
  cityId: string;
  country?: string;
};

/**
 * The trip's destinations in visit order, deduplicated. Every trip created before
 * multi-destination support existed has no city on any day -- those fall back to the trip's
 * single city column, so old trips keep behaving exactly as they always did.
 */
export function tripDestinations(trip: Trip): Destination[] {
  const seen = new Set<string>();
  const destinations: Destination[] = [];
  for (const day of trip.days || []) {
    if (!day.city) continue;
    const cityId = day.cityId || slugify(day.city);
    if (seen.has(cityId)) continue;
    seen.add(cityId);
    destinations.push({ city: day.city, cityId, country: day.country });
  }
  if (destinations.length === 0) {
    return [{ city: trip.city, cityId: slugify(trip.city) }];
  }
  return destinations;
}

/** Human-readable destinations, e.g. "Rome" or "Rome · Florence". */
export function destinationsLabel(trip: Trip): string {
  return tripDestinations(trip)
    .map((d) => d.city)
    .join(" · ");
}

export type Leg = {
  city?: string;
  cityId?: string;
  country?: string;
  days: TripDay[];
};

/**
 * Groups consecutive days that share the same city into one leg -- for rendering a city
 * heading wherever the destination changes in the itinerary. Days with no city (every day on
 * a pre-multi-destination trip) form a single leg with no city, matching today's rendering
 * (no heading at all).
 */
export function legsFromDays(days: TripDay[]): Leg[] {
  const legs: Leg[] = [];
  for (const day of days) {
    const key = day.cityId || day.city;
    const current = legs[legs.length - 1];
    const currentKey = current ? current.cityId || current.city : undefined;
    if (current && currentKey === key) {
      current.days.push(day);
    } else {
      legs.push({ city: day.city, cityId: day.cityId, country: day.country, days: [day] });
    }
  }
  return legs;
}
