export type City = {
  id: string;
  name: string;
  country_id: string;
  lat: number;
  lng: number;
  wiki?: string | null;
  tips?: Record<string, string> | null;
  hero_image_url?: string | null;
};

export type Site = {
  id: string;
  city_id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  long_description?: string | null;
  lat: number;
  lng: number;
  map_url?: string | null;
  wiki?: string | null;
  image_url?: string | null;
  review_status?: string;
  source?: string;
  must_see?: boolean | null;
  duration_minutes?: number | null;
  // Set only when this Site-shaped object actually came from the activities table (normalized in
  // src/lib/activities.ts) -- purely a UI badge hint, never read by scheduling logic, so every
  // real site (kind undefined) behaves exactly as it always did.
  kind?: "site" | "activity";
};

export type Activity = {
  id: string;
  city_id: string;
  name: string;
  activity_type: string;
  description: string;
  long_description?: string | null;
  tags: string[];
  lat: number;
  lng: number;
  // True for a district/neighborhood-level recommendation (lat/lng is that area's centroid, not
  // one exact venue) rather than a single specific spot -- e.g. "Gemmayze" for nightlife, vs. a
  // named beach for Beach & Swim.
  is_area?: boolean;
  area_name?: string | null;
  map_url?: string | null;
  image_url?: string | null;
  review_status?: string;
  source?: string;
  must_do?: boolean | null;
  duration_minutes?: number | null;
};

export type TripSlot = {
  time: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  lat: number;
  lng: number;
  mapUrl: string;
  durationMinutes?: number;
  _removed?: boolean;
  // Carried through from Site.kind when this slot was built from an activity, purely for a UI
  // badge -- see the note on Site.kind.
  kind?: "site" | "activity";
};

export type TripDay = {
  day: number;
  label: string;
  slots: TripSlot[];
  // Which leg of a multi-destination trip this day belongs to. Optional and absent on every
  // trip created before multi-destination support existed -- callers should treat a day with
  // no city as belonging to the trip's single (only) destination, trip.city.
  city?: string;
  cityId?: string;
  country?: string;
};

export type Trip = {
  id: string;
  user_id?: string | null;
  auth_user_id?: string | null;
  city: string;
  dates?: string | null;
  duration?: number | null;
  group_type?: string | null;
  pace?: string | null;
  days: TripDay[];
  status: "planning" | "ready";
  weather_tip?: string | null;
  created_at: string;
  // Absent/false on every trip created before sharing existed -- treat as private. See
  // TRIP-SHARING-PLAN.md: the trip's own id doubles as the share token once this is true.
  is_public?: boolean | null;
};
