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
  // Bilingual content, see ARABIC-LOCALIZATION-PLAN.md decision 6 -- generated in the same AI call
  // as the English fields, not a separate translation pass. Absent/null on any site cached before
  // this existed; src/lib/sites.ts's backfill fills these in opportunistically, not eagerly.
  name_ar?: string | null;
  description_ar?: string | null;
  long_description_ar?: string | null;
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
  // Bilingual content -- see the note on Site.name_ar, same rationale applies here.
  name_ar?: string | null;
  description_ar?: string | null;
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
  // Snapshotted from the underlying Site/Activity's name_ar/description_ar at build time (see
  // itineraryPlanner.ts's siteToSlot) -- carried on the slot itself, not looked up live, so a
  // built trip (and any /shared link to it) renders correctly in Arabic regardless of which
  // language the viewer has selected, independent of which language the trip was built in.
  nameAr?: string | null;
  descriptionAr?: string | null;
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
  // Bilingual day title, generated alongside `label` (see planFlow.ts's
  // buildDayLabelsSystemPrompt) -- same rationale as TripSlot's nameAr/descriptionAr.
  labelAr?: string;
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
