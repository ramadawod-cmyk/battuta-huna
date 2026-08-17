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
  _removed?: boolean;
};

export type TripDay = {
  day: number;
  label: string;
  slots: TripSlot[];
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
};
